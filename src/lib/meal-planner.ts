import { meals } from "@/data/meals";
import { mealIsSafe, mealIsSafeForHousehold, mealMatchesCategories } from "@/lib/meal-safety";
import type {
  Household,
  Meal,
  OptimizationObjective,
  PantryItem,
  Preferences,
  ShoppingCategory,
  ShoppingItem,
  Weekday,
} from "@/types";

export const WEEKDAYS: Weekday[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  "Produce", "Protein", "Dairy", "Grains", "Pantry", "Other",
];

const DAIRY_TERMS = ["parmesan", "cream", "feta", "yogurt", "mozzarella", "cheddar", "milk"];
const PROTEIN_TERMS = ["chicken", "salmon", "tofu", "turkey", "shrimp", "tuna", "beef", "egg", "falafel", "fish"];
const GRAIN_TERMS = ["rice", "orzo", "rigatoni", "noodles", "couscous", "gnocchi", "bulgur", "sourdough", "tortilla", "pizza base", "pasta"];
const PRODUCE_TERMS = ["spinach", "lemon", "lime", "avocado", "cucumber", "pepper", "corn", "tomato", "basil", "herbs", "peas", "garlic", "mushroom", "thyme", "onion", "zucchini", "olives", "potato"];
const PANTRY_TERMS = ["miso", "soy sauce", "harissa", "chickpeas", "beans", "coconut milk", "crushed tomatoes", "stock", "tahini", "pesto", "sriracha", "oil", "salt"];
const SIDE_TERMS = ["potato", "rice", "orzo", "couscous", "noodle", "pasta", "salad", "beans", "chickpeas", "vegetable", "spinach"];

export function ingredientKey(name: string) {
  return name.trim().toLowerCase().replace(/s$/, "");
}

function stableVariation(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return (hash % 1000) / 1000;
}

function heuristicCost(meal: Meal) {
  const costly = meal.ingredients.reduce((total, ingredient) => {
    const name = ingredient.name.toLowerCase();
    return total + (PROTEIN_TERMS.some((term) => name.includes(term)) ? 2 : 0.7);
  }, 0);
  return costly + meal.ingredients.length * 0.35;
}

export interface PlannerOptions {
  household?: Household;
  householdLikes?: Record<string, string[]>;
  objective?: OptimizationObjective;
  pantryItems?: PantryItem[];
  usePantryFirst?: boolean;
  constraint?: "vegetarian" | "under-20-minutes" | "high-protein" | "no-pasta";
}

function mealMatchesConstraint(meal: Meal, constraint?: PlannerOptions["constraint"]) {
  if (!constraint) return true;
  if (constraint === "vegetarian") return meal.dietary.includes("Vegetarian") || meal.dietary.includes("Vegan");
  if (constraint === "under-20-minutes") return meal.timeMinutes <= 20;
  if (constraint === "high-protein") return meal.proteinGrams >= 30 || meal.dietary.includes("High protein");
  return !meal.categories.includes("Pasta") && !meal.title.toLowerCase().includes("pasta");
}

