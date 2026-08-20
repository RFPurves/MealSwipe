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

function profileImage(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  if (/^https:\/\//i.test(value) && value.length <= 2_000) return value;
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 350_000) return value;
  throw new ApiError(400, "Choose a JPG, PNG, or WebP profile picture smaller than 250 KB.");
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
    const personalDinnersPerWeek = Math.min(7, Math.max(1, Number(preference.personalDinnersPerWeek) || 7));
    const image = profileImage(body.image);
    const completeProfile = body.completeProfile === true;
    if (completeProfile && (!usernameResult || typeof body.name !== "string" || body.name.trim().length < 2)) {
      throw new ApiError(400, "Display name and username are required to finish your profile.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          ...(usernameResult ? { username: usernameResult.username } : {}),
          ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim().slice(0, 80) } : {}),
          ...(image !== undefined ? { image } : {}),
          ...(completeProfile ? { profileCompleted: true, profileCompletedAt: new Date() } : {}),
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
          personalDinnersPerWeek,
          strictDislikes: preference.strictDislikes !== false,
        },
        update: {
          dietaryPreference,
          nutritionPreference,
          allergies: stringList(preference.allergies, allergies),
          dislikedIngredients: stringList(preference.dislikedIngredients),
          cookingCategories: stringList(preference.categories, categories),
          maximumCookingTime,
          personalDinnersPerWeek,
          strictDislikes: preference.strictDislikes !== false,
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
