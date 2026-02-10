import { NextRequest, NextResponse } from "next/server";
import { importIsraelRelatedFoundations } from "@/lib/irs990";

/**
 * POST /api/irs990/import
 * Trigger IRS 990 data import for Israel-related foundations.
 * This is an admin endpoint — should be protected in production.
 *
 * Body (optional): { maxPages?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxPages = body.maxPages ?? 2;

    console.log(`Starting IRS 990 import (maxPages: ${maxPages})...`);
    const result = await importIsraelRelatedFoundations({ maxPages });
    console.log("IRS 990 import complete:", JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (error) {
    console.error("IRS 990 import error:", error);
    return NextResponse.json(
      { error: "IRS 990 import failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}
