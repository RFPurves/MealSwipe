import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/usernames";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const viewer = await requireAuthUser();
    const { username } = await context.params;
    const profile = await prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
      include: { membership: true, savedRecipes: { orderBy: { updatedAt: "desc" } }, swipes: { orderBy: { createdAt: "desc" } } },
    });
    if (!profile) throw new ApiError(404, "Profile not found.");
    const viewerMembership = await prisma.householdMembership.findUnique({ where: { userId: viewer.id } });
    const sameHousehold = Boolean(profile.membership && viewerMembership?.householdId === profile.membership.householdId);
    const recipes = profile.savedRecipes.filter((recipe) => recipe.visibility === "PUBLIC" || (sameHousehold && recipe.visibility === "HOUSEHOLD") || profile.id === viewer.id);
    const latestSwipe = new Map<string, (typeof profile.swipes)[number]>();
    profile.swipes.forEach((swipe) => { if (!latestSwipe.has(swipe.recipeIdentifier)) latestSwipe.set(swipe.recipeIdentifier, swipe); });
    const likedMealsCount = [...latestSwipe.values()].filter((swipe) => swipe.action === "LIKED" || swipe.action === "SAVED").length;
    return Response.json({
      profile: { id: profile.id, name: profile.name ?? profile.username, username: profile.username, image: profile.image, sameHousehold, likedMealsCount, householdMember: Boolean(profile.membership) },
      recipes: recipes.map((recipe) => ({ recipe: recipe.recipe, visibility: recipe.visibility })),
    });
  } catch (error) {
    return apiFailure(error);
  }
}
