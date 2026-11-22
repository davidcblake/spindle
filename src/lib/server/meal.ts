import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { notify } from "@/lib/server/notify";

/**
 * Reading a photo of a meal for Stackd, Dave's health tracker (decision 0007).
 *
 * The phone sends a photo and nothing else — no words of the user's reach the prompt,
 * the same rule studies follow. What comes back is always an estimate, and the phone
 * labels it so and asks Dave to confirm before anything is logged.
 */

export const MealEstimateSchema = z.object({
  /** False when the photo isn't of food or drink. */
  isFood: z.boolean(),
  /** "Grilled salmon, rice and broccoli" — the plate in a few words. */
  name: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      calories: z.number(),
      protein: z.number(),
      sugar: z.number(),
    }),
  ),
  /** The whole plate as pictured. */
  calories: z.number(),
  protein: z.number(),
  sugar: z.number(),
  /** A plausible range for the calories, since portions in a photo are uncertain. */
  caloriesLow: z.number(),
  caloriesHigh: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type MealEstimate = z.infer<typeof MealEstimateSchema>;

export type MealResult =
  | { ok: true; estimate: MealEstimate }
  | { ok: false; status: number; message: string; type: string };

/** Opus 5.5 unless the server says otherwise: a meal photo is one short request, so the
 *  difference in cost is cents a month for one person, and accuracy is the point.
 *  Set STACKD_MEAL_MODEL (e.g. claude-haiku-5-5) to trade some accuracy for cost. */
export const MEAL_MODEL = "claude-opus-5-5";

export function mealModel(env: Record<string, string | undefined> = process.env): string {
  return env.STACKD_MEAL_MODEL?.trim() || MEAL_MODEL;
}

const SYSTEM = `You estimate the nutrition of a meal from a single photo, for one person's private food log.

Estimate what is on the plate (or in the bowl, cup or package) as pictured: identify each item, judge its portion from visual cues such as the plate, utensils and hands, and give calories, protein in grams and sugar in grams for each, then the totals.

Rules:
- These are estimates. Give your best single figure for each number, and a realistic calorie range for the whole plate that reflects how uncertain the portion is.
- Use typical US preparations and portions unless the photo shows otherwise. Count visible oils, sauces and dressings.
- Sugar means total sugars, including those naturally in fruit and milk.
- Name the plate in a few plain words a person would use, without brand names unless a label is clearly visible.
- If the photo is not of food or drink, set isFood to false, use an empty items list and zeros.
- Never give medical or dietary advice. Only describe the food.
- Set confidence to low when the food is hard to identify or the portion is hard to judge.`;

const fail = (status: number, message: string, type = "error"): MealResult => ({ ok: false, status, message, type });

export async function estimateMeal(imageBase64: string, mediaType: "image/jpeg" | "image/png"): Promise<MealResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = mealModel();
  try {
    const response = await client.messages
      .stream({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        output_config: { format: zodOutputFormat(MealEstimateSchema), effort: "medium" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: "Estimate this meal." },
            ],
          },
        ],
      })
      .finalMessage();

    console.info(
      JSON.stringify({
        event: "generated",
        task: "meal",
        model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }),
    );

    if (response.stop_reason === "refusal") {
      return fail(422, "That photo couldn't be read — try another, or type the food in.");
    }
    if (response.stop_reason === "max_tokens") {
      return fail(502, "The estimate came back incomplete — try again.");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      return fail(502, "The estimate came back incomplete — try again.");
    }
    const parsed = MealEstimateSchema.safeParse(candidate);
    if (!parsed.success) return fail(502, "The estimate came back in an unexpected shape — try again.");
    return { ok: true, estimate: tidy(parsed.data) };
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionError) {
      return fail(502, "Couldn't reach the estimating service — check your connection.", "network");
    }
    if (e instanceof Anthropic.RateLimitError) {
      await notify({ title: "Anthropic is rate-limiting Stackd meal photos", message: e.message, tags: ["hourglass"] });
      return fail(429, "Too many photos at once — try again in a minute.", "rate_limit");
    }
    console.error("meal estimate failed", e);
    await notify({ title: "A Stackd meal photo failed", message: String(e), tags: ["warning"] });
    return fail(502, "That photo couldn't be estimated right now — try again, or type the food in.");
  }
}

/** Whole numbers, no negatives, and a range that actually contains the estimate. */
export function tidy(estimate: MealEstimate): MealEstimate {
  const round = (n: number) => Math.max(0, Math.round(n));
  const calories = round(estimate.calories);
  return {
    ...estimate,
    name: estimate.name.trim().slice(0, 120),
    items: estimate.items.slice(0, 12).map((item) => ({
      name: item.name.trim().slice(0, 80),
      calories: round(item.calories),
      protein: round(item.protein),
      sugar: round(item.sugar),
    })),
    calories,
    protein: round(estimate.protein),
    sugar: round(estimate.sugar),
    caloriesLow: Math.min(round(estimate.caloriesLow), calories),
    caloriesHigh: Math.max(round(estimate.caloriesHigh), calories),
  };
}
