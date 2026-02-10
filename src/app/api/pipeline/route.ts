import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/pipeline
 * Get all pipeline entries for the user's organization.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.user as Record<string, unknown>).organizationId as string | undefined;
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.user as Record<string, unknown>).organizationId as string | undefined;
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

    // Verify ownership
    const entry = await prisma.pipelineEntry.findFirst({
      where: { id: entryId, organizationId: orgId },
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
        userId: session.user.id,
        action: "STAGE_CHANGE",
        details: JSON.parse(
          JSON.stringify({ from: entry.stage, to: stage })
        ),
      },
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error("Pipeline update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
