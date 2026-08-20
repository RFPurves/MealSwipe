import { PantryItemSource, Prisma } from "@prisma/client";
import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { normalizePantryName, normalizePantryUnit, pantryItemFromRow } from "@/lib/pantry";
import { prisma } from "@/lib/prisma";

const SOURCES = {
  manual: PantryItemSource.MANUAL,
  camera: PantryItemSource.CAMERA,
  barcode: PantryItemSource.BARCODE,
  "ai-detected": PantryItemSource.AI_DETECTED,
} as const;

function nameFields(value: unknown) {
  if (typeof value !== "string") throw new ApiError(400, "A pantry item name is required.");
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
  const normalizedName = normalizePantryName(displayName);
  if (!normalizedName) throw new ApiError(400, "A pantry item name is required.");
  return { displayName, normalizedName };
}

function quantity(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new ApiError(400, "Quantity must be a non-negative number.");
  return value;
}

function unit(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "Unit must be text.");
  return normalizePantryUnit(value).slice(0, 32) || null;
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const items = await prisma.personalPantryItem.findMany({ where: { userId: user.id }, orderBy: [{ displayName: "asc" }, { createdAt: "asc" }] });
    return Response.json({ items: items.map(pantryItemFromRow) });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const name = nameFields(body.name);
    const existing = await prisma.personalPantryItem.findUnique({ where: { userId_normalizedName: { userId: user.id, normalizedName: name.normalizedName } } });
    if (existing) return Response.json({ item: pantryItemFromRow(existing), duplicate: true });
    const source = typeof body.source === "string" && body.source in SOURCES ? SOURCES[body.source as keyof typeof SOURCES] : PantryItemSource.MANUAL;
    const item = await prisma.personalPantryItem.create({ data: { userId: user.id, ...name, quantity: quantity(body.quantity) ?? null, unit: unit(body.unit) ?? null, source } });
    return Response.json({ item: pantryItemFromRow(item), duplicate: false }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ message: "That item is already in your pantry." }, { status: 409 });
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") throw new ApiError(400, "A pantry item ID is required.");
    const existing = await prisma.personalPantryItem.findFirst({ where: { id: body.id, userId: user.id } });
    if (!existing) throw new ApiError(404, "Pantry item not found.");
    const name = body.name === undefined ? undefined : nameFields(body.name);
    if (name && name.normalizedName !== existing.normalizedName) {
      const duplicate = await prisma.personalPantryItem.findUnique({ where: { userId_normalizedName: { userId: user.id, normalizedName: name.normalizedName } } });
      if (duplicate) throw new ApiError(409, "That item is already in your pantry.");
    }
    const nextQuantity = quantity(body.quantity);
    const nextUnit = unit(body.unit);
    const item = await prisma.personalPantryItem.update({ where: { id: existing.id }, data: { ...(name ?? {}), ...(nextQuantity !== undefined ? { quantity: nextQuantity } : {}), ...(nextUnit !== undefined ? { unit: nextUnit } : {}) } });
    return Response.json({ item: pantryItemFromRow(item) });
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") throw new ApiError(400, "A pantry item ID is required.");
    const result = await prisma.personalPantryItem.deleteMany({ where: { id: body.id, userId: user.id } });
    if (!result.count) throw new ApiError(404, "Pantry item not found.");
    return Response.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
