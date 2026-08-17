export type DietaryPreference =
  | "Everything"
  | "Vegetarian"
  | "Vegan"
  | "Pescatarian"
  | "High protein";

export type MealCategory =
  | "Italian"
  | "Asian"
  | "Mediterranean"
  | "Seafood"
  | "Vegetarian"
  | "Pasta"
  | "Quick meals"
  | "High protein";

export type Allergen =
  | "Dairy"
  | "Eggs"
  | "Gluten"
  | "Nuts"
  | "Shellfish"
  | "Soy";

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Meal {
  id: string;
  title: string;
  description: string;
  image: string;
  category: MealCategory;
  categories: MealCategory[];
  timeMinutes: number;
  calories: number;
  proteinGrams: number;
  servings: number;
  dietary: Exclude<DietaryPreference, "Everything">[];
  allergens: Allergen[];
  ingredients: Ingredient[];
  instructions?: string[];
  sourceType?: "mock" | "youtube";
  youtubeVideoId?: string;
  youtubeUrl?: string;
  channelTitle?: string;
  sourceDescription?: string;
  recipeOrigin?: "curated" | "ai-estimated" | "fallback-estimated";
  recipeStatus?: "creating" | "ready" | "failed";
  safetyStatus?: "safe" | "review-needed" | "blocked";
  safetyNotes?: string[];
}

export interface YouTubeMealCandidate {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  category: MealCategory;
  sourceUrl: string;
}

export interface Preferences {
  dietary: DietaryPreference;
  allergies: Allergen[];
  dislikedIngredients: string[];
  categories: MealCategory[];
}

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type ShoppingCategory =
  | "Produce"
  | "Protein"
  | "Dairy"
  | "Pantry"
  | "Grains"
  | "Other";

export interface ShoppingItem {
  name: string;
  category: ShoppingCategory;
  mealCount: number;
  amount?: number;
  unit?: string;
}

export const defaultPreferences: Preferences = {
  dietary: "Everything",
  allergies: [],
  dislikedIngredients: [],
  categories: [],
};
