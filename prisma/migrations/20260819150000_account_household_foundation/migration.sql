CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "SwipeAction" AS ENUM ('LIKED', 'SKIPPED', 'SAVED');
CREATE TYPE "RecipeVisibility" AS ENUM ('PRIVATE', 'HOUSEHOLD', 'PUBLIC');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "emailVerified" TIMESTAMP(3),
  "name" TEXT,
  "username" TEXT,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Account" (
  "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT, "access_token" TEXT, "expires_at" INTEGER, "token_type" TEXT, "scope" TEXT, "id_token" TEXT, "session_state" TEXT,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("provider", "providerAccountId")
);
CREATE TABLE "Session" ("sessionToken" TEXT NOT NULL, "userId" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL);
CREATE TABLE "VerificationToken" ("identifier" TEXT NOT NULL, "token" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL, CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token"));
CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "dietaryPreference" TEXT NOT NULL DEFAULT 'Everything',
  "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[], "dislikedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "nutritionPreference" TEXT NOT NULL DEFAULT 'Balanced', "cookingCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "maximumCookingTime" INTEGER NOT NULL DEFAULT 45, "strictDislikes" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Household" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "createdById" TEXT NOT NULL, "adults" INTEGER NOT NULL DEFAULT 2,
  "children" INTEGER NOT NULL DEFAULT 0, "dinnersPerWeek" INTEGER NOT NULL DEFAULT 7, "maximumCookingTime" INTEGER NOT NULL DEFAULT 45,
  "weeklyBudget" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HouseholdMembership" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "householdId" TEXT NOT NULL, "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "HouseholdMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HouseholdInvite" (
  "id" TEXT NOT NULL, "householdId" TEXT NOT NULL, "invitedUserId" TEXT NOT NULL, "invitedByUserId" TEXT NOT NULL,
  "status" "InviteStatus" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SwipeEvent" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "recipeIdentifier" TEXT NOT NULL, "action" "SwipeAction" NOT NULL,
  "mealSnapshot" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SwipeEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SavedRecipe" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "recipeIdentifier" TEXT NOT NULL, "recipe" JSONB NOT NULL,
  "provenance" JSONB, "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PRIVATE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SavedRecipe_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WeeklyPlan" (
  "id" TEXT NOT NULL, "householdId" TEXT NOT NULL, "generatedById" TEXT NOT NULL, "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL, "selectedRecipes" JSONB NOT NULL, "plannerSettings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE INDEX "Household_createdById_idx" ON "Household"("createdById");
CREATE UNIQUE INDEX "HouseholdMembership_userId_key" ON "HouseholdMembership"("userId");
CREATE INDEX "HouseholdMembership_householdId_idx" ON "HouseholdMembership"("householdId");
CREATE UNIQUE INDEX "HouseholdMembership_userId_householdId_key" ON "HouseholdMembership"("userId", "householdId");
CREATE INDEX "HouseholdInvite_invitedUserId_status_idx" ON "HouseholdInvite"("invitedUserId", "status");
CREATE INDEX "HouseholdInvite_householdId_status_idx" ON "HouseholdInvite"("householdId", "status");
CREATE UNIQUE INDEX "HouseholdInvite_one_pending_per_user" ON "HouseholdInvite"("householdId", "invitedUserId") WHERE "status" = 'PENDING';
CREATE INDEX "SwipeEvent_userId_createdAt_idx" ON "SwipeEvent"("userId", "createdAt");
CREATE INDEX "SwipeEvent_recipeIdentifier_action_idx" ON "SwipeEvent"("recipeIdentifier", "action");
CREATE INDEX "SavedRecipe_userId_visibility_idx" ON "SavedRecipe"("userId", "visibility");
CREATE UNIQUE INDEX "SavedRecipe_userId_recipeIdentifier_key" ON "SavedRecipe"("userId", "recipeIdentifier");
CREATE INDEX "WeeklyPlan_householdId_weekStart_idx" ON "WeeklyPlan"("householdId", "weekStart");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Household" ADD CONSTRAINT "Household_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SwipeEvent" ADD CONSTRAINT "SwipeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
