import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { runDiscoveryPipeline } from "@/lib/agents/orchestrator";
import { runEnrichmentPipeline } from "@/lib/agents/orchestrator";
import { runBatchDiscovery, DEFAULT_DISCOVERY_TARGETS } from "@/lib/agents/batch-discovery";
import { importAllSectors, importFoundationsBySector } from "@/lib/irs990";

/**
 * POST /api/admin/actions — Trigger admin actions (discover, enrich, batch-discover, irs990-import).
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

    case "batch-discover": {
      const targets = params.targets ?? DEFAULT_DISCOVERY_TARGETS;
      const result = await runBatchDiscovery({
        targets,
        delayBetweenMs: params.delayBetweenMs ?? 5000,
      });

      return NextResponse.json({
        action: "batch-discover",
        ...result,
      });
    }

    case "irs990-import": {
      const sector = params.sector ?? "all";
      const maxPages = params.maxPages ?? 1;

      if (sector === "all") {
        const result = await importAllSectors({ maxPagesPerKeyword: maxPages });
        return NextResponse.json({ action: "irs990-import", sector, ...result });
      }

      const result = await importFoundationsBySector({
        sector,
        maxPagesPerKeyword: maxPages,
      });
      return NextResponse.json({ action: "irs990-import", sector, ...result });
    }

    case "marathon-status": {
      try {
        const progressPath = path.join(process.cwd(), "scripts/.marathon-progress.json");
        const checkpointPath = path.join(process.cwd(), "scripts/.marathon-checkpoint.json");

        const progress = fs.existsSync(progressPath)
          ? JSON.parse(fs.readFileSync(progressPath, "utf-8"))
          : null;
        const checkpoint = fs.existsSync(checkpointPath)
          ? JSON.parse(fs.readFileSync(checkpointPath, "utf-8"))
          : null;

        return NextResponse.json({
          action: "marathon-status",
          progress,
          checkpoint,
        });
      } catch {
        return NextResponse.json({
          action: "marathon-status",
          progress: null,
          checkpoint: null,
        });
      }
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
