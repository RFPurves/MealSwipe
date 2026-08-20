import { getAccountBootstrap } from "@/lib/account-data";
import { apiFailure, requireAuthUser } from "@/lib/auth-user";

export async function GET() {
  try {
    const user = await requireAuthUser();
    return Response.json({ account: await getAccountBootstrap(user.id) });
  } catch (error) {
    return apiFailure(error);
  }
}
