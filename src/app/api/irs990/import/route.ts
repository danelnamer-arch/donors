import { NextRequest, NextResponse } from "next/server";
import {
  importIsraelRelatedFoundations,
  importFoundationsBySector,
  importAllSectors,
  SECTOR_KEYWORDS,
} from "@/lib/irs990";

/**
 * POST /api/irs990/import
 * Trigger IRS 990 data import from ProPublica.
 * This is an admin endpoint — should be protected in production.
 *
 * Body (optional):
 *   { sector?: string, maxPages?: number }
 *
 * sector can be:
 *   - "all" to import from all sectors
 *   - a specific sector key (e.g. "health", "education", "environment")
 *   - omitted to use legacy Israel-related import
 *
 * GET /api/irs990/import — returns available sectors
 */
export async function GET() {
  return NextResponse.json({
    availableSectors: Object.keys(SECTOR_KEYWORDS),
    totalKeywords: Object.values(SECTOR_KEYWORDS).flat().length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sector = body.sector as string | undefined;
    const maxPages = body.maxPages ?? 1;

    if (sector === "all") {
      console.log("Starting IRS 990 import for ALL sectors...");
      const result = await importAllSectors({ maxPagesPerKeyword: maxPages });
      console.log("IRS 990 import complete:", JSON.stringify(result, null, 2));
      return NextResponse.json(result);
    }

    if (sector) {
      console.log(`Starting IRS 990 import for sector: ${sector}...`);
      const result = await importFoundationsBySector({
        sector,
        maxPagesPerKeyword: maxPages,
      });
      console.log("IRS 990 import complete:", JSON.stringify(result, null, 2));
      return NextResponse.json(result);
    }

    // Legacy behavior
    console.log(`Starting IRS 990 import (legacy, maxPages: ${maxPages})...`);
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
