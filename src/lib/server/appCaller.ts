import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AttestationError, verifyAssertion } from "@/lib/server/appAttest";
import { appId, appRoutesConfigured, findKey, spendKey } from "@/lib/server/appDb";
import type { ReaderProfile } from "@/lib/server/prompt";

export function err(status: number, message: string, type?: string) {
  return NextResponse.json({ error: { message, type: type ?? "error" } }, { status });
}

const NOT_RECOGNISED =
  "The study service didn't recognise this iPhone — try again later. Your journal is unaffected.";

/** The profile as the phone sends it (decision 0003). Lengths are generous
 *  here because describeReader() caps each field before it reaches a prompt. */
export const ProfileSchema = z
  .object({
    first_name: z.string().max(2000).optional(),
    calling: z.string().max(2000).optional(),
    family_context: z.string().max(2000).optional(),
    study_focus: z.string().max(2000).optional(),
    spiritual_season: z.string().max(2000).optional(),
    conference_scope: z.enum(["core", "expanded"]).optional(),
  })
  .optional();

export function readerProfile(profile: z.infer<typeof ProfileSchema>): ReaderProfile | null {
  return profile ?? null;
}

/**
 * Checks an iPhone request is from an attested install, has not been replayed,
 * and is within the hour's limit. Returns the body to parse, or the response
 * to send instead.
 */
export async function admit(
  request: Request,
  kind: "study" | "plan",
  hourlyLimit: number,
  limitMessage: string,
): Promise<{ body: Buffer } | { refuse: NextResponse }> {
  if (!appRoutesConfigured()) {
    return { refuse: err(503, "Preparing studies from the iPhone isn't set up on the server yet.", "unavailable") };
  }
  const keyId = request.headers.get("x-spindle-key-id");
  const assertion = request.headers.get("x-spindle-assertion");
  if (!keyId || !assertion) return { refuse: err(401, NOT_RECOGNISED, "attestation") };

  const body = Buffer.from(await request.arrayBuffer());
  try {
    const key = await findKey(keyId);
    if (!key) return { refuse: err(401, NOT_RECOGNISED, "attestation") };
    const { counter } = verifyAssertion({
      assertion: Buffer.from(assertion, "base64"),
      clientData: body,
      publicKeyPem: key.public_key,
      appId: appId(),
    });
    const use = await spendKey(keyId, counter, kind, hourlyLimit);
    if (use === "limit") return { refuse: err(429, limitMessage, "rate_limit") };
    if (use !== "ok") return { refuse: err(401, NOT_RECOGNISED, "attestation") };
  } catch (e) {
    if (e instanceof AttestationError) return { refuse: err(401, NOT_RECOGNISED, "attestation") };
    console.error("app admit failed", e);
    return { refuse: err(500, "Couldn't check this request — try again.") };
  }
  return { body };
}
