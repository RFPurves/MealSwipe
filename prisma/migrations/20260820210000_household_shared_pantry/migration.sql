CREATE TYPE "PantryItemSource" AS ENUM ('MANUAL', 'CAMERA', 'BARCODE', 'AI_DETECTED');

CREATE TABLE "HouseholdPantryItem" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION,
  "unit" TEXT,
  "source" "PantryItemSource" NOT NULL DEFAULT 'MANUAL',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdPantryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HouseholdPantryItem_householdId_normalizedName_key"
  ON "HouseholdPantryItem"("householdId", "normalizedName");
CREATE INDEX "HouseholdPantryItem_householdId_updatedAt_idx"
  ON "HouseholdPantryItem"("householdId", "updatedAt");
CREATE INDEX "HouseholdPantryItem_createdByUserId_idx"
  ON "HouseholdPantryItem"("createdByUserId");

ALTER TABLE "HouseholdPantryItem"
  ADD CONSTRAINT "HouseholdPantryItem_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HouseholdPantryItem"
  ADD CONSTRAINT "HouseholdPantryItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
