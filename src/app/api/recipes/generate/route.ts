import type {
  Allergen,
  DietaryPreference,
  Ingredient,
  Meal,
  MealCategory,
  Preferences,
  YouTubeMealCandidate,
} from "@/types";
import { mealIsSafe } from "@/lib/meal-safety";

export const runtime = "nodejs";

const categories: MealCategory[] = [
  "Italian", "Asian", "Mediterranean", "Seafood", "Vegetarian", "Pasta", "Quick meals", "High protein",
];
const dietaryTags: Exclude<DietaryPreference, "Everything">[] = [
  "Vegetarian", "Vegan", "Pescatarian", "High protein",
];
const allergens: Allergen[] = ["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"];

function inferFallbackIngredients(candidate: YouTubeMealCandidate): Ingredient[] {
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();
  const result: Ingredient[] = [];
  const add = (name: string, amount: number, unit: string) => {
    if (!result.some((ingredient) => ingredient.name === name)) result.push({ name, amount, unit });
  };
  const terms: [string[], string, number, string][] = [
    [["chicken"], "chicken breast", 400, "g"],
    [["salmon"], "salmon fillets", 2, "pcs"],
    [["shrimp", "prawn"], "shrimp", 300, "g"],
    [["tofu"], "tofu", 300, "g"],
    [["pasta", "spaghetti", "linguine"], "pasta", 250, "g"],
    [["rice"], "rice", 200, "g"],
    [["tomato"], "tomatoes", 4, "pcs"],
    [["pepper"], "bell pepper", 2, "pcs"],
    [["mushroom"], "mushrooms", 250, "g"],
    [["spinach"], "spinach", 150, "g"],
    [["cheese", "parmesan"], "parmesan", 80, "g"],
    [["cream"], "cream", 200, "ml"],
    [["coconut"], "coconut milk", 400, "ml"],
    [["lemon"], "lemon", 1, "pc"],
  ];
  terms.forEach(([needles, name, amount, unit]) => {
    if (needles.some((needle) => text.includes(needle))) add(name, amount, unit);
  });
  add("onion", 1, "pc");
  add("garlic", 2, "cloves");
  add("olive oil", 2, "tbsp");
  add("salt and pepper", 1, "to taste");
  return result;
}

