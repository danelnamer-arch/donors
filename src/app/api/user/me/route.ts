import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";

/**
 * GET /api/user/me
 * Returns the current authenticated user's basic info (id, organizationId, role, email).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    console.error("GET /api/user/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
