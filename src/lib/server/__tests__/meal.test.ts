import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MEAL_MODEL, MealEstimateSchema, mealModel, tidy } = await import("@/lib/server/meal");
const { appId } = await import("@/lib/server/appDb");

const estimate = {
  isFood: true,
  name: " Salmon, rice and broccoli ",
  items: [{ name: "Salmon", calories: 367.4, protein: 39.6, sugar: 0 }],
  calories: 652.6,
  protein: 46.2,
  sugar: 3.8,
  caloriesLow: 700,
  caloriesHigh: 600,
  confidence: "medium" as const,
};

describe("meal estimates", () => {
  it("accepts the shape the model is asked for", () => {
    expect(MealEstimateSchema.safeParse(estimate).success).toBe(true);
    expect(MealEstimateSchema.safeParse({ ...estimate, confidence: "certain" }).success).toBe(false);
  });

  it("rounds, trims, and keeps the estimate inside its own range", () => {
    const tidied = tidy(estimate);
    expect(tidied.name).toBe("Salmon, rice and broccoli");
    expect(tidied.calories).toBe(653);
    expect(tidied.protein).toBe(46);
    expect(tidied.caloriesLow).toBeLessThanOrEqual(tidied.calories);
    expect(tidied.caloriesHigh).toBeGreaterThanOrEqual(tidied.calories);
    expect(tidied.items[0]).toEqual({ name: "Salmon", calories: 367, protein: 40, sugar: 0 });
  });

  it("never goes negative", () => {
    expect(tidy({ ...estimate, sugar: -2 }).sugar).toBe(0);
  });

  it("uses the configured model, or the default", () => {
    expect(mealModel({})).toBe(MEAL_MODEL);
    expect(mealModel({ STACKD_MEAL_MODEL: "claude-haiku-5-5" })).toBe("claude-haiku-5-5");
  });
});

describe("app IDs", () => {
  it("names each app's own App ID, Spindle by default", () => {
    process.env.APPLE_TEAM_ID = "TEAM123456";
    expect(appId()).toBe("TEAM123456.com.wpv.spindle");
    expect(appId("stackd")).toBe("TEAM123456.com.wpv.stackd");
  });
});
