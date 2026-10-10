/**
 * Which Claude model prepares each kind of thing, and how hard it thinks.
 *
 * Set in Vercel, never in code, so a model can be swapped by changing one
 * setting and redeploying (decision 0005):
 *
 *   SPINDLE_STUDY_MODEL / SPINDLE_PLAN_MODEL    — per task
 *   ANTHROPIC_MODEL                             — both, if the above are unset
 *   SPINDLE_STUDY_EFFORT / SPINDLE_PLAN_EFFORT  — low … max
 *
 * Pure functions with no `server-only` import, so they can be tested.
 */

export type Task = "study" | "plan";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

/** Claude Haiku 5.5, about a twentieth of Claude Sonnet 5's price. Dave's
 *  choice on 2026-10-10, recorded in decision 0005; a Vercel setting still
 *  overrides it per task. */
export const DEFAULT_MODEL = "claude-haiku-5-5";

/** Medium on both, as the routes have always asked for: a study's depth comes
 *  from its eleven-section structure, not from a long think. */
export const DEFAULT_EFFORT: Effort = "medium";

type Env = Record<string, string | undefined>;

export function modelFor(task: Task, env: Env = process.env): string {
  const own = env[`SPINDLE_${task.toUpperCase()}_MODEL`]?.trim();
  const shared = env.ANTHROPIC_MODEL?.trim();
  return own || shared || DEFAULT_MODEL;
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
