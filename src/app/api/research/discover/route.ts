import { NextRequest, NextResponse } from "next/server";
import { runDiscoveryPipeline } from "@/lib/agents";

/**
 * POST /api/research/discover
 * Trigger donor discovery for a given cause/region.
 * This runs the full pipeline: search → research → crawl → validate → store.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cause, targetPopulation, region } = body;

    if (!cause) {
      return NextResponse.json(
        { error: "cause is required" },
        { status: 400 }
      );
    }

    const result = await runDiscoveryPipeline({
      cause,
      targetPopulation,
      region,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discovery pipeline error:", error);
    return NextResponse.json(
      { error: "Discovery pipeline failed" },
      { status: 500 }
    );
  }
}
