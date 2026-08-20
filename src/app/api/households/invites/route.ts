import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/usernames";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json() as Record<string, unknown>;
    const username = normalizeUsername(String(body.username ?? ""));
    const membership = await prisma.householdMembership.findUnique({ where: { userId: user.id } });
    if (!membership || membership.role !== "OWNER") throw new ApiError(403, "Only the household owner can send invitations.");
    const invitedUser = await prisma.user.findUnique({ where: { username }, include: { membership: true } });
    if (!invitedUser) throw new ApiError(404, "No MealSwipe account has that username.");
    if (invitedUser.id === user.id) throw new ApiError(400, "You cannot invite yourself.");
    if (invitedUser.membership) throw new ApiError(409, "That person already belongs to a household.");
    const duplicate = await prisma.householdInvite.findFirst({
      where: { householdId: membership.householdId, invitedUserId: invitedUser.id, status: "PENDING" },
    });
    if (duplicate) throw new ApiError(409, "An invitation is already pending for that person.");
    const invite = await prisma.householdInvite.create({
      data: { householdId: membership.householdId, invitedUserId: invitedUser.id, invitedByUserId: user.id },
    });
    return Response.json({ inviteId: invite.id }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}
