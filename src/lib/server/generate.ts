import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { StudySchema, type Study } from "@/lib/study";
import { PlanSchema, type GeneratedPlan } from "@/lib/plans";
import { buildPlanPrompt, buildSystemPrompt, type ReaderProfile } from "@/lib/server/prompt";

/**
 * Study and plan generation for the iPhone routes under /api/app.
 *
 * The same calls, prompts, retries and messages as the web routes
 * (`/api/study`, `/api/plan`). Those routes still carry their own copy: they
 * are live, and changing them is a separate, deliberate step rather than a
 * side effect of adding the iPhone's. Moving them onto this file is the
 * obvious follow-up, and when it happens there is one copy again.
 */

export type Generated<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string; type: string };

const fail = (status: number, message: string, type = "error") =>
  ({ ok: false, status, message, type }) as const;

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function model() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

/** The SDK's errors, in the words the web app uses. */
function apiFailure(e: unknown): Generated<never> | null {
  if (e instanceof Anthropic.APIConnectionError) {
    return fail(502, "Couldn't reach the study service — check your connection.", "network");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return fail(429, "The study service is busy — wait a moment and tap again.", "rate_limit");
  }
  if (e instanceof Anthropic.APIError) {
    return fail(502, `The study service returned an error (${e.status ?? "unknown"}): ${e.message}`, "api");
  }
  return null;
}

function text(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function generateStudy(
  reference: string,
  volumeName: string,
  profile: ReaderProfile | null,
): Promise<Generated<Study>> {
  const anthropic = client();
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stream = anthropic.messages.stream({
        model: model(),
        max_tokens: 4096,
        system: buildSystemPrompt(profile),
        messages: [{ role: "user", content: `Prepare a complete study for: ${reference} (${volumeName}).` }],
        output_config: { format: zodOutputFormat(StudySchema), effort: "medium" },
      });
      const response = await stream.finalMessage();
      if (response.stop_reason === "max_tokens") {
        lastError = "The study was cut off — try fewer chapters, or tap again.";
        continue;
      }
      if (response.stop_reason === "refusal") {
        lastError = "That passage couldn't be prepared right now — please tap again.";
        continue;
      }
      let candidate: unknown;
      try {
        candidate = JSON.parse(text(response));
      } catch {
        lastError = "The study came back incomplete — try fewer chapters, or tap again.";
        continue;
      }
      const validated = StudySchema.safeParse(candidate);
      if (validated.success) return { ok: true, value: validated.data };
      lastError = "The study came back in an unexpected shape.";
    } catch (e) {
      const failure = apiFailure(e);
      if (failure) return failure;
      lastError = e instanceof Error ? e.message : "Unknown error.";
    }
  }
  return fail(502, lastError || "The study service returned an empty response — tap again.");
}

export async function generatePlan(
  request: string,
  profile: ReaderProfile | null,
): Promise<Generated<GeneratedPlan>> {
  const anthropic = client();
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stream = anthropic.messages.stream({
        model: model(),
        max_tokens: 8192,
        system: buildPlanPrompt(profile),
        messages: [{ role: "user", content: `Create a study plan for this request: ${request}` }],
        output_config: { format: zodOutputFormat(PlanSchema), effort: "medium" },
      });
      const response = await stream.finalMessage();
      if (response.stop_reason === "max_tokens") {
        lastError = "The plan came out too long — try describing a narrower topic.";
        continue;
      }
      if (response.stop_reason === "refusal") {
        lastError = "That request couldn't be turned into a study plan — try rephrasing it around a gospel topic.";
        continue;
      }
      let candidate: unknown;
      try {
        candidate = JSON.parse(text(response));
      } catch {
        lastError = "The plan came back incomplete — tap again, or try a narrower topic.";
        continue;
      }
      const validated = PlanSchema.safeParse(candidate);
      if (validated.success && validated.data.items.length > 0) {
        // The web route caps what it saves at 60 items and these lengths; the
        // phone saves what it is sent, so the cap moves here.
        const plan = validated.data;
        return {
          ok: true,
          value: {
            title: plan.title.slice(0, 200),
            description: plan.description.slice(0, 1000),
            items: plan.items.slice(0, 60).map((item) => ({
              title: item.title.slice(0, 300),
              subtitle: item.subtitle.slice(0, 500),
              reference: item.reference.slice(0, 300),
            })),
          },
        };
      }
      lastError = "The plan came back in an unexpected shape — tap again.";
    } catch (e) {
      const failure = apiFailure(e);
      if (failure) return failure;
      lastError = e instanceof Error ? e.message : "Unknown error.";
    }
  }
  return fail(502, lastError || "Couldn't create that plan — tap again.");
}
