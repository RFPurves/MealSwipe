-- Personal-first account state. This migration is additive and preserves all
-- existing household memberships, plans, pantry items, swipes, and recipes.
ALTER TABLE "User"
  ADD COLUMN "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

ALTER TABLE "UserPreference"
  ADD COLUMN "personalDinnersPerWeek" INTEGER NOT NULL DEFAULT 7;

-- Existing production users with a username and preference row have already
-- completed the equivalent profile setup and must not be sent through it again.
UPDATE "User" AS users
SET
  "profileCompleted" = true,
  "profileCompletedAt" = COALESCE(users."updatedAt", CURRENT_TIMESTAMP)
WHERE users."username" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "UserPreference" AS preferences
    WHERE preferences."userId" = users."id"
  );

CREATE TABLE "PersonalPantryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION,
  "unit" TEXT,
  "source" "PantryItemSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalPantryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonalWeeklyPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "selectedRecipes" JSONB NOT NULL,
  "plannerSettings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalWeeklyPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonalPantryItem_userId_normalizedName_key"
  ON "PersonalPantryItem"("userId", "normalizedName");
CREATE INDEX "PersonalPantryItem_userId_updatedAt_idx"
  ON "PersonalPantryItem"("userId", "updatedAt");
CREATE INDEX "PersonalWeeklyPlan_userId_weekStart_idx"
  ON "PersonalWeeklyPlan"("userId", "weekStart");

ALTER TABLE "PersonalPantryItem"
  ADD CONSTRAINT "PersonalPantryItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalWeeklyPlan"
  ADD CONSTRAINT "PersonalWeeklyPlan_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
