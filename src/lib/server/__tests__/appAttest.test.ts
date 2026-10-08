import { describe, it, expect } from "vitest";
import { createHash, createSign, generateKeyPairSync, X509Certificate } from "node:crypto";
import {
  APPLE_APP_ATTEST_ROOT,
  AttestationError,
  certificateNonce,
  decodeCbor,
  readAuthenticatorData,
  verifyAssertion,
  verifyAttestation,
} from "../appAttest";

const APP_ID = "ABCDE12345.com.wpv.spindle";
const sha256 = (...parts: Uint8Array[]) => {
  const h = createHash("sha256");
  parts.forEach((p) => h.update(p));
  return h.digest();
};

/** Just enough CBOR writing to build test assertions. */
function cbor(value: unknown): Buffer {
  const head = (major: number, n: number) =>
    n < 24
      ? Buffer.from([(major << 5) | n])
      : n < 256
        ? Buffer.from([(major << 5) | 24, n])
        : Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
  if (typeof value === "string") {
    const b = Buffer.from(value);
    return Buffer.concat([head(3, b.length), b]);
  }
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  if (typeof value === "number") return head(0, value);
  const entries = Object.entries(value as Record<string, unknown>);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)])]);
}

function authenticatorData(counter: number, appId = APP_ID): Buffer {
  const counterBytes = Buffer.alloc(4);
  counterBytes.writeUInt32BE(counter);
  return Buffer.concat([sha256(Buffer.from(appId)), Buffer.from([0x40]), counterBytes]);
}

function makeAssertion(body: Buffer, counter: number, appId = APP_ID) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const authData = authenticatorData(counter, appId);
  const nonce = sha256(authData, sha256(body));
  const signature = createSign("sha256").update(nonce).sign(privateKey);
  return {
    assertion: cbor({ signature, authenticatorData: authData }),
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

describe("Apple's root certificate", () => {
  it("is intact: it verifies its own signature", () => {
    const root = new X509Certificate(APPLE_APP_ATTEST_ROOT);
    expect(root.subject).toContain("CN=Apple App Attestation Root CA");
    expect(root.verify(root.publicKey)).toBe(true);
  });
});

describe("decodeCbor", () => {
  it("reads maps, byte strings, text, arrays and integers", () => {
    const decoded = decodeCbor(cbor({ fmt: "apple-appattest", n: 300, list: [Buffer.from([1, 2])] }));
    expect(decoded).toMatchObject({ fmt: "apple-appattest", n: 300 });
    expect(Array.from((decoded as { list: Uint8Array[] }).list[0])).toEqual([1, 2]);
  });
  it("refuses data that ends early", () => {
    expect(() => decodeCbor(cbor("hello").subarray(0, 3))).toThrow(AttestationError);
  });
  it("refuses trailing bytes", () => {
    expect(() => decodeCbor(Buffer.concat([cbor(1), Buffer.from([0])]))).toThrow(AttestationError);
  });
});

describe("readAuthenticatorData", () => {
  it("reads the app hash and the counter", () => {
    const parsed = readAuthenticatorData(authenticatorData(42));
    expect(parsed.counter).toBe(42);
    expect(Buffer.from(parsed.rpIdHash)).toEqual(sha256(Buffer.from(APP_ID)));
  });
});

describe("certificateNonce", () => {
  it("finds the 32 bytes after Apple's OID", () => {
    const nonce = Buffer.alloc(32, 7);
    const der = Buffer.concat([
      Buffer.from([0x30, 0x10]),
      Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]),
      Buffer.from([0x04, 0x26]),
      Buffer.from([0x30, 0x24, 0xa1, 0x22, 0x04, 0x20]),
      nonce,
    ]);
    expect(Buffer.from(certificateNonce(der))).toEqual(nonce);
  });
  it("refuses a certificate without one", () => {
    expect(() => certificateNonce(Buffer.from([1, 2, 3]))).toThrow(AttestationError);
  });
});

describe("verifyAssertion", () => {
  const body = Buffer.from(JSON.stringify({ volumeId: "bofm", book: "Alma", chapters: [32], extras: [] }));

  it("accepts a request signed by the key, and returns its counter", () => {
    const { assertion, publicKeyPem } = makeAssertion(body, 3);
    expect(verifyAssertion({ assertion, clientData: body, publicKeyPem, appId: APP_ID })).toEqual({ counter: 3 });
  });
  it("refuses a request whose body was changed after signing", () => {
    const { assertion, publicKeyPem } = makeAssertion(body, 3);
    const changed = Buffer.from(body.toString().replace("32", "33"));
    expect(() => verifyAssertion({ assertion, clientData: changed, publicKeyPem, appId: APP_ID })).toThrow(
      AttestationError,
    );
  });
  it("refuses a request signed by another key", () => {
    const { assertion } = makeAssertion(body, 3);
    const { publicKeyPem: someoneElse } = makeAssertion(body, 3);
    expect(() => verifyAssertion({ assertion, clientData: body, publicKeyPem: someoneElse, appId: APP_ID })).toThrow(
      AttestationError,
    );
  });
  it("refuses a request from a different app", () => {
    const { assertion, publicKeyPem } = makeAssertion(body, 3, "OTHER.com.example.app");
    expect(() => verifyAssertion({ assertion, clientData: body, publicKeyPem, appId: APP_ID })).toThrow(
      AttestationError,
    );
  });
});

describe("verifyAttestation", () => {
  it("refuses anything that is not an App Attest attestation", () => {
    expect(() =>
      verifyAttestation({
        keyId: "AAAA",
        attestation: cbor({ fmt: "packed", attStmt: {}, authData: Buffer.alloc(40) }),
        challenge: Buffer.alloc(32),
        appId: APP_ID,
      }),
    ).toThrow(AttestationError);
  });
  it("refuses an attestation with no certificates", () => {
    expect(() =>
      verifyAttestation({
        keyId: "AAAA",
        attestation: cbor({ fmt: "apple-appattest", attStmt: { x5c: [] }, authData: Buffer.alloc(40) }),
        challenge: Buffer.alloc(32),
        appId: APP_ID,
      }),
    ).toThrow(AttestationError);
  });
});
