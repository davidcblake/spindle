import { z } from "zod";
import { AttestationError, verifyAttestation } from "@/lib/server/appAttest";
import { appId, appRoutesConfigured, registerKey, takeChallenge } from "@/lib/server/appDb";
import { err } from "@/lib/server/appCaller";
import { notify } from "@/lib/server/notify";

const RegisterSchema = z.object({
  keyId: z.string().min(1).max(200),
  attestation: z.string().min(1).max(20_000),
  challenge: z.string().min(1).max(200),
});

/**
 * Registers an iPhone's App Attest key, once per install (decision 0003).
 * The challenge is used up first, so an attestation can never be replayed.
 */
export async function POST(request: Request) {
  if (!appRoutesConfigured()) {
    return err(503, "Preparing studies from the iPhone isn't set up on the server yet.", "unavailable");
  }
  const parsed = RegisterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err(400, "Invalid request.");
  const { keyId, attestation, challenge } = parsed.data;

  try {
    if (!(await takeChallenge(challenge))) {
      return err(401, "That registration took too long — try again.", "attestation");
    }
    const { publicKeyPem } = verifyAttestation({
      keyId,
      attestation: Buffer.from(attestation, "base64"),
      challenge: Buffer.from(challenge, "base64"),
      appId: appId(),
    });
    if (await registerKey(keyId, publicKeyPem)) {
      // No accounts on the iPhone, so a new install is the nearest thing to
      // a new user (decision 0006). Reinstalling counts again.
      await notify({
        title: "New Spindle iPhone",
        message: "Someone just installed Spindle and set it up.",
        tags: ["tada"],
      });
    }
  } catch (e) {
    if (e instanceof AttestationError) {
      console.warn("attestation refused", e.message);
      return err(401, "This iPhone couldn't prove it is running Spindle.", "attestation");
    }
    console.error("register failed", e);
    await notify({ title: "Spindle: an iPhone couldn't register", message: String(e), priority: 4, tags: ["warning"] });
    return err(500, "Couldn't register this iPhone — try again.");
  }
  return new Response(null, { status: 204 });
}