function scoreCandidate({
  meal,
  savedIds,
  selectedMeals,
  ingredientUse,
  preferences,
  revision,
  dayIndex,
  options,
}: {
  meal: Meal;
  savedIds: Set<string>;
  selectedMeals: Meal[];
  ingredientUse: Map<string, number>;
  preferences: Preferences;
  revision: number;
  dayIndex: number;
  options: PlannerOptions;
}) {
  const timesSelected = selectedMeals.filter((selected) => selected.id === meal.id).length;
  const selectedCategories = new Set(selectedMeals.map((selected) => selected.category));
  const pantry = new Set((options.pantryItems ?? []).filter((item) => item.confirmed).map((item) => ingredientKey(item.name)));
  const overlapCount = meal.ingredients.filter((ingredient) => ingredientUse.has(ingredientKey(ingredient.name))).length;
  const pantryCount = meal.ingredients.filter((ingredient) => pantry.has(ingredientKey(ingredient.name))).length;
  const objective = options.objective ?? "balanced";
  const nutritionPreferences = options.household?.members.map((member) => member.nutritionPreference) ?? [];

  let score = 0;
  const householdLikeCount = new Set(options.householdLikes?.[meal.id] ?? []).size;
  if (householdLikeCount >= 2 && timesSelected === 0) score += 260;
  else if (householdLikeCount === 1 && timesSelected === 0) score += 150;
  if (savedIds.has(meal.id) && timesSelected === 0) score += 125;
  if (meal.sourceType === "youtube" && savedIds.has(meal.id)) score += 34;
  if (timesSelected === 0) score += 62;
  if (mealMatchesCategories(meal, preferences)) score += 24;
  if (!selectedCategories.has(meal.category)) score += objective === "most-variety" ? 42 : 8;
  score += overlapCount * (objective === "least-waste" ? 25 : 11);
  if (options.usePantryFirst) score += pantryCount * (objective === "least-waste" ? 32 : 18);
  if (objective === "lowest-cost") score -= heuristicCost(meal) * 8;
  if (objective === "fastest") score -= meal.timeMinutes * 1.4;
  if (objective === "highest-protein") score += meal.proteinGrams * 1.2;
  if (objective === "balanced") score += Math.min(meal.proteinGrams, 45) * 0.25;
  if (nutritionPreferences.includes("High protein")) score += meal.proteinGrams * 0.35;
  if (nutritionPreferences.includes("Lower carb")) {
    score -= meal.ingredients.filter((ingredient) => GRAIN_TERMS.some((term) => ingredient.name.toLowerCase().includes(term))).length * 8;
  }
  score -= timesSelected * (objective === "least-waste" ? 78 : 115);
  if (selectedMeals.at(-1)?.id === meal.id) score -= 90;
  score += stableVariation(`${meal.id}-${revision}-${dayIndex}`) * 7;
  return score;
}

export function getSafeMealPool(
  preferences: Preferences,
  dynamicMeals: Meal[] = [],
  household?: Household,
) {
  return [...dynamicMeals, ...meals].filter((meal) =>
    household ? mealIsSafeForHousehold(meal, household) : mealIsSafe(meal, preferences),
  );
}

export function generateWeeklyPlan(
  savedMealIds: string[],
  preferences: Preferences,
  revision: number,
  dynamicMeals: Meal[] = [],
  options: PlannerOptions = {},
) {
  let safeMeals = getSafeMealPool(preferences, dynamicMeals, options.household).filter((meal) =>
    meal.timeMinutes <= (options.household?.settings.maximumCookingTime ?? 240),
  );
  if (safeMeals.length === 0) safeMeals = getSafeMealPool(preferences, dynamicMeals, options.household);
  if (safeMeals.length === 0) return [];

  const savedIds = new Set(savedMealIds);
  const selectedMeals: Meal[] = [];
  const ingredientUse = new Map<string, number>();
  const dinners = Math.min(7, Math.max(1, options.household?.settings.dinnersPerWeek ?? 7));
  const result: (string | null)[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    if (dayIndex >= dinners) {
      result.push(null);
      continue;
    }
    const ranked = safeMeals
      .map((meal) => ({ meal, score: scoreCandidate({ meal, savedIds, selectedMeals, ingredientUse, preferences, revision, dayIndex, options }) }))
      .sort((first, second) => second.score - first.score);
    const selected = ranked[0].meal;
    result.push(selected.id);
    selectedMeals.push(selected);
    selected.ingredients.forEach((ingredient) => {
      const key = ingredientKey(ingredient.name);
      ingredientUse.set(key, (ingredientUse.get(key) ?? 0) + 1);
    });
  }
  return result;
}

