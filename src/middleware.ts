import { withAuth } from "next-auth/middleware";

/**
 * Protect app routes — redirect to /login if not authenticated.
 * Public routes (home, login, signup, legal, API health) are excluded.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pipeline/:path*",
    "/billing/:path*",
    "/onboarding/:path*",
  ],
};
