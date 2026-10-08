/**
 * Apple App Attest, checked on the server (decisions 0002, 0003).
 *
 * Follows Apple's "Validating apps that connect to your server" step by step;
 * the numbered comments are Apple's steps. Pure functions over bytes, with no
 * database and no `server-only` import, so every step can be unit tested.
 */
import { createHash, createPublicKey, createVerify, X509Certificate } from "node:crypto";

/** Apple App Attestation Root CA, valid to 2045. A test checks it is intact by
 *  verifying its own signature; compare its fingerprint with
 *  apple.com/certificateauthority once by hand. */
export const APPLE_APP_ATTEST_ROOT = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

export class AttestationError extends Error {}

const sha256 = (...parts: Uint8Array[]) => {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
};

/* ------------------------------------------------------------------------ *
 * A minimal CBOR reader: the attestation and assertion objects use maps,
 * arrays, byte strings, text and small integers, and nothing else. Anything
 * outside that is refused rather than guessed at.
 * ------------------------------------------------------------------------ */
export function decodeCbor(bytes: Uint8Array): unknown {
  let at = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function length(info: number): number {
    if (info < 24) return info;
    if (info === 24) return bytes[at++];
    if (info === 25) { const v = view.getUint16(at); at += 2; return v; }
    if (info === 26) { const v = view.getUint32(at); at += 4; return v; }
    throw new AttestationError("CBOR length too large");
  }

  function item(): unknown {
    if (at >= bytes.length) throw new AttestationError("CBOR ended early");
    const head = bytes[at++];
    const major = head >> 5;
    const info = head & 0x1f;
    switch (major) {
      case 0: return length(info);
      case 1: return -1 - length(info);
      case 2: {
        const n = length(info);
        if (at + n > bytes.length) throw new AttestationError("CBOR ended early");
        const out = bytes.subarray(at, at + n);
        at += n;
        return out;
      }
      case 3: {
        const n = length(info);
        if (at + n > bytes.length) throw new AttestationError("CBOR ended early");
        const out = new TextDecoder().decode(bytes.subarray(at, at + n));
        at += n;
        return out;
      }
      case 4: {
        const n = length(info);
        return Array.from({ length: n }, () => item());
      }
      case 5: {
        const n = length(info);
        const map: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const key = item();
          if (typeof key !== "string") throw new AttestationError("CBOR map key is not text");
          map[key] = item();
        }
        return map;
      }
      default:
        throw new AttestationError(`CBOR major type ${major} is not used by App Attest`);
    }
  }

  const value = item();
  if (at !== bytes.length) throw new AttestationError("CBOR has trailing bytes");
  return value;
}

/** The parts of WebAuthn authenticator data App Attest uses. */
export function readAuthenticatorData(data: Uint8Array) {
  if (data.length < 37) throw new AttestationError("authenticator data too short");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const parsed = {
    rpIdHash: data.subarray(0, 32),
    counter: view.getUint32(33),
    aaguid: undefined as Uint8Array | undefined,
    credentialId: undefined as Uint8Array | undefined,
  };
  if (data.length >= 55) {
    parsed.aaguid = data.subarray(37, 53);
    const idLength = view.getUint16(53);
    parsed.credentialId = data.subarray(55, 55 + idLength);
  }
  return parsed;
}

const bytesEqual = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

const AAGUID_PRODUCTION = Buffer.concat([Buffer.from("appattest"), Buffer.alloc(7)]);
const AAGUID_DEVELOPMENT = Buffer.from("appattestdevelop");

/**
 * The nonce Apple puts in the leaf certificate, in the extension with OID
 * 1.2.840.113635.100.8.2. Its value is SEQUENCE { [1] { OCTET STRING (32) } },
 * which in DER is always the bytes 30 24 a1 22 04 20 then the 32-byte nonce, so
 * that fixed prefix is looked for directly after the OID rather than pulling
 * in an ASN.1 library for one field.
 */
export function certificateNonce(der: Uint8Array): Uint8Array {
  const oid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]);
  const prefix = Buffer.from([0x30, 0x24, 0xa1, 0x22, 0x04, 0x20]);
  const buffer = Buffer.from(der);
  const oidAt = buffer.indexOf(oid);
  if (oidAt === -1) throw new AttestationError("certificate has no App Attest nonce");
  const prefixAt = buffer.indexOf(prefix, oidAt + oid.length);
  if (prefixAt === -1 || prefixAt > oidAt + oid.length + 4) {
    throw new AttestationError("App Attest nonce is not where Apple puts it");
  }
  const start = prefixAt + prefix.length;
  return buffer.subarray(start, start + 32);
}

