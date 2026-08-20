import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (name.length < 2) throw new ApiError(400, "Give your household a name.");
    const existing = await prisma.householdMembership.findUnique({ where: { userId: user.id } });
    if (existing) throw new ApiError(409, "You already belong to a household.");
    const household = await prisma.household.create({
      data: {
        name,
        createdById: user.id,
        adults: Math.min(12, Math.max(1, Number(body.adults) || 1)),
        children: Math.min(12, Math.max(0, Number(body.children) || 0)),
        dinnersPerWeek: Math.min(7, Math.max(1, Number(body.dinnersPerWeek) || 7)),
        maximumCookingTime: Math.min(240, Math.max(10, Number(body.maximumCookingTime) || 45)),
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    return Response.json({ householdId: household.id }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
