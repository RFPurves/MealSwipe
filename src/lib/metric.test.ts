import { describe, expect, it } from "vitest";
import { formatMetricQuantity, metricInstruction, metricQuantity } from "@/lib/metric";
import { buildShoppingList, formatShoppingAmount } from "@/lib/meal-planner";
import type { Meal, PantryItem } from "@/types";

describe("metric quantities", () => {
  it("converts imperial mass and volume to metric base units", () => {
    expect(metricQuantity(2, "lb")).toEqual({ amount: 907.2, unit: "g" });
    expect(metricQuantity(1, "cup")).toEqual({ amount: 240, unit: "ml" });
    expect(metricQuantity(2, "tbsp")).toEqual({ amount: 30, unit: "ml" });
  });

  it("uses readable kilograms and litres for display", () => {
    expect(formatMetricQuantity(1_300, "g")).toBe("1.3 kg");
    expect(formatMetricQuantity(1_500, "ml")).toBe("1.5 l");
  });

  it("converts imperial quantities and oven temperatures in instructions", () => {
    expect(metricInstruction("Bake at 350°F with 2 tablespoons oil."))
      .toBe("Bake at 175°C with 30 ml oil.");
    expect(metricInstruction("Stir in 1 1/2 cups stock and ½ cup cream."))
      .toBe("Stir in 360 ml stock and 120 ml cream.");
  });

  it("combines and subtracts legacy quantities in metric units", () => {
    const meal = {
      ingredients: [{ name: "rice", amount: 1, unit: "lb" }],
    } as Meal;
    const pantry = [{ id: "rice", name: "rice", quantity: 200, unit: "g", source: "manual", confirmed: true }] as PantryItem[];
    const [rice] = buildShoppingList([meal], pantry);
    expect(rice).toMatchObject({ amount: 253.6, unit: "g", inPantry: false });
    expect(formatShoppingAmount(rice)).toBe("253.6 g");
  });
});
