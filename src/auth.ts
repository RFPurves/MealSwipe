import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);
if (process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM) {
  providers.push(Resend({ apiKey: process.env.AUTH_RESEND_KEY, from: process.env.AUTH_EMAIL_FROM }));
}
if (
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID
  && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  && process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
) {
  providers.push(MicrosoftEntraID({ issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER }));
}
if (process.env.NODE_ENV === "development" && process.env.AUTH_DEV_LOGIN === "true") {
  providers.push(Credentials({
    id: "dev-login",
    name: "Local test account",
    credentials: {
      email: { label: "Email", type: "email" },
      name: { label: "Name", type: "text" },
    },
    async authorize(credentials) {
      const email = String(credentials.email ?? "").trim().toLowerCase();
      const name = String(credentials.name ?? "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2) return null;
      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: { email, name, emailVerified: new Date(), preference: { create: {} } },
      });
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  pages: { signIn: "/auth/signin" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.userPreference.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    },
  },
});
