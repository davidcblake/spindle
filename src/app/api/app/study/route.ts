import { NextResponse } from "next/server";
import { z } from "zod";
import { validateSelection } from "@/lib/scripture";
import { generateStudy } from "@/lib/server/generate";
import { admit, err, ProfileSchema, readerProfile } from "@/lib/server/appCaller";

export const maxDuration = 60;

const RequestSchema = z.object({
  volumeId: z.string(),
  // Swift leaves out a book it has none of, where the web sends null.
  book: z.string().nullish(),
  chapters: z.array(z.number()).max(80),
  extras: z.array(z.string()).max(2),
  profile: ProfileSchema,
});

/**
 * A study for the iPhone (decision 0003): the web route's selection checks,
 * prompt and messages, with the caller proven by App Attest instead of a
 * session, and the profile sent in the request instead of read from Postgres.
 * Nothing is saved here — the phone saves the study before showing it.
 */
export async function POST(request: Request) {
  const admitted = await admit(
    request,
    "study",
    15,
    "You've prepared a lot of studies this hour — take a few minutes to ponder, then try again.",
  );
  if ("refuse" in admitted) return admitted.refuse;

  let json: unknown;
  try {
    json = JSON.parse(admitted.body.toString("utf8"));
  } catch {
    return err(400, "Invalid request.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return err(400, "Invalid request.");

  let reference: string;
  let volumeName: string;
  try {
    ({ reference, volumeName } = validateSelection({ ...parsed.data, book: parsed.data.book ?? null }));
  } catch (e) {
    return err(400, e instanceof Error ? e.message : "Invalid selection.");
  }

  const result = await generateStudy(reference, volumeName, readerProfile(parsed.data.profile));
  if (!result.ok) return err(result.status, result.message, result.type);
  return NextResponse.json({ study: result.value });
}
