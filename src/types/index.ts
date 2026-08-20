export type DietaryPreference =
  | "Everything"
  | "Vegetarian"
  | "Vegan"
  | "Pescatarian"
  | "High protein";

export type NutritionPreference = "Balanced" | "High protein" | "Lower carb" | "None";

export type MealCategory =
  | "Italian"
  | "Asian"
  | "Mediterranean"
  | "Seafood"
  | "Vegetarian"
  | "Pasta"
  | "Quick meals"
  | "High protein";

export type Allergen = "Dairy" | "Eggs" | "Gluten" | "Nuts" | "Shellfish" | "Soy";

export type ContentPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "creator"
  | "publisher"
  | "curated";

export type RecipeGenerationMethod =
  | "curated"
  | "source-derived"
  | "ai-estimated"
  | "fallback-estimated"
  | "combined";

export interface RecipeSource {
  platform: ContentPlatform;
  contentId?: string;
  url?: string;
  creator?: string;
  originalTitle: string;
  generationMethod: RecipeGenerationMethod;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface MealComponentSource {
  mealId: string;
  mealTitle: string;
  component: "main" | "side";
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
  source?: RecipeSource;
  componentSources?: MealComponentSource[];
  sourceType?: "mock" | "youtube";
  youtubeVideoId?: string;
  youtubeUrl?: string;
  channelTitle?: string;
  sourceDescription?: string;
  recipeOrigin?: "curated" | "ai-estimated" | "fallback-estimated" | "combined";
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
  nutritionPreference?: NutritionPreference;
  maximumCookingTime?: number;
  personalDinnersPerWeek?: number;
  strictDislikes?: boolean;
}

export interface HouseholdMember {
  id: string;
  name: string;
  username?: string;
  dietary: DietaryPreference;
  allergies: Allergen[];
  dislikedIngredients: string[];
  nutritionPreference: NutritionPreference;
}

export interface HouseholdSettings {
  adults: number;
  children: number;
  dinnersPerWeek: number;
  maximumCookingTime: number;
  weeklyBudget?: number;
}

export interface Household {
  id?: string;
  name: string;
  members: HouseholdMember[];
  settings: HouseholdSettings;
}

export type OptimizationObjective =
  | "balanced"
  | "lowest-cost"
  | "least-waste"
  | "fastest"
  | "highest-protein"
  | "most-variety";

export interface PantryItem {
  id: string;
  name: string;
  normalizedName?: string;
  quantity?: number | null;
  unit?: string | null;
  source: "manual" | "camera" | "barcode" | "ai-detected" | "demo";
  confirmed: boolean;
}

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type ShoppingCategory = "Produce" | "Protein" | "Dairy" | "Pantry" | "Grains" | "Other";

export interface ShoppingItem {
  name: string;
  category: ShoppingCategory;
  mealCount: number;
  amount?: number;
  unit?: string;
  usedIn: Weekday[];
  inPantry: boolean;
}

export type PlannerActionType =
  | "replaceMeal"
  | "swapDays"
  | "moveMeal"
  | "combineMealComponents"
  | "removeMeal"
  | "optimizeWeek"
  | "changeMealConstraint";

export interface PlannerAction {
  type: PlannerActionType;
  targetDay?: Weekday;
  sourceDay?: Weekday;
  destinationDay?: Weekday;
  mainFromDay?: Weekday;
  sideFromDay?: Weekday;
  objective?: OptimizationObjective;
  constraint?: "vegetarian" | "under-20-minutes" | "high-protein" | "no-pasta";
}

export interface PlannerProposal {
  summary: string;
  needsConfirmation: boolean;
  clarification?: string;
  actions: PlannerAction[];
}

export const defaultPreferences: Preferences = {
  dietary: "Everything",
  allergies: [],
  dislikedIngredients: [],
  categories: [],
  nutritionPreference: "Balanced",
  maximumCookingTime: 45,
  personalDinnersPerWeek: 7,
  strictDislikes: true,
};

export const defaultHousehold: Household = {
  name: "My household",
  members: [
    {
      id: "member-1",
      name: "You",
      dietary: "Everything",
      allergies: [],
      dislikedIngredients: [],
      nutritionPreference: "Balanced",
    },
  ],
  settings: {
    adults: 2,
    children: 0,
    dinnersPerWeek: 7,
    maximumCookingTime: 45,
  },
};