/**
 * Checks a key's attestation and returns its public key (PEM) to store.
 * Throws AttestationError on any failure.
 */
export function verifyAttestation(input: {
  keyId: string; // base64, as DCAppAttestService returns it
  attestation: Uint8Array;
  challenge: Uint8Array;
  appId: string; // TEAMID.bundle.id
  now?: Date;
}): { publicKeyPem: string } {
  const object = decodeCbor(input.attestation) as {
    fmt?: unknown;
    attStmt?: { x5c?: unknown; receipt?: unknown };
    authData?: unknown;
  };
  if (object?.fmt !== "apple-appattest") throw new AttestationError("not an App Attest attestation");
  const x5c = object.attStmt?.x5c;
  const authData = object.authData;
  if (!Array.isArray(x5c) || x5c.length < 2 || !(authData instanceof Uint8Array)) {
    throw new AttestationError("attestation is missing its certificates or data");
  }

  // 1. The certificates chain to Apple's App Attest root.
  const leaf = new X509Certificate(x5c[0] as Uint8Array);
  const intermediate = new X509Certificate(x5c[1] as Uint8Array);
  const root = new X509Certificate(APPLE_APP_ATTEST_ROOT);
  const now = input.now ?? new Date();
  for (const cert of [leaf, intermediate]) {
    if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
      throw new AttestationError("an attestation certificate is out of date");
    }
  }
  if (!leaf.verify(intermediate.publicKey) || !intermediate.verify(root.publicKey)) {
    throw new AttestationError("certificates do not chain to Apple's App Attest root");
  }

  // 2–4. The leaf's nonce is SHA256(authData ‖ SHA256(challenge)).
  const nonce = sha256(authData, sha256(input.challenge));
  if (!bytesEqual(certificateNonce(leaf.raw), nonce)) {
    throw new AttestationError("attestation was not made for this challenge");
  }

  // 5. The key id is the SHA-256 of the leaf's public key (uncompressed point).
  const publicKeyDer = leaf.publicKey.export({ format: "der", type: "spki" });
  const point = publicKeyDer.subarray(publicKeyDer.length - 65);
  const keyId = Buffer.from(input.keyId, "base64");
  if (!bytesEqual(sha256(point), keyId)) throw new AttestationError("key id does not match the key");

  // 6–9. Right app, a fresh key, Apple's App Attest environment, same key id.
  const parsed = readAuthenticatorData(authData);
  if (!bytesEqual(parsed.rpIdHash, sha256(Buffer.from(input.appId)))) {
    throw new AttestationError("attestation is for a different app");
  }
  if (parsed.counter !== 0) throw new AttestationError("a new key's counter must be zero");
  if (
    !parsed.aaguid ||
    !(bytesEqual(parsed.aaguid, AAGUID_PRODUCTION) || bytesEqual(parsed.aaguid, AAGUID_DEVELOPMENT))
  ) {
    throw new AttestationError("attestation is not from App Attest");
  }
  if (!parsed.credentialId || !bytesEqual(parsed.credentialId, keyId)) {
    throw new AttestationError("credential id does not match the key id");
  }

  return { publicKeyPem: leaf.publicKey.export({ format: "pem", type: "spki" }).toString() };
}

/**
 * Checks one request's assertion and returns its counter, which the caller
 * must check went up. Throws AttestationError on any failure.
 */
export function verifyAssertion(input: {
  assertion: Uint8Array;
  clientData: Uint8Array; // the exact request body bytes
  publicKeyPem: string;
  appId: string;
}): { counter: number } {
  const object = decodeCbor(input.assertion) as { signature?: unknown; authenticatorData?: unknown };
  const { signature, authenticatorData } = object ?? {};
  if (!(signature instanceof Uint8Array) || !(authenticatorData instanceof Uint8Array)) {
    throw new AttestationError("assertion is missing its signature or data");
  }

  // 1–3. The signature is over SHA256(authenticatorData ‖ SHA256(clientData)),
  // signed as P-256 ECDSA with SHA-256, so the verifier hashes the nonce once more.
  const nonce = sha256(authenticatorData, sha256(input.clientData));
  const verifier = createVerify("sha256");
  verifier.update(nonce);
  if (!verifier.verify(createPublicKey(input.publicKeyPem), signature)) {
    throw new AttestationError("assertion signature is not valid");
  }

  // 4. Signed by this app.
  const parsed = readAuthenticatorData(authenticatorData);
  if (!bytesEqual(parsed.rpIdHash, sha256(Buffer.from(input.appId)))) {
    throw new AttestationError("assertion is for a different app");
  }
  return { counter: parsed.counter };
}
