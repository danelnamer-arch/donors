import { NextRequest, NextResponse } from "next/server";
import { runDiscoveryPipeline } from "@/lib/agents/orchestrator";
import { runEnrichmentPipeline } from "@/lib/agents/orchestrator";

/**
 * POST /api/admin/actions — Trigger admin actions (discover, enrich, verify).
 */
export async function POST(req: NextRequest) {
  const { action, ...params } = await req.json();

  switch (action) {
    case "discover": {
      const { cause, targetPopulation, region } = params;
      if (!cause) {
        return NextResponse.json({ error: "cause is required" }, { status: 400 });
      }

      const result = await runDiscoveryPipeline({
        cause,
        targetPopulation,
        region,
      });

      return NextResponse.json({
        action: "discover",
        ...result,
      });
    }

    case "enrich": {
      const { donorId } = params;
      if (!donorId) {
        return NextResponse.json({ error: "donorId is required" }, { status: 400 });
      }

      const result = await runEnrichmentPipeline(donorId);
      return NextResponse.json({
        action: "enrich",
        ...result,
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