function fallbackMeal(candidate: YouTubeMealCandidate, preferences: Preferences): Meal {
  const ingredients = inferFallbackIngredients(candidate);
  const ingredientText = ingredients.map((ingredient) => ingredient.name).join(" ").toLowerCase();
  const allergyHits = preferences.allergies.filter((allergy) => {
    const terms: Record<Allergen, string[]> = {
      Dairy: ["cream", "parmesan", "milk", "cheese", "butter"],
      Eggs: ["egg"],
      Gluten: ["pasta", "bread", "wheat"],
      Nuts: ["nut", "almond", "cashew", "peanut"],
      Shellfish: ["shrimp", "prawn", "crab", "lobster"],
      Soy: ["tofu", "soy", "miso"],
    };
    return terms[allergy].some((term) => ingredientText.includes(term));
  });
  const dislikedHits = preferences.dislikedIngredients.filter((term) =>
    ingredientText.includes(term.trim().toLowerCase()),
  );
  const isBlocked = allergyHits.length > 0 || dislikedHits.length > 0;

  return {
    id: `youtube:${candidate.videoId}`,
    title: candidate.title,
    description: candidate.description || `An estimated recipe based on ${candidate.channelTitle}'s cooking video.`,
    image: candidate.thumbnail,
    category: candidate.category,
    categories: [candidate.category],
    timeMinutes: Math.max(15, Math.ceil(candidate.durationSeconds / 60) + 10),
    calories: 0,
    proteinGrams: 0,
    servings: 2,
    dietary: [],
    allergens: allergyHits,
    ingredients,
    instructions: [
      "Watch the source video once through and prepare the listed ingredients.",
      "Follow the creator's demonstrated preparation and cooking method.",
      "Check seasoning and doneness before serving.",
    ],
    sourceType: "youtube",
    youtubeVideoId: candidate.videoId,
    youtubeUrl: candidate.sourceUrl,
    channelTitle: candidate.channelTitle,
    sourceDescription: candidate.description,
    source: {
      platform: "youtube",
      contentId: candidate.videoId,
      url: candidate.sourceUrl,
      creator: candidate.channelTitle,
      originalTitle: candidate.title,
      generationMethod: "fallback-estimated",
    },
    recipeOrigin: "fallback-estimated",
    recipeStatus: "ready",
    safetyStatus: isBlocked ? "blocked" : "review-needed",
    safetyNotes: isBlocked
      ? [`Possible preference conflict: ${[...allergyHits, ...dislikedHits].join(", ")}.`]
      : ["Ingredients are estimated from video metadata. Review the source before adding this meal to your week."],
  };
}

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "description", "timeMinutes", "calories", "proteinGrams", "servings", "categories", "dietary",
    "allergens", "ingredients", "instructions", "safetyStatus", "safetyNotes",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    timeMinutes: { type: "integer", minimum: 5, maximum: 240 },
    calories: { type: "integer", minimum: 0, maximum: 3000 },
    proteinGrams: { type: "integer", minimum: 0, maximum: 300 },
    servings: { type: "integer", minimum: 1, maximum: 12 },
    categories: { type: "array", minItems: 1, items: { type: "string", enum: categories } },
    dietary: { type: "array", items: { type: "string", enum: dietaryTags } },
    allergens: { type: "array", items: { type: "string", enum: allergens } },
    ingredients: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "unit"],
        properties: {
          name: { type: "string" },
          amount: { type: "number", minimum: 0 },
          unit: { type: "string" },
        },
      },
    },
    instructions: { type: "array", minItems: 2, items: { type: "string" } },
    safetyStatus: { type: "string", enum: ["safe", "review-needed", "blocked"] },
    safetyNotes: { type: "array", items: { type: "string" } },
  },
} as const;

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object" || !("output" in response)) return undefined;
  const output = (response as { output?: { content?: { type?: string; text?: string }[] }[] }).output;
  return output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as
    | { candidate?: YouTubeMealCandidate; preferences?: Preferences }
    | undefined;
  const candidate = body?.candidate;
  const preferences = body?.preferences;

  if (
    !candidate?.videoId
    || !candidate.title
    || !candidate.channelTitle
    || !preferences?.dietary
    || !Array.isArray(preferences.allergies)
    || !Array.isArray(preferences.dislikedIngredients)
    || !Array.isArray(preferences.categories)
  ) {
    return Response.json(
      { code: "INVALID_REQUEST", message: "A YouTube meal candidate and preferences are required." },
      { status: 400 },
    );
  }
  const fallback = fallbackMeal(candidate, preferences);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ meal: fallback, mode: "fallback" });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: process.env.OPENAI_RECIPE_MODEL?.trim() || "gpt-4o-mini",
        input: [
          {
            role: "developer",
            content: "Create a practical recipe using only evidence in the YouTube title and description. Never claim certainty when metadata is incomplete. Mark safety review-needed whenever allergens, dietary status, or core ingredients cannot be determined confidently. Mark blocked for any known user conflict. Quantities may be sensible estimates, and must be described as estimates by the application.",
          },
          {
            role: "user",
            content: JSON.stringify({ video: candidate, userPreferences: preferences }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "youtube_recipe",
            strict: true,
            schema: recipeSchema,
          },
        },
      }),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => undefined) as
        | { error?: { type?: string; code?: string; param?: string; message?: string } }
        | undefined;
      console.error("OpenAI recipe request rejected", {
        status: response.status,
        type: errorPayload?.error?.type,
        code: errorPayload?.error?.code,
        param: errorPayload?.error?.param,
        message: errorPayload?.error?.message,
      });
      if (response.status === 429) {
        return Response.json({
          meal: fallback,
          mode: "fallback",
          recovered: true,
          reason: errorPayload?.error?.code ?? "rate_limited",
        });
      }
      throw new Error(`OpenAI request failed with ${response.status}`);
    }
    const responseJson = await response.json() as unknown;
    const outputText = extractOutputText(responseJson);
    if (!outputText) throw new Error("OpenAI returned no recipe output");
    const recipe = JSON.parse(outputText) as Pick<
      Meal,
      "title" | "description" | "timeMinutes" | "calories" | "proteinGrams" | "servings" | "categories" |
      "dietary" | "allergens" | "ingredients" | "instructions" | "safetyStatus" | "safetyNotes"
    >;
    const meal: Meal = {
      ...recipe,
      id: fallback.id,
      image: candidate.thumbnail,
      category: recipe.categories[0] ?? candidate.category,
      sourceType: "youtube",
      youtubeVideoId: candidate.videoId,
      youtubeUrl: candidate.sourceUrl,
      channelTitle: candidate.channelTitle,
      sourceDescription: candidate.description,
      source: {
        platform: "youtube",
        contentId: candidate.videoId,
        url: candidate.sourceUrl,
        creator: candidate.channelTitle,
        originalTitle: candidate.title,
        generationMethod: "ai-estimated",
      },
      recipeOrigin: "ai-estimated",
      recipeStatus: "ready",
      safetyStatus: recipe.safetyStatus,
      safetyNotes: recipe.safetyNotes,
    };
    const hasKnownConflict = !mealIsSafe(
      { ...meal, safetyStatus: "safe" },
      preferences,
    );
    if (hasKnownConflict) {
      meal.safetyStatus = "blocked";
      meal.safetyNotes = ["This recipe conflicts with at least one saved dietary preference, allergy, or disliked ingredient."];
    }
    return Response.json({ meal, mode: "openai" });
  } catch (error) {
    console.error("Recipe generation failed", error);
    return Response.json({ meal: fallback, mode: "fallback", recovered: true });
  }
}
