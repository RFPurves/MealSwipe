import type { Meal, Preferences } from "@/types";

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

export function mealMatchesCategories(meal: Meal, preferences: Preferences) {
  return (
    preferences.categories.length === 0 ||
    preferences.categories.some((category) => meal.categories.includes(category))
  );
}

export function mealIsDiscoverable(meal: Meal, preferences: Preferences) {
  return mealIsSafe(meal, preferences) && mealMatchesCategories(meal, preferences);
}
