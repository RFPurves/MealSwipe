import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Onboarding } from "@/components/onboarding";
import { prisma } from "@/lib/prisma";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  if ((await searchParams).demo === "vc") redirect("/week?demo=vc");
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { profileCompleted: true } });
  if (user?.profileCompleted) redirect("/discover");
  return <Onboarding />;
}
