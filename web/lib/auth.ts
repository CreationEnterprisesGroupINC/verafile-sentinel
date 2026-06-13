import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await getUserByEmail(credentials.email);
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, persist the user id into the token.
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Enrich the session with fresh plan/usage data on every read so the
      // UI never shows stale limits after an upgrade or an anchor.
      if (token.userId) {
        const user = await getUserById(token.userId as string);
        if (user) {
          session.user = {
            ...session.user,
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            plan: user.plan,
            anchorsUsed: user.anchors_used_this_month,
            anchorLimit: user.anchor_limit,
            subscriptionStatus: user.subscription_status,
          };
        }
      }
      return session;
    },
  },
};
