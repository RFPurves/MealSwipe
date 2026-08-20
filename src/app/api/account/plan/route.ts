import type { Prisma } from "@prisma/client";
import { getAccountBootstrap } from "@/lib/account-data";
import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { generateWeeklyPlan } from "@/lib/meal-planner";
import { prisma } from "@/lib/prisma";
import type { Household, OptimizationObjective } from "@/types";

const objectives = new Set(["balanced", "lowest-cost", "least-waste", "fastest", "highest-protein", "most-variety"]);
const jsonValue = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function monday(date = new Date()) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
}

function personalPlanningProfile(account: Awaited<ReturnType<typeof getAccountBootstrap>>): Household {
  return {
    name: "My plan",
    members: [{
      id: account.user.id,
      name: account.user.name,
      username: account.user.username ?? undefined,
      dietary: account.preferences.dietary,
      allergies: account.preferences.allergies,
      dislikedIngredients: account.preferences.dislikedIngredients,
      nutritionPreference: account.preferences.nutritionPreference ?? "Balanced",
    }],
    settings: {
      adults: 1,
      children: 0,
      dinnersPerWeek: account.preferences.personalDinnersPerWeek ?? 7,
      maximumCookingTime: account.preferences.maximumCookingTime ?? 45,
    },
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const account = await getAccountBootstrap(user.id);
    const objective = typeof body.objective === "string" && objectives.has(body.objective) ? body.objective as OptimizationObjective : "balanced";
    const profile = personalPlanningProfile(account);
    const planIds = generateWeeklyPlan(account.savedIds, account.preferences, Date.now(), account.dynamicMeals, {
      household: profile,
      objective,
      pantryItems: account.pantryItems,
      usePantryFirst: body.usePantryFirst === true,
    });
    const weekStart = monday();
    const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    await prisma.personalWeeklyPlan.create({ data: { userId: user.id, weekStart, weekEnd, selectedRecipes: planIds, plannerSettings: jsonValue({ objective, usePantryFirst: body.usePantryFirst === true }) } });
    return Response.json({ planIds });
  } catch (error) { return apiFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    if (!Array.isArray(body.planIds) || body.planIds.length !== 7 || body.planIds.some((id) => id !== null && typeof id !== "string")) throw new ApiError(400, "A seven-day plan is required.");
    const planIds = body.planIds.map((id) => typeof id === "string" ? id.slice(0, 200) : null);
    const selectedIds = new Set(planIds.filter((id): id is string => Boolean(id)));
    const dynamicMeals = Array.isArray(body.dynamicMeals) ? body.dynamicMeals.filter((meal): meal is Record<string, unknown> => Boolean(meal && typeof meal === "object" && !Array.isArray(meal) && typeof meal.id === "string" && meal.id.startsWith("combined:") && selectedIds.has(meal.id) && typeof meal.title === "string")).slice(0, 7) : [];
    const weekStart = monday();
    const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    await prisma.$transaction([
      ...dynamicMeals.map((meal) => prisma.savedRecipe.upsert({
        where: { userId_recipeIdentifier: { userId: user.id, recipeIdentifier: meal.id as string } },
        create: { userId: user.id, recipeIdentifier: meal.id as string, recipe: jsonValue(meal), visibility: "PRIVATE" },
        update: { recipe: jsonValue(meal), visibility: "PRIVATE" },
      })),
      prisma.personalWeeklyPlan.create({ data: { userId: user.id, weekStart, weekEnd, selectedRecipes: planIds, plannerSettings: jsonValue({ objective: typeof body.objective === "string" ? body.objective : "balanced", summary: typeof body.summary === "string" ? body.summary.slice(0, 200) : "Plan updated" }) } }),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
