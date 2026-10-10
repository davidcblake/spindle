import { describe, it, expect } from "vitest";
import { DEFAULT_EFFORT, DEFAULT_MODEL, effortFor, modelFor } from "../models";

describe("modelFor", () => {
  it("uses Spindle's default when nothing is set", () => {
    expect(modelFor("study", {})).toBe(DEFAULT_MODEL);
  });
  it("uses ANTHROPIC_MODEL for both tasks when only it is set", () => {
    const env = { ANTHROPIC_MODEL: "claude-sonnet-5-5" };
    expect(modelFor("study", env)).toBe("claude-sonnet-5-5");
    expect(modelFor("plan", env)).toBe("claude-sonnet-5-5");
  });
  it("lets each task have its own model, ahead of the shared one", () => {
    const env = { ANTHROPIC_MODEL: "claude-sonnet-5", SPINDLE_STUDY_MODEL: "claude-haiku-5-5" };
    expect(modelFor("study", env)).toBe("claude-haiku-5-5");
    expect(modelFor("plan", env)).toBe("claude-sonnet-5");
  });
  it("ignores a setting left blank", () => {
    expect(modelFor("plan", { SPINDLE_PLAN_MODEL: "  " })).toBe(DEFAULT_MODEL);
  });
});

describe("effortFor", () => {
  it("defaults to medium, as the routes always asked for", () => {
    expect(effortFor("study", "claude-sonnet-5", {})).toBe(DEFAULT_EFFORT);
    expect(DEFAULT_EFFORT).toBe("medium");
  });
  it("takes a per-task setting, in any case", () => {
    expect(effortFor("plan", "claude-haiku-5-5", { SPINDLE_PLAN_EFFORT: "LOW" })).toBe("low");
  });
  it("falls back to the default for a value the API would reject", () => {
    expect(effortFor("study", "claude-sonnet-5", { SPINDLE_STUDY_EFFORT: "extreme" })).toBe(DEFAULT_EFFORT);
  });
  it("sends no effort at all to Haiku 4.5, which errors on it", () => {
    expect(effortFor("study", "claude-haiku-4-5", { SPINDLE_STUDY_EFFORT: "high" })).toBeUndefined();
  });
});