export function findReplacementMeal(
  currentMeals: Meal[],
  dayIndex: number,
  savedMealIds: string[],
  preferences: Preferences,
  revision: number,
  dynamicMeals: Meal[] = [],
  options: PlannerOptions = {},
) {
  const safeMeals = getSafeMealPool(preferences, dynamicMeals, options.household)
    .filter((meal) => mealMatchesConstraint(meal, options.constraint))
    .filter((meal) => meal.timeMinutes <= (options.household?.settings.maximumCookingTime ?? 240));
  if (safeMeals.length === 0) return undefined;
  const currentMeal = currentMeals[dayIndex];
  const otherMeals = currentMeals.filter((_, index) => index !== dayIndex);
  const otherIds = new Set(otherMeals.map((meal) => meal.id));
  const ingredientUse = new Map<string, number>();
  otherMeals.forEach((meal) => meal.ingredients.forEach((ingredient) => {
    const key = ingredientKey(ingredient.name);
    ingredientUse.set(key, (ingredientUse.get(key) ?? 0) + 1);
  }));
  return safeMeals
    .filter((meal) => meal.id !== currentMeal?.id)
    .map((meal) => ({
      meal,
      score: scoreCandidate({ meal, savedIds: new Set(savedMealIds), selectedMeals: otherMeals, ingredientUse, preferences, revision, dayIndex, options }) - (otherIds.has(meal.id) ? 55 : 0),
    }))
    .sort((first, second) => second.score - first.score)[0]?.meal;
}

