import type { Ingredient, Meal } from "@/types";

const UNIT_ALIASES: Record<string, string> = {
  gram: "g", grams: "g", kilogram: "kg", kilograms: "kg",
  millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  litre: "l", litres: "l", liter: "l", liters: "l",
  ounce: "oz", ounces: "oz", pound: "lb", pounds: "lb", lbs: "lb",
  tablespoon: "tbsp", tablespoons: "tbsp", teaspoon: "tsp", teaspoons: "tsp",
  cup: "cup", cups: "cup", "fluid ounce": "fl oz", "fluid ounces": "fl oz",
  pint: "pint", pints: "pint", quart: "quart", quarts: "quart", gallon: "gallon", gallons: "gallon",
  piece: "pc", pieces: "pc", pcs: "pc",
};

function rounded(value: number) {
  return Number(value.toFixed(1));
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

function numericAmount(value: string) {
  const normalized = value.trim();
  const unicodeFraction = normalized.match(/^([0-9]+)?\s*([¼½¾⅓⅔])$/);
  if (unicodeFraction) return Number(unicodeFraction[1] ?? 0) + UNICODE_FRACTIONS[unicodeFraction[2]];
  const mixedFraction = normalized.match(/^([0-9]+)\s+([0-9]+)\/([0-9]+)$/);
  if (mixedFraction) return Number(mixedFraction[1]) + Number(mixedFraction[2]) / Number(mixedFraction[3]);
  const fraction = normalized.match(/^([0-9]+)\/([0-9]+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(normalized);
}

export function metricQuantity(amount: number, unit: string) {
  const cleaned = unit.normalize("NFKC").trim().toLowerCase().replace(/\.$/, "");
  const normalized = UNIT_ALIASES[cleaned] ?? cleaned;
  if (normalized === "kg") return { amount: rounded(amount * 1_000), unit: "g" };
  if (normalized === "oz") return { amount: rounded(amount * 28.3495), unit: "g" };
  if (normalized === "lb") return { amount: rounded(amount * 453.592), unit: "g" };
  if (normalized === "l") return { amount: rounded(amount * 1_000), unit: "ml" };
  if (normalized === "tsp") return { amount: rounded(amount * 5), unit: "ml" };
  if (normalized === "tbsp") return { amount: rounded(amount * 15), unit: "ml" };
  if (normalized === "cup") return { amount: rounded(amount * 240), unit: "ml" };
  if (normalized === "fl oz") return { amount: rounded(amount * 29.5735), unit: "ml" };
  if (normalized === "pint") return { amount: rounded(amount * 473.176), unit: "ml" };
  if (normalized === "quart") return { amount: rounded(amount * 946.353), unit: "ml" };
  if (normalized === "gallon") return { amount: rounded(amount * 3_785.41), unit: "ml" };
  return { amount: rounded(amount), unit: normalized };
}

export function metricDisplayQuantity(amount: number, unit: string) {
  const metric = metricQuantity(amount, unit);
  if (metric.unit === "g" && metric.amount >= 1_000) return { amount: rounded(metric.amount / 1_000), unit: "kg" };
  if (metric.unit === "ml" && metric.amount >= 1_000) return { amount: rounded(metric.amount / 1_000), unit: "l" };
  return metric;
}

export function formatMetricQuantity(amount: number, unit: string) {
  const metric = metricDisplayQuantity(amount, unit);
  const value = Number.isInteger(metric.amount) ? String(metric.amount) : metric.amount.toFixed(1).replace(/\.0$/, "");
  if (metric.unit === "pc") return `${value} ${metric.amount === 1 ? "piece" : "pieces"}`;
  return `${value} ${metric.unit}`;
}

export function metricIngredient(ingredient: Ingredient): Ingredient {
  const metric = metricQuantity(ingredient.amount, ingredient.unit);
  return { ...ingredient, ...metric };
}

export function metricInstruction(value: string) {
  const quantities = value.replace(
    /(?:\b\d+\s+\d+\/\d+|\b\d+\/\d+|\b\d+(?:\.\d+)?|(?:\d+\s*)?[¼½¾⅓⅔])\s*(fluid ounces?|fl\.?\s*oz\.?|ounces?|oz\.?|pounds?|lbs?\.?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|pints?|quarts?|gallons?)\b/gi,
    (match) => {
      const parsed = match.match(/^(.+?)\s*(fluid ounces?|fl\.?\s*oz\.?|ounces?|oz\.?|pounds?|lbs?\.?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cups?|pints?|quarts?|gallons?)$/i);
      return parsed ? formatMetricQuantity(numericAmount(parsed[1]), parsed[2]) : match;
    },
  );
  return quantities.replace(
    /\b(\d{2,3})\s*(?:°\s*)?(?:degrees?\s*)?(?:f|fahrenheit)\b/gi,
    (_match, fahrenheit: string) => `${Math.round((((Number(fahrenheit) - 32) * 5) / 9) / 5) * 5}°C`,
  );
}

export function metricMeal(meal: Meal): Meal {
  return {
    ...meal,
    description: metricInstruction(meal.description),
    ingredients: meal.ingredients.map(metricIngredient),
    instructions: meal.instructions?.map(metricInstruction),
    safetyNotes: meal.safetyNotes?.map(metricInstruction),
  };
}
