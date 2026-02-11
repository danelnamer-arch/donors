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
    async signIn({ user, account }) {
      // For Google OAuth: auto-create user in DB on first login
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (!existing) {
            const dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || null,
              },
            });
            console.log("[auth] Created Google user:", dbUser.email);
            user.id = dbUser.id;
          } else {
            console.log("[auth] Google login for existing user:", existing.email);
            user.id = existing.id;
          }
        } catch (err) {
          console.error("[auth] Error creating Google user:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      // Fetch org info — wrapped in try/catch so auth still works if DB is slow
      if (token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { organizationId: true, role: true },
          });
          token.organizationId = dbUser?.organizationId ?? null;
          token.role = dbUser?.role ?? "ADMIN";
        } catch (err) {
          console.error("[auth] DB error in jwt callback:", err);
          // Keep existing token values if DB is unavailable
          token.organizationId = token.organizationId ?? null;
          token.role = token.role ?? "ADMIN";
        }
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