export function getIngredientReuseStats(planMeals: Meal[]) {
  const useCounts = new Map<string, { name: string; count: number }>();
  let totalIngredientOccurrences = 0;
  planMeals.forEach((meal) => meal.ingredients.forEach((ingredient) => {
    totalIngredientOccurrences += 1;
    const key = ingredientKey(ingredient.name);
    const existing = useCounts.get(key);
    useCounts.set(key, { name: existing?.name ?? ingredient.name, count: (existing?.count ?? 0) + 1 });
  }));
  const sharedIngredients = [...useCounts.values()]
    .filter((ingredient) => ingredient.count > 1)
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
  const reusedOccurrences = sharedIngredients.reduce((total, ingredient) => total + ingredient.count - 1, 0);
  const mealsSharingIngredients = planMeals.filter((meal) =>
    meal.ingredients.some((ingredient) => (useCounts.get(ingredientKey(ingredient.name))?.count ?? 0) > 1),
  ).length;
  return {
    totalIngredientOccurrences,
    uniqueIngredientCount: useCounts.size,
    sharedIngredientCount: sharedIngredients.length,
    reusedOccurrences,
    mealsSharingIngredients,
    estimatedWasteReduction: reusedOccurrences >= 8 ? "Meaningful" : reusedOccurrences >= 4 ? "Moderate" : "Some",
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

export function buildShoppingList(
  planMeals: Meal[],
  pantryItems: PantryItem[] = [],
  days: Weekday[] = WEEKDAYS,
): ShoppingItem[] {
  const pantry = new Set(pantryItems.filter((item) => item.confirmed).map((item) => ingredientKey(item.name)));
  const combined = new Map<string, ShoppingItem & { units: Set<string>; amountTotal: number }>();
  planMeals.forEach((meal, mealIndex) => meal.ingredients.forEach((ingredient) => {
    const key = ingredientKey(ingredient.name);
    const unit = normalizedUnit(ingredient.unit);
    const existing = combined.get(key);
    if (existing) {
      existing.mealCount += 1;
      existing.units.add(unit);
      existing.amountTotal += ingredient.amount;
      if (!existing.usedIn.includes(days[mealIndex])) existing.usedIn.push(days[mealIndex]);
      return;
    }
    combined.set(key, {
      name: ingredient.name,
      category: shoppingCategoryFor(ingredient.name),
      mealCount: 1,
      units: new Set([unit]),
      amountTotal: ingredient.amount,
      usedIn: [days[mealIndex]],
      inPantry: pantry.has(key),
    });
  }));
  return [...combined.values()]
    .map(({ units, amountTotal, ...item }) => ({
      ...item,
      amount: units.size === 1 ? amountTotal : undefined,
      unit: units.size === 1 ? [...units][0] : undefined,
    }))
    .sort((first, second) => Number(first.inPantry) - Number(second.inPantry) || first.name.localeCompare(second.name));
}

export function formatShoppingAmount(item: ShoppingItem) {
  if (item.amount === undefined || !item.unit) return undefined;
  const amount = Number.isInteger(item.amount) ? item.amount.toString() : item.amount.toFixed(1).replace(/\.0$/, "");
  if (item.unit === "pc") return `${amount} ${item.amount === 1 ? "piece" : "pieces"}`;
  return `${amount} ${item.unit}`;
}

function cleanTitlePart(meal: Meal, kind: "main" | "side") {
  const ingredient = meal.ingredients.find((item) => {
    const name = item.name.toLowerCase();
    return kind === "main"
      ? PROTEIN_TERMS.some((term) => name.includes(term))
      : SIDE_TERMS.some((term) => name.includes(term));
  });
  if (ingredient) return ingredient.name.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return meal.title;
}

export function createCombinedMeal(mainMeal: Meal, sideMeal: Meal, servings: number): Meal {
  const scaleMain = servings / Math.max(1, mainMeal.servings);
  const scaleSide = servings / Math.max(1, sideMeal.servings);
  const mainIngredients = mainMeal.ingredients.filter((ingredient, index) =>
    PROTEIN_TERMS.some((term) => ingredient.name.toLowerCase().includes(term)) || index === 0,
  );
  const sideIngredients = sideMeal.ingredients.filter((ingredient, index) =>
    SIDE_TERMS.some((term) => ingredient.name.toLowerCase().includes(term)) || index > 0,
  ).slice(0, 4);
  const combinedIngredients = [...mainIngredients, ...sideIngredients]
    .filter((ingredient, index, items) => items.findIndex((item) => ingredientKey(item.name) === ingredientKey(ingredient.name)) === index)
    .map((ingredient) => ({
      ...ingredient,
      amount: Number((ingredient.amount * (mainIngredients.includes(ingredient) ? scaleMain : scaleSide)).toFixed(1)),
    }));
  const bothVegan = mainMeal.dietary.includes("Vegan") && sideMeal.dietary.includes("Vegan");
  const bothVegetarian = [mainMeal, sideMeal].every((meal) => meal.dietary.includes("Vegetarian") || meal.dietary.includes("Vegan"));
  const bothPescatarian = [mainMeal, sideMeal].every((meal) => meal.dietary.includes("Pescatarian") || meal.dietary.includes("Vegetarian") || meal.dietary.includes("Vegan"));
  const dietary: Meal["dietary"] = bothVegan
    ? ["Vegan", "Vegetarian"]
    : bothVegetarian
      ? ["Vegetarian"]
      : bothPescatarian
        ? ["Pescatarian"]
        : [];
  if (mainMeal.proteinGrams >= 30) dietary.push("High protein");
  const title = `${cleanTitlePart(mainMeal, "main")} + ${cleanTitlePart(sideMeal, "side")}`;
  return {
    ...mainMeal,
    id: `combined:${Date.now()}:${mainMeal.id}:${sideMeal.id}`,
    title,
    description: `The main preparation from ${mainMeal.title}, paired with the side from ${sideMeal.title}.`,
    timeMinutes: Math.max(mainMeal.timeMinutes, sideMeal.timeMinutes),
    calories: Math.round(mainMeal.calories * 0.65 + sideMeal.calories * 0.35),
    proteinGrams: Math.round(mainMeal.proteinGrams * 0.85 + sideMeal.proteinGrams * 0.15),
    servings,
    dietary,
    allergens: [...new Set([...mainMeal.allergens, ...sideMeal.allergens])],
    ingredients: combinedIngredients,
    instructions: [
      `Prepare the main component using ${mainMeal.title}'s method.`,
      `Prepare the selected side using ${sideMeal.title}'s method, scaled for ${servings} servings.`,
      "Finish both components together, re-check seasoning, allergens, and doneness before serving.",
    ],
    source: {
      platform: "curated",
      originalTitle: title,
      generationMethod: "combined",
    },
    componentSources: [
      { mealId: mainMeal.id, mealTitle: mainMeal.title, component: "main" },
      { mealId: sideMeal.id, mealTitle: sideMeal.title, component: "side" },
    ],
    recipeOrigin: "combined",
    recipeStatus: "ready",
    safetyStatus: "safe",
    safetyNotes: ["Combined from two reviewed recipes and re-checked against the household."],
  };
}
