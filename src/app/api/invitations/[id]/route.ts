import { Prisma } from "@prisma/client";
import { ApiError, apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const { action } = await request.json() as { action?: string };
    if (action !== "accept" && action !== "decline") throw new ApiError(400, "Choose accept or decline.");
    await prisma.$transaction(async (tx) => {
      const invite = await tx.householdInvite.findUnique({ where: { id } });
      if (!invite || invite.invitedUserId !== user.id || invite.status !== "PENDING") throw new ApiError(404, "This invitation is no longer available.");
      if (action === "accept") {
        const existing = await tx.householdMembership.findUnique({ where: { userId: user.id } });
        if (existing) throw new ApiError(409, "You already belong to a household.");
        await tx.householdMembership.create({ data: { userId: user.id, householdId: invite.householdId, role: "MEMBER" } });
        await tx.householdInvite.update({ where: { id }, data: { status: "ACCEPTED" } });
        await tx.householdInvite.updateMany({ where: { invitedUserId: user.id, status: "PENDING", id: { not: id } }, data: { status: "DECLINED" } });
      } else {
        await tx.householdInvite.update({ where: { id }, data: { status: "DECLINED" } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
