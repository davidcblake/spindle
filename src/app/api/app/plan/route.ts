import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePlan } from "@/lib/server/generate";
import { admit, err, ProfileSchema, readerProfile } from "@/lib/server/appCaller";

export const maxDuration = 60;

const RequestSchema = z.object({
  request: z.string().min(3).max(500),
  profile: ProfileSchema,
});

/** A study plan for the iPhone (decision 0003). Like /api/plan, the request is
 *  a topic, never instructions — buildPlanPrompt says so to the model. */
export async function POST(request: Request) {
  const admitted = await admit(
    request,
    "plan",
    5,
    "You've created several plans this hour — try again a little later.",
  );
  if ("refuse" in admitted) return admitted.refuse;

  let json: unknown;
  try {
    json = JSON.parse(admitted.body.toString("utf8"));
  } catch {
    return err(400, "Invalid request.");
  }
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return err(400, "Describe the plan you'd like in a sentence or two (up to 500 characters).");
  }

  const result = await generatePlan(parsed.data.request, readerProfile(parsed.data.profile));
  if (!result.ok) return err(result.status, result.message, result.type);
  return NextResponse.json({ plan: result.value });
}
