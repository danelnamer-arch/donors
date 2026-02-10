import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

/**
 * Get the authenticated user from the JWT token in cookies.
 * More reliable than getServerSession in Next.js 16 App Router.
 */
export async function getAuthUser(request?: NextRequest | Request) {
  // For route handlers, extract token from cookies
  const token = await getToken({
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.userId) return null;

  return {
    id: token.userId as string,
    organizationId: (token.organizationId as string) ?? null,
    role: (token.role as string) ?? "ADMIN",
    email: token.email ?? null,
  };
}
