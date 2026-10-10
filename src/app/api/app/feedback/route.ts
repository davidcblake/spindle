import { z } from "zod";
import { admit, err } from "@/lib/server/appCaller";
import { saveFeedback } from "@/lib/server/appDb";
import { notify } from "@/lib/server/notify";

const FeedbackSchema = z.object({
  message: z.string().trim().min(3).max(2000),
});

/**
 * Feedback and feature requests from the iPhone (decision 0006): kept in the
 * database, then sent to Dave's phone. Never shown to a model, so it is only
 * ever words for a person to read.
 */
export async function POST(request: Request) {
  const admitted = await admit(
    request,
    "feedback",
    5,
    "Thank you — you've sent several notes this hour. Please try again a little later.",
  );
  if ("refuse" in admitted) return admitted.refuse;

  let json: unknown;
  try {
    json = JSON.parse(admitted.body.toString("utf8"));
  } catch {
    return err(400, "Invalid request.");
  }
  const parsed = FeedbackSchema.safeParse(json);
  if (!parsed.success) {
    return err(400, "Write a few words (up to 2,000 characters) and tap Send again.");
  }

  const keyId = request.headers.get("x-spindle-key-id") ?? "";
  try {
    await saveFeedback(keyId, parsed.data.message);
  } catch (e) {
    console.error("feedback not saved", e);
    // Still sent as an alert below, so it is not lost.
  }
  await notify({ title: "Spindle feedback", message: parsed.data.message, tags: ["speech_balloon"] });
  return new Response(null, { status: 204 });
}
