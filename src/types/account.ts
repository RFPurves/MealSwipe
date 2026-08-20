import type { Household, Meal, PantryItem, Preferences } from "@/types";

export type HouseholdRole = "OWNER" | "MEMBER";
export type RecipeVisibility = "PRIVATE" | "HOUSEHOLD" | "PUBLIC";

export interface AccountUser {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export interface HouseholdInviteSummary {
  id: string;
  householdId: string;
  householdName: string;
  invitedBy: AccountUser;
  invitedUser?: AccountUser;
  createdAt: string;
}

export interface AccountBootstrap {
  user: AccountUser;
  preferences: Preferences;
  household: Household | null;
  householdRole: HouseholdRole | null;
  receivedInvites: HouseholdInviteSummary[];
  pendingInvites: HouseholdInviteSummary[];
  savedIds: string[];
  skippedIds: string[];
  dynamicMeals: Meal[];
  householdSignals: Record<string, string[]>;
  recipeVisibility: Record<string, RecipeVisibility>;
  latestPlanIds: (string | null)[];
  pantryItems: PantryItem[];
}
