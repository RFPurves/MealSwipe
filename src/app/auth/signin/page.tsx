import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInCard } from "@/components/sign-in-card";

export default async function SignInPage() {
  if (await auth()) redirect("/");
  return <SignInCard
    google={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)}
    email={Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM)}
    microsoft={Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET && process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)}
    dev={process.env.NODE_ENV === "development" && process.env.AUTH_DEV_LOGIN === "true"}
  />;
}
