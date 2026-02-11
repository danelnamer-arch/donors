import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/notes
 * Add a note to a pipeline entry.
 * Body: { pipelineEntryId, content }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    const { pipelineEntryId, content } = await request.json();

    if (!pipelineEntryId || !content?.trim()) {
      return NextResponse.json(
        { error: "pipelineEntryId and content are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const entry = await prisma.pipelineEntry.findFirst({
      where: { id: pipelineEntryId, organizationId: orgId },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const note = await prisma.note.create({
      data: {
        pipelineEntryId,
        userId: user.id,
        content: content.trim(),
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        pipelineEntryId,
        userId: user.id,
        action: "NOTE_ADDED",
      },
    });

    return NextResponse.json({
      note: {
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        user: note.user.name || note.user.email,
      },
    });
  } catch (error) {
    console.error("Note creation error:", error);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
