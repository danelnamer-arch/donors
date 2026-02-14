import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notifyFunded } from "@/lib/email/notifications";

/**
 * GET /api/pipeline
 * Get all pipeline entries for the user's organization.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const entries = await prisma.pipelineEntry.findMany({
      where: { organizationId: orgId },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            website: true,
            country: true,
            causes: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Pipeline error:", error);
    return NextResponse.json({ error: "Failed to load pipeline" }, { status: 500 });
  }
}

/**
 * PATCH /api/pipeline
 * Update a pipeline entry's stage.
 *
 * Body: { entryId, stage }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const { entryId, stage } = await request.json();

    const validStages = [
      "DISCOVERED",
      "RESEARCHING",
      "OUTREACH",
      "APPLIED",
      "IN_CONVERSATION",
      "FUNDED",
      "REJECTED",
    ];

    if (!entryId || !validStages.includes(stage)) {
      return NextResponse.json(
        { error: "entryId and valid stage are required" },
        { status: 400 }
      );
    }

    // Verify ownership — include donor name for FUNDED notification
    const entry = await prisma.pipelineEntry.findFirst({
      where: { id: entryId, organizationId: orgId },
      include: { donor: { select: { name: true } } },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const updated = await prisma.pipelineEntry.update({
      where: { id: entryId },
      data: { stage },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        pipelineEntryId: entryId,
        userId: user.id,
        action: "STAGE_CHANGE",
        details: JSON.parse(
          JSON.stringify({ from: entry.stage, to: stage })
        ),
      },
    });

    // Fire-and-forget FUNDED notification
    if (stage === "FUNDED" && entry.donor?.name) {
      notifyFunded(orgId, entry.donor.name).catch(() => {});
    }

    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error("Pipeline update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
