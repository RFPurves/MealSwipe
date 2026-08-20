import { getAccountBootstrap } from "@/lib/account-data";
import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { generateWeeklyPlan } from "@/lib/meal-planner";
import { prisma } from "@/lib/prisma";
import type { OptimizationObjective, PantryItem } from "@/types";

const objectives = new Set(["balanced", "lowest-cost", "least-waste", "fastest", "highest-protein", "most-variety"]);

function monday(date = new Date()) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const account = await getAccountBootstrap(user.id);
    if (!account.household?.id) throw new ApiError(409, "Create or join a household before generating a shared week.");
    const objective = typeof body.objective === "string" && objectives.has(body.objective) ? body.objective as OptimizationObjective : "balanced";
    const pantryItems = Array.isArray(body.pantryItems) ? body.pantryItems.filter((item): item is PantryItem => Boolean(item && typeof item === "object" && "name" in item)) : [];
    const planIds = generateWeeklyPlan(
      account.savedIds,
      account.preferences,
      Date.now(),
      account.dynamicMeals,
      { household: account.household, householdLikes: account.householdSignals, objective, pantryItems, usePantryFirst: body.usePantryFirst === true },
    );
    const weekStart = monday();
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    await prisma.weeklyPlan.create({
      data: {
        householdId: account.household.id,
        generatedById: user.id,
        weekStart,
        weekEnd,
        selectedRecipes: planIds,
        plannerSettings: JSON.parse(JSON.stringify({ objective, pantryItems, usePantryFirst: body.usePantryFirst === true })) as Prisma.InputJsonValue,
      },
    });
    return Response.json({ planIds, householdSignals: account.householdSignals });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const membership = await prisma.householdMembership.findUnique({ where: { userId: user.id } });
    if (!membership) throw new ApiError(403, "You do not belong to a household.");
    if (!Array.isArray(body.planIds) || body.planIds.length !== 7 || body.planIds.some((id) => id !== null && typeof id !== "string")) {
      throw new ApiError(400, "A seven-day plan is required.");
    }
    const planIds = body.planIds.map((id) => typeof id === "string" ? id.slice(0, 200) : null);
    const weekStart = monday();
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    await prisma.weeklyPlan.create({
      data: {
        householdId: membership.householdId,
        generatedById: user.id,
        weekStart,
        weekEnd,
        selectedRecipes: planIds,
        plannerSettings: JSON.parse(JSON.stringify({
          objective: typeof body.objective === "string" ? body.objective : "balanced",
          summary: typeof body.summary === "string" ? body.summary.slice(0, 200) : "Plan updated",
        })) as Prisma.InputJsonValue,
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
import type { Prisma } from "@prisma/client";
