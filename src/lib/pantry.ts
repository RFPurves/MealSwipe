import type { PantryItem } from "@/types";

const SINGULARS: Record<string, string> = {
  beans: "bean",
  berries: "berry",
  cloves: "clove",
  eggs: "egg",
  leaves: "leaf",
  potatoes: "potato",
  tomatoes: "tomato",
};

const UNIT_ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  piece: "pc",
  pieces: "pc",
  pcs: "pc",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
};

export function normalizePantryName(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/yoghurt/g, "yogurt")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length) words[words.length - 1] = SINGULARS[words.at(-1) ?? ""] ?? words.at(-1) ?? "";
  return words.join(" ");
}

export function normalizePantryUnit(value?: string | null) {
  const normalized = value?.normalize("NFKC").trim().toLowerCase().replace(/\.$/, "") ?? "";
  return UNIT_ALIASES[normalized] ?? normalized;
}

function ingredientCoveredByName(pantryName: string, ingredientName: string) {
  if (pantryName === ingredientName) return true;
  if (pantryName === "rice") {
    return /^(?:arborio|basmati|brown|jasmine|long grain|sushi|white|wild) rice$/.test(ingredientName);
  }
  return false;
}

export function pantryMatch(item: PantryItem, ingredientName: string) {
  return ingredientCoveredByName(
    item.normalizedName ?? normalizePantryName(item.name),
    normalizePantryName(ingredientName),
  );
}

export function canSubtractPantryQuantity(item: PantryItem, ingredientName: string, ingredientUnit?: string) {
  return item.quantity !== undefined
    && item.quantity !== null
    && (item.normalizedName ?? normalizePantryName(item.name)) === normalizePantryName(ingredientName)
    && Boolean(normalizePantryUnit(item.unit))
    && normalizePantryUnit(item.unit) === normalizePantryUnit(ingredientUnit);
}

export function pantryItemFromRow(row: {
  id: string;
  normalizedName: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  source: string;
}): PantryItem {
  const source = row.source === "CAMERA" ? "camera"
    : row.source === "BARCODE" ? "barcode"
      : row.source === "AI_DETECTED" ? "ai-detected"
        : "manual";
  return {
    id: row.id,
    name: row.displayName,
    normalizedName: row.normalizedName,
    quantity: row.quantity,
    unit: row.unit,
    source,
    confirmed: true,
  };
}
