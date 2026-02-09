import { NextRequest, NextResponse } from "next/server";
import { runEnrichmentPipeline } from "@/lib/agents";

/**
 * POST /api/research/enrich
 * Trigger deep enrichment for a specific donor.
 * This is the paid feature — runs comprehensive research.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { donorId } = body;

    if (!donorId) {
      return NextResponse.json(
        { error: "donorId is required" },
        { status: 400 }
      );
    }

    // TODO: Check user subscription and enrichment credits

    const result = await runEnrichmentPipeline(donorId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Enrichment pipeline error:", error);
    return NextResponse.json(
      { error: "Enrichment pipeline failed" },
      { status: 500 }
    );
  }
}
