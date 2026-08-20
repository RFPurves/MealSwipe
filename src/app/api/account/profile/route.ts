import { Prisma } from "@prisma/client";
import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { validateUsername } from "@/lib/usernames";

const dietary = new Set(["Everything", "Vegetarian", "Vegan", "Pescatarian", "High protein"]);
const nutrition = new Set(["Balanced", "High protein", "Lower carb", "None"]);
const allergies = new Set(["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"]);
const categories = new Set(["Italian", "Asian", "Mediterranean", "Seafood", "Vegetarian", "Pasta", "Quick meals", "High protein"]);

function stringList(value: unknown, allowed?: Set<string>) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item && (!allowed || allowed.has(item))))].slice(0, 30);
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const usernameResult = typeof body.username === "string" ? validateUsername(body.username) : null;
    if (usernameResult?.error) throw new ApiError(400, usernameResult.error);
    const preference = typeof body.preferences === "object" && body.preferences ? body.preferences as Record<string, unknown> : {};
    const dietaryPreference = typeof preference.dietary === "string" && dietary.has(preference.dietary) ? preference.dietary : "Everything";
    const nutritionPreference = typeof preference.nutritionPreference === "string" && nutrition.has(preference.nutritionPreference) ? preference.nutritionPreference : "Balanced";
    const maximumCookingTime = Math.min(240, Math.max(10, Number(preference.maximumCookingTime) || 45));

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          ...(usernameResult ? { username: usernameResult.username } : {}),
          ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim().slice(0, 80) } : {}),
        },
      }),
      prisma.userPreference.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          dietaryPreference,
          nutritionPreference,
          allergies: stringList(preference.allergies, allergies),
          dislikedIngredients: stringList(preference.dislikedIngredients),
          cookingCategories: stringList(preference.categories, categories),
          maximumCookingTime,
        },
        update: {
          dietaryPreference,
          nutritionPreference,
          allergies: stringList(preference.allergies, allergies),
          dislikedIngredients: stringList(preference.dislikedIngredients),
          cookingCategories: stringList(preference.categories, categories),
          maximumCookingTime,
        },
      }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ message: "That username is already taken." }, { status: 409 });
    }
    return apiFailure(error);
  }
}
