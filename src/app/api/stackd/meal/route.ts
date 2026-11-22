import { NextResponse } from "next/server";
import { z } from "zod";
import { admit, err } from "@/lib/server/appCaller";
import { estimateMeal } from "@/lib/server/meal";

export const maxDuration = 60;

/** About 1.5 MB of JPEG once base64-encoded; the phone shrinks photos well under this. */
const MAX_IMAGE_CHARACTERS = 2_000_000;

const MealSchema = z.object({
  image: z.string().min(100).max(MAX_IMAGE_CHARACTERS),
  mediaType: z.enum(["image/jpeg", "image/png"]),
});

/**
 * A photo of a meal from Stackd → an estimate of calories, protein and sugar
 * (decision 0007). Only an attested Stackd install may call it, 30 times an hour.
 * The photo is sent to the model and not kept.
 */
export async function POST(request: Request) {
  const admitted = await admit(
    request,
    "meal",
    30,
    "That's a lot of photos this hour — type the next one in, or try again later.",
    "stackd",
  );
  if ("refuse" in admitted) return admitted.refuse;

  let json: unknown;
  try {
    json = JSON.parse(admitted.body.toString("utf8"));
  } catch {
    return err(400, "Invalid request.");
  }
  const parsed = MealSchema.safeParse(json);
  if (!parsed.success) return err(400, "That photo is too large or couldn't be read — try again.");

  const result = await estimateMeal(parsed.data.image, parsed.data.mediaType);
  if (!result.ok) return err(result.status, result.message, result.type);
  return NextResponse.json({ estimate: result.estimate }, { headers: { "Cache-Control": "no-store" } });
}
