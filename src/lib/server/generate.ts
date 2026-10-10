import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { StudySchema, type Study } from "@/lib/study";
import { PlanSchema, type GeneratedPlan } from "@/lib/plans";
import { buildPlanPrompt, buildSystemPrompt, type ReaderProfile } from "@/lib/server/prompt";
import { effortFor, routeFor, type Route, type Task } from "@/lib/server/models";

/**
 * Study and plan generation: the one place Spindle calls the model, for the
 * website's routes and the iPhone's alike.
 *
 * Which model prepares each request is chosen in `lib/server/models.ts`
 * (decision 0005). Each request gets two tries: the first on the chosen model,
 * the second on the step-up model when the first failed — cut off, declined,
 * the wrong shape, or the model service itself erroring.
 */

export type Generated<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string; type: string };

const fail = (status: number, message: string, type = "error") =>
  ({ ok: false, status, message, type }) as const;

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** The model for each of the two tries. Without a step-up model, the second
 *  try is the first model again, as it always was. */
function tries(route: Route): [string, string] {
  return [route.first, route.stepUp ?? route.first];
}

/** `output_config` for one try, leaving out effort where the model refuses it. */
function outputConfig<F>(task: Task, model: string, format: F) {
  const effort = effortFor(task, model);
  return { format, ...(effort ? { effort } : {}) };
}

/**
 * Whether an error from the model service is worth trying again on the
 * step-up model: the cheaper model overloaded, rate-limited or unavailable.
 * Not a broken connection, which the next model would hit as well.
 */
function worthSteppingUp(e: unknown): boolean {
  return e instanceof Anthropic.APIError && !(e instanceof Anthropic.APIConnectionError);
}

/**
 * One line per generation in Vercel's logs: which model, and how many tokens
 * went in and out. That is what the bill is made of, so it is what a decision
 * to change models gets measured against.
 */
function logUsage(task: Task, model: string, attempt: number, response: Anthropic.Message) {
  console.info(
    JSON.stringify({
      event: "generated",
      task,
      model,
      attempt: attempt + 1,
      stop: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    }),
  );
}

/** A line in the log when the first model's error sends a request up. */
function stepUpLog(model: string, e: unknown) {
  const status = e instanceof Anthropic.APIError ? e.status : undefined;
  console.warn(JSON.stringify({ event: "stepped_up", from: model, status }));
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
    // The detail (an empty credit balance, a retired model name) is for the
    // log, not for somebody in the middle of their scripture study.
    console.error("model call failed", e.status, e.message);
    return fail(502, "The study service is unavailable right now — please try again in a little while.", "api");
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
  const models = tries(routeFor("study"));
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = models[attempt];
    try {
      // Streamed so a long generation keeps the connection alive.
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: buildSystemPrompt(profile),
        messages: [{ role: "user", content: `Prepare a complete study for: ${reference} (${volumeName}).` }],
        output_config: outputConfig("study", model, zodOutputFormat(StudySchema)),
      });
      const response = await stream.finalMessage();
      logUsage("study", model, attempt, response);
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
      if (attempt === 0 && models[1] !== model && worthSteppingUp(e)) {
        stepUpLog(model, e);
        continue;
      }
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
  const models = tries(routeFor("plan", request));
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = models[attempt];
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 8192,
        system: buildPlanPrompt(profile),
        messages: [{ role: "user", content: `Create a study plan for this request: ${request}` }],
        output_config: outputConfig("plan", model, zodOutputFormat(PlanSchema)),
      });
      const response = await stream.finalMessage();
      logUsage("plan", model, attempt, response);
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
      if (attempt === 0 && models[1] !== model && worthSteppingUp(e)) {
        stepUpLog(model, e);
        continue;
      }
      const failure = apiFailure(e);
      if (failure) return failure;
      lastError = e instanceof Error ? e.message : "Unknown error.";
    }
  }
  return fail(502, lastError || "Couldn't create that plan — tap again.");
}
