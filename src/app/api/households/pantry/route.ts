import { PantryItemSource, Prisma } from "@prisma/client";
import { ApiError, apiFailure, requireHouseholdMembership } from "@/lib/auth-user";
import { normalizePantryName, normalizePantryUnit, pantryItemFromRow } from "@/lib/pantry";
import { prisma } from "@/lib/prisma";
import { metricQuantity } from "@/lib/metric";

const SOURCE_BY_CLIENT = {
  manual: PantryItemSource.MANUAL,
  camera: PantryItemSource.CAMERA,
  barcode: PantryItemSource.BARCODE,
  "ai-detected": PantryItemSource.AI_DETECTED,
} as const;

function parseName(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "A pantry item name is required.");
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
  const normalizedName = normalizePantryName(displayName);
  if (!normalizedName) throw new ApiError(400, "A pantry item name is required.");
  return { displayName, normalizedName };
}

function parseQuantity(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw new ApiError(400, "Quantity must be a non-negative number.");
  }
  return value;
}

function parseUnit(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "Unit must be text.");
  const unit = normalizePantryUnit(value).slice(0, 32);
  return unit || null;
}

function metricFields(quantity: number | null, unit: string | null) {
  if (quantity === null || !unit) return { quantity, unit };
  const metric = metricQuantity(quantity, unit);
  return { quantity: metric.amount, unit: metric.unit || null };
}

function parseSource(value: unknown) {
  if (value === undefined) return PantryItemSource.MANUAL;
  if (typeof value !== "string" || !(value in SOURCE_BY_CLIENT)) throw new ApiError(400, "Unknown pantry item source.");
  return SOURCE_BY_CLIENT[value as keyof typeof SOURCE_BY_CLIENT];
}

export async function GET() {
  try {
    const { membership } = await requireHouseholdMembership();
    const items = await prisma.householdPantryItem.findMany({
      where: { householdId: membership.householdId },
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
    });
    return Response.json({ items: items.map(pantryItemFromRow) });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireHouseholdMembership();
    const body = await request.json() as Record<string, unknown>;
    const name = parseName(body.name);
    const quantity = parseQuantity(body.quantity);
    const unit = parseUnit(body.unit);
    const measurements = metricFields(quantity ?? null, unit ?? null);
    const existing = await prisma.householdPantryItem.findUnique({
      where: { householdId_normalizedName: { householdId: membership.householdId, normalizedName: name.normalizedName } },
    });
    if (existing) return Response.json({ item: pantryItemFromRow(existing), duplicate: true });
    const item = await prisma.householdPantryItem.create({
      data: {
        householdId: membership.householdId,
        createdByUserId: user.id,
        ...name,
        ...measurements,
        source: parseSource(body.source),
      },
    });
    return Response.json({ item: pantryItemFromRow(item), duplicate: false }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ message: "That item is already in the household pantry." }, { status: 409 });
    }
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { membership } = await requireHouseholdMembership();
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") throw new ApiError(400, "A pantry item ID is required.");
    const existing = await prisma.householdPantryItem.findFirst({ where: { id: body.id, householdId: membership.householdId } });
    if (!existing) throw new ApiError(404, "Pantry item not found.");
    const name = body.name === undefined ? undefined : parseName(body.name);
    if (name && name.normalizedName !== existing.normalizedName) {
      const duplicate = await prisma.householdPantryItem.findUnique({
        where: { householdId_normalizedName: { householdId: membership.householdId, normalizedName: name.normalizedName } },
      });
      if (duplicate) throw new ApiError(409, "That item is already in the household pantry.");
    }
    const quantity = parseQuantity(body.quantity);
    const unit = parseUnit(body.unit);
    const measurements = quantity !== undefined || unit !== undefined
      ? metricFields(quantity === undefined ? existing.quantity : quantity, unit === undefined ? existing.unit : unit)
      : {};
    const item = await prisma.householdPantryItem.update({
      where: { id: existing.id },
      data: {
        ...(name ?? {}),
        ...measurements,
      },
    });
    return Response.json({ item: pantryItemFromRow(item) });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { membership } = await requireHouseholdMembership();
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") throw new ApiError(400, "A pantry item ID is required.");
    const result = await prisma.householdPantryItem.deleteMany({ where: { id: body.id, householdId: membership.householdId } });
    if (!result.count) throw new ApiError(404, "Pantry item not found.");
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
