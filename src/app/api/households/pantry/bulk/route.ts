import { PantryItemSource } from "@prisma/client";
import { ApiError, apiFailure, requireHouseholdMembership } from "@/lib/auth-user";
import { normalizePantryName, pantryItemFromRow } from "@/lib/pantry";
import { prisma } from "@/lib/prisma";

const SOURCES = {
  camera: PantryItemSource.CAMERA,
  barcode: PantryItemSource.BARCODE,
  "ai-detected": PantryItemSource.AI_DETECTED,
} as const;

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireHouseholdMembership();
    const body = await request.json() as Record<string, unknown>;
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
      throw new ApiError(400, "Confirm between 1 and 50 detected pantry items.");
    }
    const source = typeof body.source === "string" && body.source in SOURCES
      ? SOURCES[body.source as keyof typeof SOURCES]
      : SOURCES["ai-detected"];
    const deduplicated = new Map<string, string>();
    for (const value of body.items) {
      if (!value || typeof value !== "object" || Array.isArray(value) || !("name" in value) || typeof value.name !== "string") {
        throw new ApiError(400, "Every detected item needs a name.");
      }
      const displayName = value.name.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
      const normalizedName = normalizePantryName(displayName);
      if (normalizedName) deduplicated.set(normalizedName, displayName);
    }
    if (!deduplicated.size) throw new ApiError(400, "No usable pantry items were detected.");
    await prisma.$transaction([...deduplicated].map(([normalizedName, displayName]) => prisma.householdPantryItem.upsert({
      where: { householdId_normalizedName: { householdId: membership.householdId, normalizedName } },
      create: { householdId: membership.householdId, createdByUserId: user.id, normalizedName, displayName, source },
      update: {},
    })));
    const items = await prisma.householdPantryItem.findMany({
      where: { householdId: membership.householdId },
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return Response.json({ items: items.map(pantryItemFromRow) });
  } catch (error) {
    return apiFailure(error);
  }
}
