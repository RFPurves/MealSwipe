import { meals } from "@/data/meals";
import { mealIsSafe, mealMatchesCategories } from "@/lib/meal-safety";
import type {
  Meal,
  Preferences,
  ShoppingCategory,
  ShoppingItem,
  Weekday,
} from "@/types";

export const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
  "Other",
];

const DAIRY_TERMS = [
  "parmesan",
  "cream",
  "feta",
  "greek yogurt",
  "mozzarella",
  "cheddar",
];
const PROTEIN_TERMS = [
  "chicken",
  "salmon",
  "tofu",
  "turkey",
  "shrimp",
  "tuna",
  "beef",
  "eggs",
  "falafel",
];
const GRAIN_TERMS = [
  "rice",
  "orzo",
  "rigatoni",
  "noodles",
  "couscous",
  "gnocchi",
  "bulgur",
  "sourdough",
  "tortilla",
  "pizza base",
];
const PRODUCE_TERMS = [
  "spinach",
  "lemon",
  "lime",
  "avocado",
  "cucumber",
  "pepper",
  "corn",
  "tomato",
  "basil",
  "herbs",
  "peas",
  "garlic",
  "mushroom",
  "thyme",
  "onion",
  "zucchini",
  "olives",
];
const PANTRY_TERMS = [
  "miso",
  "soy sauce",
  "harissa",
  "chickpeas",
  "beans",
  "coconut milk",
  "crushed tomatoes",
  "stock",
  "tahini",
  "pesto",
  "sriracha",
];

function stableVariation(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function ingredientKey(name: string) {
  return name.trim().toLowerCase();
}

function scoreCandidate({
  meal,
  savedIds,
  selectedMeals,
  ingredientUse,
  preferences,
  revision,
  dayIndex,
}: {
  meal: Meal;
  savedIds: Set<string>;
  selectedMeals: Meal[];
  ingredientUse: Map<string, number>;
  preferences: Preferences;
  revision: number;
  dayIndex: number;
}) {
  const timesSelected = selectedMeals.filter((selected) => selected.id === meal.id).length;
  const selectedCategories = new Set(selectedMeals.map((selected) => selected.category));
  const overlapCount = meal.ingredients.reduce(
    (count, ingredient) => count + (ingredientUse.has(ingredientKey(ingredient.name)) ? 1 : 0),
    0,
  );

  let score = 0;
  if (savedIds.has(meal.id) && timesSelected === 0) score += 125;
  if (meal.sourceType === "youtube" && savedIds.has(meal.id)) score += 34;
  if (timesSelected === 0) score += 62;
  if (mealMatchesCategories(meal, preferences)) score += 24;
  if (!selectedCategories.has(meal.category)) score += 8;
  score += overlapCount * 11;
  score -= timesSelected * 115;
  if (selectedMeals.at(-1)?.id === meal.id) score -= 80;
  score += stableVariation(`${meal.id}-${revision}-${dayIndex}`) * 7;

  return score;
}

export function getSafeMealPool(preferences: Preferences, dynamicMeals: Meal[] = []) {
  return [...dynamicMeals, ...meals].filter((meal) => mealIsSafe(meal, preferences));
}

export function generateWeeklyPlan(
  savedMealIds: string[],
  preferences: Preferences,
  revision: number,
  dynamicMeals: Meal[] = [],
) {
  const safeMeals = getSafeMealPool(preferences, dynamicMeals);
  if (safeMeals.length === 0) return [];

  const savedIds = new Set(savedMealIds);
  const selectedMeals: Meal[] = [];
  const ingredientUse = new Map<string, number>();

  for (let dayIndex = 0; dayIndex < WEEKDAYS.length; dayIndex += 1) {
    const ranked = safeMeals
      .map((meal) => ({
        meal,
        score: scoreCandidate({
          meal,
          savedIds,
          selectedMeals,
          ingredientUse,
          preferences,
          revision,
          dayIndex,
        }),
      }))
      .sort((first, second) => second.score - first.score);

    const selected = ranked[0].meal;
    selectedMeals.push(selected);
    selected.ingredients.forEach((ingredient) => {
      const key = ingredientKey(ingredient.name);
      ingredientUse.set(key, (ingredientUse.get(key) ?? 0) + 1);
    });
  }

  return selectedMeals.map((meal) => meal.id);
}

export function findReplacementMeal(
  currentMeals: Meal[],
  dayIndex: number,
  savedMealIds: string[],
  preferences: Preferences,
  revision: number,
  dynamicMeals: Meal[] = [],
) {
  const safeMeals = getSafeMealPool(preferences, dynamicMeals);
  if (safeMeals.length === 0) return undefined;

  const currentMeal = currentMeals[dayIndex];
  const otherMeals = currentMeals.filter((_, index) => index !== dayIndex);
  const otherIds = new Set(otherMeals.map((meal) => meal.id));
  const savedIds = new Set(savedMealIds);
  const ingredientUse = new Map<string, number>();

  otherMeals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = ingredientKey(ingredient.name);
      ingredientUse.set(key, (ingredientUse.get(key) ?? 0) + 1);
    });
  });

  return safeMeals
    .filter((meal) => meal.id !== currentMeal?.id)
    .map((meal) => {
      const baseScore = scoreCandidate({
        meal,
        savedIds,
        selectedMeals: otherMeals,
        ingredientUse,
        preferences,
        revision,
        dayIndex,
      });
      return { meal, score: baseScore - (otherIds.has(meal.id) ? 55 : 0) };
    })
    .sort((first, second) => second.score - first.score)[0]?.meal;
}

