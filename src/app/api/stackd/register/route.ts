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
 * Registers a Stackd iPhone's App Attest key, once per install (decision 0007).
 * The same arrangement as Spindle's /api/app/register, checked against Stackd's App
 * ID, so a Stackd key can never be used for a study and a Spindle key never for a meal.
 * The challenge comes from /api/app/challenge, which is the same for both apps.
 */
export async function POST(request: Request) {
  if (!appRoutesConfigured()) {
    return err(503, "Reading meal photos isn't set up on the server yet.", "unavailable");
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
      appId: appId("stackd"),
    });
    if (await registerKey(keyId, publicKeyPem)) {
      await notify({ title: "Stackd iPhone registered", message: "Stackd set itself up for meal photos.", tags: ["tada"] });
    }
  } catch (e) {
    if (e instanceof AttestationError) {
      console.warn("stackd attestation refused", e.message);
      return err(401, "This iPhone couldn't prove it is running Stackd.", "attestation");
    }
    console.error("stackd register failed", e);
    await notify({ title: "Stackd: an iPhone couldn't register", message: String(e), priority: 4, tags: ["warning"] });
    return err(500, "Couldn't register this iPhone — try again.");
  }
  return new Response(null, { status: 204 });
}
