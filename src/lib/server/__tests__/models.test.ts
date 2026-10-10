import { describe, it, expect } from "vitest";
import {
  CAREFUL_MODEL,
  DEFAULT_EFFORT,
  EVERYDAY_MODEL,
  effortFor,
  isAboutTalks,
  routeFor,
} from "../models";

describe("routeFor, with nothing set in Vercel", () => {
  it("prepares a study with Haiku 5.5, stepping up to Sonnet 5.5", () => {
    expect(routeFor("study", "", {})).toEqual({ first: EVERYDAY_MODEL, stepUp: CAREFUL_MODEL });
    expect(EVERYDAY_MODEL).toBe("claude-haiku-5-5");
    expect(CAREFUL_MODEL).toBe("claude-sonnet-5-5");
  });
  it("prepares a plan about talks with Sonnet 5.5 from the start", () => {
    expect(routeFor("plan", "Elder Neal A. Maxwell's best-known conference talks", {})).toEqual({
      first: CAREFUL_MODEL,
    });
  });
  it("prepares a scripture plan with Haiku 5.5, stepping up to Sonnet 5.5", () => {
    expect(routeFor("plan", "Mercy across all four standard works", {})).toEqual({
      first: EVERYDAY_MODEL,
      stepUp: CAREFUL_MODEL,
    });
  });
});

describe("routeFor, overridden in Vercel", () => {
  it("uses a task's own setting first, for every request", () => {
    const env = { SPINDLE_PLAN_MODEL: "claude-haiku-5-5" };
    expect(routeFor("plan", "Last general conference, one talk per day", env).first).toBe("claude-haiku-5-5");
  });
  it("uses ANTHROPIC_MODEL for both when the task has no setting", () => {
    const env = { ANTHROPIC_MODEL: "claude-sonnet-5" };
    expect(routeFor("study", "", env).first).toBe("claude-sonnet-5");
    expect(routeFor("plan", "Mercy", env).first).toBe("claude-sonnet-5");
  });
  it("steps up to whatever SPINDLE_STEP_UP_MODEL names", () => {
    expect(routeFor("study", "", { SPINDLE_STEP_UP_MODEL: "claude-opus-5-5" }).stepUp).toBe("claude-opus-5-5");
  });
  it("does not step up to the model it started with", () => {
    expect(routeFor("study", "", { SPINDLE_STUDY_MODEL: CAREFUL_MODEL })).toEqual({ first: CAREFUL_MODEL });
  });
  it("ignores a setting left blank", () => {
    expect(routeFor("study", "", { SPINDLE_STUDY_MODEL: "  " }).first).toBe(EVERYDAY_MODEL);
  });
});

describe("isAboutTalks", () => {
  it.each([
    "Elder Neal A. Maxwell's best-known conference talks",
    "Last general conference, one talk per day",
    "What President Nelson has taught about joy",
    "The April 2024 sessions",
    "Sister Johnson's devotional on covenants",
    "What the apostles have said about the Sabbath",
  ])("treats %j as about talks", (request) => {
    expect(isAboutTalks(request)).toBe(true);
  });
  it.each([
    "Mercy across all four standard works",
    "The Savior's teachings in 3 Nephi, one chapter a day",
    "Read the Book of Mormon in 90 days",
    "Faith in Hebrews 11 and Alma 32",
  ])("treats %j as a scripture plan", (request) => {
    expect(isAboutTalks(request)).toBe(false);
  });
});

describe("effortFor", () => {
  it("defaults to medium, as the routes always asked for", () => {
    expect(effortFor("study", EVERYDAY_MODEL, {})).toBe(DEFAULT_EFFORT);
    expect(DEFAULT_EFFORT).toBe("medium");
  });
  it("takes a per-task setting, in any case", () => {
    expect(effortFor("plan", EVERYDAY_MODEL, { SPINDLE_PLAN_EFFORT: "LOW" })).toBe("low");
  });
  it("falls back to the default for a value the API would reject", () => {
    expect(effortFor("study", CAREFUL_MODEL, { SPINDLE_STUDY_EFFORT: "extreme" })).toBe(DEFAULT_EFFORT);
  });
  it("sends no effort at all to Haiku 4.5, which errors on it", () => {
    expect(effortFor("study", "claude-haiku-4-5", { SPINDLE_STUDY_EFFORT: "high" })).toBeUndefined();
  });
});
