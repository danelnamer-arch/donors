/**
 * NextAuth configuration.
 * Uses email/password credentials as the primary auth method.
 * Google OAuth can be added later.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/** Hash a password using scrypt (built-in Node.js, no extra deps). */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, buf) => {
      if (err) return reject(err);
      resolve(`${salt}:${buf.toString("hex")}`);
    });
  });
}

/** Verify a password against its hash. */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [salt, key] = hash.split(":");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, buf) => {
      if (err) return reject(err);
      resolve(buf.toString("hex") === key);
    });
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Email + password login
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[auth] Missing email or password");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            console.log("[auth] No user found for:", credentials.email);
            return null;
          }

          if (!user.passwordHash) {
            console.log("[auth] User has no password hash:", credentials.email);
            return null;
          }

          const valid = await verifyPassword(
            credentials.password,
            user.passwordHash
          );

          if (!valid) {
            console.log("[auth] Invalid password for:", credentials.email);
            return null;
          }

          console.log("[auth] Login success for:", credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (err) {
          console.error("[auth] Error during login:", err);
          return null;
        }
      },
    }),
    // Google OAuth (optional — works when env vars are set)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      // Fetch org info on every token refresh
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { organizationId: true, role: true },
        });
        token.organizationId = dbUser?.organizationId ?? null;
        token.role = dbUser?.role ?? "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).organizationId =
          token.organizationId;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
