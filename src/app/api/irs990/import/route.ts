import { NextRequest, NextResponse } from "next/server";
import { importIsraelRelatedFoundations } from "@/lib/irs990";

/**
 * POST /api/irs990/import
 * Trigger IRS 990 data import for Israel-related foundations.
 * This is an admin endpoint — should be protected in production.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxPages = body.maxPages ?? 3;

    const result = await importIsraelRelatedFoundations({ maxPages });

    return NextResponse.json(result);
  } catch (error) {
    console.error("IRS 990 import error:", error);
    return NextResponse.json(
      { error: "IRS 990 import failed" },
      { status: 500 }
    );
  }
}
