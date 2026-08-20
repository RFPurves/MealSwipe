import { apiFailure, requireAuthUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/usernames";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const q = normalizeUsername(new URL(request.url).searchParams.get("q") ?? "");
    if (q.length < 2) return Response.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { id: { not: user.id }, username: { startsWith: q, mode: "insensitive" } },
      select: { id: true, name: true, username: true, image: true, membership: { select: { householdId: true } } },
      orderBy: { username: "asc" },
      take: 8,
    });
    return Response.json({ users: users.map(({ membership, ...result }) => ({ ...result, available: !membership })) });
  } catch (error) {
    return apiFailure(error);
  }
}
