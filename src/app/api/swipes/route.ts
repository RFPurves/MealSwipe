import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

const actions = new Set(["LIKED", "SKIPPED", "SAVED"]);

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const recipeIdentifier = typeof body.recipeIdentifier === "string" ? body.recipeIdentifier.slice(0, 200) : "";
    const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
    if (!recipeIdentifier || !actions.has(action)) throw new ApiError(400, "Invalid swipe event.");
    await prisma.swipeEvent.create({
      data: { userId: user.id, recipeIdentifier, action: action as "LIKED" | "SKIPPED" | "SAVED", mealSnapshot: body.meal && typeof body.meal === "object" ? body.meal as object : undefined },
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
