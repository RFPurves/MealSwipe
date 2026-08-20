import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireAuthUser() {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError(401, "Authentication required.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new ApiError(401, "Your session is no longer valid.");
  return user;
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ message: error.message }, { status: error.status });
  }
  console.error("Authenticated API request failed", error);
  return Response.json({ message: "The request could not be completed." }, { status: 500 });
}
