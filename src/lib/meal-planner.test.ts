import { describe, expect, it } from "vitest";
import { generateWeeklyPlan } from "@/lib/meal-planner";
import type { Household, Preferences } from "@/types";

const preferences: Preferences = { dietary: "Everything", allergies: [], dislikedIngredients: [], categories: [] };
const household: Household = {
  name: "Test household",
  members: [
    { id: "one", name: "Rab", username: "rab", dietary: "Everything", allergies: [], dislikedIngredients: [], nutritionPreference: "Balanced" },
    { id: "two", name: "Sonia", username: "sonia", dietary: "Everything", allergies: [], dislikedIngredients: [], nutritionPreference: "Balanced" },
  ],
  settings: { adults: 2, children: 0, dinnersPerWeek: 7, maximumCookingTime: 60 },
};

describe("shared household planning", () => {
  it("prioritizes a meal liked by both members", () => {
    const plan = generateWeeklyPlan([], preferences, 1, [], { household, householdLikes: { "miso-salmon-bowl": ["rab", "sonia"] } });
    expect(plan[0]).toBe("miso-salmon-bowl");
  });

  it("never lets shared likes override a member allergy", () => {
    const soySafeHousehold: Household = {
      ...household,
      members: household.members.map((member, index) => index ? { ...member, allergies: ["Soy"] } : member),
    };
    const plan = generateWeeklyPlan([], preferences, 1, [], { household: soySafeHousehold, householdLikes: { "miso-salmon-bowl": ["rab", "sonia"] } });
    expect(plan).not.toContain("miso-salmon-bowl");
  });
});
