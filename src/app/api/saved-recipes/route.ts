import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

const visibilities = new Set(["PRIVATE", "HOUSEHOLD", "PUBLIC"]);

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const meal = body.meal && typeof body.meal === "object" && !Array.isArray(body.meal) ? body.meal as Record<string, unknown> : null;
    const recipeIdentifier = typeof meal?.id === "string" ? meal.id.slice(0, 200) : "";
    const visibility = typeof body.visibility === "string" && visibilities.has(body.visibility) ? body.visibility : "PRIVATE";
    if (!recipeIdentifier || typeof meal?.title !== "string") throw new ApiError(400, "A valid recipe is required.");
    await prisma.$transaction([
      prisma.savedRecipe.upsert({
        where: { userId_recipeIdentifier: { userId: user.id, recipeIdentifier } },
        create: { userId: user.id, recipeIdentifier, recipe: jsonValue(meal), provenance: meal.source && typeof meal.source === "object" ? jsonValue(meal.source) : undefined, visibility: visibility as "PRIVATE" | "HOUSEHOLD" | "PUBLIC" },
        update: { recipe: jsonValue(meal), provenance: meal.source && typeof meal.source === "object" ? jsonValue(meal.source) : undefined, visibility: visibility as "PRIVATE" | "HOUSEHOLD" | "PUBLIC" },
      }),
      prisma.swipeEvent.create({ data: { userId: user.id, recipeIdentifier, action: "SAVED", mealSnapshot: jsonValue(meal) } }),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const recipeIdentifier = typeof body.recipeIdentifier === "string" ? body.recipeIdentifier : "";
    const visibility = typeof body.visibility === "string" && visibilities.has(body.visibility) ? body.visibility : "";
    if (!recipeIdentifier || !visibility) throw new ApiError(400, "Recipe and visibility are required.");
    const result = await prisma.savedRecipe.updateMany({
      where: { userId: user.id, recipeIdentifier },
      data: { visibility: visibility as "PRIVATE" | "HOUSEHOLD" | "PUBLIC" },
    });
    if (!result.count) throw new ApiError(404, "Saved recipe not found.");
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser();
    const recipeIdentifier = new URL(request.url).searchParams.get("id") ?? "";
    if (!recipeIdentifier) throw new ApiError(400, "Recipe is required.");
    await prisma.savedRecipe.deleteMany({ where: { userId: user.id, recipeIdentifier } });
    await prisma.swipeEvent.create({ data: { userId: user.id, recipeIdentifier, action: "SKIPPED" } });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
import type { Prisma } from "@prisma/client";
