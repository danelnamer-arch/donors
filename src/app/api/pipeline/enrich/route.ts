import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseEnrichment, recordEnrichmentUsage } from "@/lib/paddle";
import { runEnrichmentPipeline } from "@/lib/agents/orchestrator";

/**
 * POST /api/pipeline/enrich
 * Trigger deep research enrichment on a pipeline donor.
 *
 * Body: { entryId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.user as Record<string, unknown>).organizationId as string | undefined;
    if (!orgId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const { entryId } = await request.json();
    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    }

    // Verify ownership
    const entry = await prisma.pipelineEntry.findFirst({
      where: { id: entryId, organizationId: orgId },
      include: { donor: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Check enrichment limits
    const usage = await canUseEnrichment(orgId);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason, upgrade: true },
        { status: 403 }
      );
    }

    // Mark as enriching
    await prisma.pipelineEntry.update({
      where: { id: entryId },
      data: { enrichmentStatus: "IN_PROGRESS" },
    });

    // Run enrichment pipeline
    const result = await runEnrichmentPipeline(entry.donorId);

    if (result.success) {
      // Record usage
      await recordEnrichmentUsage(orgId);

      // Update pipeline entry
      await prisma.pipelineEntry.update({
        where: { id: entryId },
        data: {
          enrichmentStatus: "COMPLETED",
          enrichedData: result.enrichedData
            ? JSON.parse(JSON.stringify(result.enrichedData))
            : undefined,
        },
      });

      return NextResponse.json({
        success: true,
        enrichedData: result.enrichedData,
        remaining: (usage.remaining ?? 1) - 1,
      });
    } else {
      // Mark as failed
      await prisma.pipelineEntry.update({
        where: { id: entryId },
        data: { enrichmentStatus: "FAILED" },
      });

      return NextResponse.json(
        { error: result.error || "Enrichment failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Enrichment error:", error);
    return NextResponse.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}
