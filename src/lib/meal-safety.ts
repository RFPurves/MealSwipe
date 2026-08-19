import type { Household, Meal, Preferences } from "@/types";

export function mealMatchesDiet(meal: Meal, preferences: Preferences) {
  switch (preferences.dietary) {
    case "Everything":
      return true;
    case "Vegetarian":
      return meal.dietary.includes("Vegetarian") || meal.dietary.includes("Vegan");
    case "Vegan":
      return meal.dietary.includes("Vegan");
    case "Pescatarian":
      return (
        meal.dietary.includes("Pescatarian") ||
        meal.dietary.includes("Vegetarian") ||
        meal.dietary.includes("Vegan")
      );
    case "High protein":
      return meal.dietary.includes("High protein");
  }
}

export function mealIsSafe(meal: Meal, preferences: Preferences) {
  if (meal.sourceType === "youtube") {
    if (meal.recipeStatus !== "ready" || meal.safetyStatus !== "safe") return false;
  }
  if (!mealMatchesDiet(meal, preferences)) return false;

  const hasAllergen = preferences.allergies.some((allergen) =>
    meal.allergens.includes(allergen),
  );
  if (hasAllergen) return false;

  const ingredientNames = meal.ingredients.map((ingredient) =>
    ingredient.name.toLowerCase(),
  );

  return preferences.dislikedIngredients.every((dislike) => {
    const normalizedDislike = dislike.trim().toLowerCase();
    return (
      normalizedDislike.length === 0 ||
      !ingredientNames.some((ingredient) => ingredient.includes(normalizedDislike))
    );
  });
}

export function householdPreferences(household: Household, interests: Preferences): Preferences {
  const diets = household.members.map((member) => member.dietary);
  const dietary = diets.includes("Vegan")
    ? "Vegan"
    : diets.includes("Vegetarian")
      ? "Vegetarian"
      : diets.includes("Pescatarian")
        ? "Pescatarian"
        : "Everything";

  return {
    dietary,
    allergies: [...new Set(household.members.flatMap((member) => member.allergies))],
    dislikedIngredients: [
      ...new Set(household.members.flatMap((member) => member.dislikedIngredients)),
    ],
    categories: interests.categories,
  };
}

export function mealSafetyForHousehold(meal: Meal, household: Household) {
  const conflicts: string[] = [];
  household.members.forEach((member) => {
    const preferences: Preferences = {
      dietary: member.dietary,
      allergies: member.allergies,
      dislikedIngredients: member.dislikedIngredients,
      categories: [],
    };
    if (!mealIsSafe(meal, preferences)) conflicts.push(member.name);
  });
  return { safe: conflicts.length === 0, conflicts };
}

export function mealIsSafeForHousehold(meal: Meal, household: Household) {
  return mealSafetyForHousehold(meal, household).safe;
}

export function mealMatchesCategories(meal: Meal, preferences: Preferences) {
  return (
    preferences.categories.length === 0 ||
    preferences.categories.some((category) => meal.categories.includes(category))
  );
}

export function mealIsDiscoverable(meal: Meal, preferences: Preferences) {
  return mealIsSafe(meal, preferences) && mealMatchesCategories(meal, preferences);
}