export function getIngredientReuseStats(planMeals: Meal[]) {
  const useCounts = new Map<string, { name: string; count: number }>();

  planMeals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = ingredientKey(ingredient.name);
      const existing = useCounts.get(key);
      useCounts.set(key, {
        name: ingredient.name,
        count: (existing?.count ?? 0) + 1,
      });
    });
  });

  const sharedIngredients = [...useCounts.values()]
    .filter((ingredient) => ingredient.count > 1)
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));

  return {
    sharedIngredientCount: sharedIngredients.length,
    reusedOccurrences: sharedIngredients.reduce(
      (total, ingredient) => total + ingredient.count - 1,
      0,
    ),
    sharedIngredients,
  };
}

function shoppingCategoryFor(name: string): ShoppingCategory {
  const normalized = name.toLowerCase();
  if (DAIRY_TERMS.some((term) => normalized.includes(term))) return "Dairy";
  if (PROTEIN_TERMS.some((term) => normalized.includes(term))) return "Protein";
  if (GRAIN_TERMS.some((term) => normalized.includes(term))) return "Grains";
  if (PRODUCE_TERMS.some((term) => normalized.includes(term))) return "Produce";
  if (PANTRY_TERMS.some((term) => normalized.includes(term))) return "Pantry";
  return "Other";
}

function normalizedUnit(unit: string) {
  return unit === "pcs" ? "pc" : unit;
}

export function buildShoppingList(planMeals: Meal[]): ShoppingItem[] {
  const combined = new Map<
    string,
    ShoppingItem & { units: Set<string>; amountTotal: number }
  >();

  planMeals.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const key = ingredientKey(ingredient.name);
      const unit = normalizedUnit(ingredient.unit);
      const existing = combined.get(key);

      if (existing) {
        existing.mealCount += 1;
        existing.units.add(unit);
        existing.amountTotal += ingredient.amount;
        return;
      }

      combined.set(key, {
        name: ingredient.name,
        category: shoppingCategoryFor(ingredient.name),
        mealCount: 1,
        units: new Set([unit]),
        amountTotal: ingredient.amount,
      });
    });
  });

  return [...combined.values()]
    .map(({ units, amountTotal, ...item }) => ({
      ...item,
      amount: units.size === 1 ? amountTotal : undefined,
      unit: units.size === 1 ? [...units][0] : undefined,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function formatShoppingAmount(item: ShoppingItem) {
  if (item.amount === undefined || !item.unit) return undefined;
  const amount = Number.isInteger(item.amount)
    ? item.amount.toString()
    : item.amount.toFixed(1).replace(/\.0$/, "");

  if (item.unit === "pc") return `${amount} ${item.amount === 1 ? "piece" : "pieces"}`;
  return `${amount} ${item.unit}`;
}
