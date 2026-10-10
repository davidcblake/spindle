/**
 * Which Claude model prepares each request, and how hard it thinks
 * (decision 0005).
 *
 * By default Spindle picks per request:
 *
 *   - a study            → Claude Haiku 5.5, stepping up to Sonnet 5.5 if it fails
 *   - a plan about talks → Claude Sonnet 5.5, because a plan made of talk titles
 *                          is where a smaller model is most likely to invent one
 *   - any other plan     → Claude Haiku 5.5, stepping up to Sonnet 5.5 if it fails
 *
 * Vercel settings override the choice, so any model can still be swapped in
 * by changing one value and redeploying:
 *
 *   SPINDLE_STUDY_MODEL / SPINDLE_PLAN_MODEL    — per task, always used first
 *   ANTHROPIC_MODEL                             — both, where the above are unset
 *   SPINDLE_STEP_UP_MODEL                       — what a failure steps up to
 *   SPINDLE_STUDY_EFFORT / SPINDLE_PLAN_EFFORT  — low … max
 *
 * Pure functions with no `server-only` import, so they can be tested.
 */

export type Task = "study" | "plan";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

/** About a twentieth of Sonnet's price. */
export const EVERYDAY_MODEL = "claude-haiku-5-5";

/** Same price as Claude Sonnet 5, the model Spindle used until 2026-10-10. */
export const CAREFUL_MODEL = "claude-sonnet-5-5";

/** Medium on both, as the routes have always asked for: a study's depth comes
 *  from its eleven-section structure, not from a long think. */
export const DEFAULT_EFFORT: Effort = "medium";

type Env = Record<string, string | undefined>;

/** The models to try for one request, in order: the first, and what to step
 *  up to if the first fails. */
export interface Route {
  first: string;
  stepUp?: string;
}

/**
 * Words that mean a plan will be mostly talks and the people who gave them.
 * Deliberately generous: a scripture plan caught by mistake costs a few cents
 * more; a talk plan missed risks an invented title.
 */
const ABOUT_TALKS =
  /\b(talks?|conferences?|devotionals?|firesides?|sermons?|addresse?s?|speakers?|apostles?|prophets?|presidents?|elders?|sisters?|seventy|presidency|quorum|twelve|leaders?|liahona|ensign)\b|\b(april|october)\s+\d{4}\b/i;

export function isAboutTalks(request: string): boolean {
  return ABOUT_TALKS.test(request);
}

/**
 * Which model to try first for a request, and what to step up to.
 * `request` is the plan's wording; studies have none.
 */
export function routeFor(task: Task, request = "", env: Env = process.env): Route {
  const chosen = env[`SPINDLE_${task.toUpperCase()}_MODEL`]?.trim() || env.ANTHROPIC_MODEL?.trim();
  const stepUpTo = env.SPINDLE_STEP_UP_MODEL?.trim() || CAREFUL_MODEL;

  const first =
    chosen ||
    (task === "plan" && isAboutTalks(request) ? CAREFUL_MODEL : EVERYDAY_MODEL);
  return first === stepUpTo ? { first } : { first, stepUp: stepUpTo };
}

/**
 * The effort to ask for, or undefined for a model that does not accept the
 * setting. Haiku 4.5 returns an error if it is sent at all; every current
 * model accepts it.
 */
export function effortFor(task: Task, model: string, env: Env = process.env): Effort | undefined {
  if (model.startsWith("claude-haiku-4")) return undefined;
  const asked = env[`SPINDLE_${task.toUpperCase()}_EFFORT`]?.trim().toLowerCase();
  return EFFORTS.find((e) => e === asked) ?? DEFAULT_EFFORT;
}
