import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccountBootstrap, AccountUser, HouseholdInviteSummary } from "@/types/account";
import type { Allergen, DietaryPreference, Meal, MealCategory, NutritionPreference, Preferences } from "@/types";
import { pantryItemFromRow } from "@/lib/pantry";

function publicUser(user: { id: string; name: string | null; username: string | null; image: string | null }): AccountUser {
  return { id: user.id, name: user.name ?? user.username ?? "MealSwipe member", username: user.username, image: user.image };
}

function preferencesFromRow(row: {
  dietaryPreference: string;
  allergies: string[];
  dislikedIngredients: string[];
  cookingCategories: string[];
} | null): Preferences {
  return {
    dietary: (row?.dietaryPreference ?? "Everything") as DietaryPreference,
    allergies: (row?.allergies ?? []) as Allergen[],
    dislikedIngredients: row?.dislikedIngredients ?? [],
    categories: (row?.cookingCategories ?? []) as MealCategory[],
  };
}

function mealFromJson(value: Prisma.JsonValue): Meal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as unknown as Meal;
  return typeof candidate.id === "string" && typeof candidate.title === "string" ? candidate : null;
}

function inviteSummary(invite: {
  id: string;
  householdId: string;
  createdAt: Date;
  household: { name: string };
  invitedByUser: { id: string; name: string | null; username: string | null; image: string | null };
  invitedUser?: { id: string; name: string | null; username: string | null; image: string | null };
}): HouseholdInviteSummary {
  return {
    id: invite.id,
    householdId: invite.householdId,
    householdName: invite.household.name,
    invitedBy: publicUser(invite.invitedByUser),
    invitedUser: invite.invitedUser ? publicUser(invite.invitedUser) : undefined,
    createdAt: invite.createdAt.toISOString(),
  };
}

export async function getAccountBootstrap(userId: string): Promise<AccountBootstrap> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      preference: true,
      membership: {
        include: {
          household: {
            include: {
              memberships: { include: { user: { include: { preference: true } } }, orderBy: { joinedAt: "asc" } },
              invites: {
                where: { status: "PENDING" },
                include: { household: true, invitedByUser: true, invitedUser: true },
                orderBy: { createdAt: "desc" },
              },
              weeklyPlans: { orderBy: { updatedAt: "desc" }, take: 1 },
              pantryItems: { orderBy: [{ displayName: "asc" }, { createdAt: "asc" }] },
            },
          },
        },
      },
      invitesReceived: {
        where: { status: "PENDING" },
        include: { household: true, invitedByUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const memberIds = user.membership?.household.memberships.map((membership) => membership.userId) ?? [user.id];
  const [swipes, recipes] = await Promise.all([
    prisma.swipeEvent.findMany({ where: { userId: { in: memberIds } }, orderBy: { createdAt: "desc" } }),
    prisma.savedRecipe.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: { in: memberIds }, visibility: { in: ["HOUSEHOLD", "PUBLIC"] } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const latestByMemberAndRecipe = new Map<string, (typeof swipes)[number]>();
  for (const swipe of swipes) {
    const key = `${swipe.userId}:${swipe.recipeIdentifier}`;
    if (!latestByMemberAndRecipe.has(key)) latestByMemberAndRecipe.set(key, swipe);
  }
  const ownLatest = [...latestByMemberAndRecipe.values()].filter((swipe) => swipe.userId === user.id);
  const usernames = new Map(
    (user.membership?.household.memberships ?? []).map((membership) => [membership.userId, membership.user.username ?? membership.user.name ?? "member"]),
  );
  const householdSignals: Record<string, string[]> = {};
  for (const swipe of latestByMemberAndRecipe.values()) {
    if (swipe.action !== "LIKED" && swipe.action !== "SAVED") continue;
    const handle = usernames.get(swipe.userId);
    if (handle) householdSignals[swipe.recipeIdentifier] = [...(householdSignals[swipe.recipeIdentifier] ?? []), handle];
  }

  const dynamicMeals = recipes.map((recipe) => mealFromJson(recipe.recipe)).filter((meal): meal is Meal => Boolean(meal));
  const household = user.membership?.household;
  const latestPlan = household?.weeklyPlans[0]?.selectedRecipes;

  return {
    user: publicUser(user),
    preferences: preferencesFromRow(user.preference),
    household: household ? {
      id: household.id,
      name: household.name,
      members: household.memberships.map((membership) => ({
        id: membership.user.id,
        name: membership.user.name ?? membership.user.username ?? "Member",
        username: membership.user.username ?? undefined,
        dietary: (membership.user.preference?.dietaryPreference ?? "Everything") as DietaryPreference,
        allergies: (membership.user.preference?.allergies ?? []) as Allergen[],
        dislikedIngredients: membership.user.preference?.dislikedIngredients ?? [],
        nutritionPreference: (membership.user.preference?.nutritionPreference ?? "Balanced") as NutritionPreference,
      })),
      settings: {
        adults: household.adults,
        children: household.children,
        dinnersPerWeek: household.dinnersPerWeek,
        maximumCookingTime: household.maximumCookingTime,
        weeklyBudget: household.weeklyBudget ?? undefined,
      },
    } : null,
    householdRole: user.membership?.role ?? null,
    receivedInvites: user.invitesReceived.map(inviteSummary),
    pendingInvites: household?.invites.map(inviteSummary) ?? [],
    savedIds: ownLatest.filter((swipe) => swipe.action === "LIKED" || swipe.action === "SAVED").map((swipe) => swipe.recipeIdentifier),
    skippedIds: ownLatest.filter((swipe) => swipe.action === "SKIPPED").map((swipe) => swipe.recipeIdentifier),
    dynamicMeals,
    householdSignals,
    recipeVisibility: Object.fromEntries(recipes.filter((recipe) => recipe.userId === user.id).map((recipe) => [recipe.recipeIdentifier, recipe.visibility])),
    latestPlanIds: Array.isArray(latestPlan) ? latestPlan.map((id) => typeof id === "string" ? id : null) : [],
    pantryItems: household?.pantryItems.map(pantryItemFromRow) ?? [],
  };
}
