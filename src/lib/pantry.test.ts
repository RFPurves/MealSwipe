import { describe, expect, it } from "vitest";
import { buildShoppingList } from "@/lib/meal-planner";
import { normalizePantryName } from "@/lib/pantry";
import type { Meal, PantryItem } from "@/types";

const meal: Meal = {
  id: "pantry-test",
  title: "Rice bowl",
  description: "Test meal",
  image: "/test.jpg",
  category: "Asian",
  categories: ["Asian"],
  timeMinutes: 20,
  calories: 500,
  proteinGrams: 20,
  servings: 2,
  dietary: [],
  allergens: [],
  ingredients: [
    { name: "jasmine rice", amount: 300, unit: "g" },
    { name: "Greek yoghurt", amount: 100, unit: "g" },
  ],
};

function pantry(overrides: Partial<PantryItem> & Pick<PantryItem, "id" | "name">): PantryItem {
  return { source: "manual", confirmed: true, ...overrides };
}

describe("shared pantry normalization and shopping-list coverage", () => {
  it("normalizes case, spacing, spelling variants, and obvious plurals", () => {
    expect(normalizePantryName("  GREEK   Yoghurt ")).toBe("greek yogurt");
    expect(normalizePantryName("Eggs")).toBe("egg");
    expect(normalizePantryName("Tomatoes")).toBe("tomato");
    expect(normalizePantryName("Canned beans")).toBe("canned bean");
  });

  it("uses unquantified generic rice and subtracts only a compatible exact quantity", () => {
    const items = buildShoppingList([meal], [
      pantry({ id: "rice", name: "Rice", normalizedName: "rice" }),
      pantry({ id: "yogurt", name: "Greek yogurt", normalizedName: "greek yogurt", quantity: 40, unit: "grams" }),
    ]);
    expect(items.find((item) => item.name === "jasmine rice")?.inPantry).toBe(true);
    expect(items.find((item) => item.name === "Greek yoghurt")).toMatchObject({ amount: 60, unit: "g", inPantry: false });
  });

  it("does not invent conversions when units are incompatible", () => {
    const items = buildShoppingList([meal], [
      pantry({ id: "yogurt", name: "Greek yogurt", normalizedName: "greek yogurt", quantity: 100, unit: "ml" }),
      pantry({ id: "rice", name: "Rice", normalizedName: "rice", unit: "ml" }),
    ]);
    expect(items.find((item) => item.name === "Greek yoghurt")).toMatchObject({ amount: 100, unit: "g", inPantry: false });
    expect(items.find((item) => item.name === "jasmine rice")).toMatchObject({ amount: 300, unit: "g", inPantry: false });
  });

  it("marks an ingredient covered when the matching quantity is sufficient", () => {
    const items = buildShoppingList([meal], [
      pantry({ id: "yogurt", name: "Greek yogurt", normalizedName: "greek yogurt", quantity: 100, unit: "g" }),
    ]);
    expect(items.find((item) => item.name === "Greek yoghurt")?.inPantry).toBe(true);
  });
});
