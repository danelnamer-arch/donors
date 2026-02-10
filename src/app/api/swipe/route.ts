import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseMatch, recordMatchUsage } from "@/lib/paddle";

/**
 * POST /api/swipe
 * Record a swipe action (RIGHT or LEFT) on a match.
 *
 * Body: { matchId, action: "RIGHT" | "LEFT" }
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

    const { matchId, action } = await request.json();

    if (!matchId || !["RIGHT", "LEFT"].includes(action)) {
      return NextResponse.json(
        { error: "matchId and action (RIGHT or LEFT) are required" },
        { status: 400 }
      );
    }

    // Check usage limits
    const usage = await canUseMatch(orgId);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason, upgrade: true },
        { status: 403 }
      );
    }

    // Verify the match belongs to this org
    const match = await prisma.match.findFirst({
      where: { id: matchId, organizationId: orgId },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Update match status
    const newStatus = action === "RIGHT" ? "SWIPED_RIGHT" : "SWIPED_LEFT";
    await prisma.match.update({
      where: { id: matchId },
      data: { status: newStatus },
    });

    // Record usage
    await recordMatchUsage(orgId);

    // Record feedback for the learning loop
    await prisma.swipeFeedback.create({
      data: {
        organizationId: orgId,
        donorId: match.donorId,
        action,
        donorSnapshot: JSON.parse(JSON.stringify({ score: match.score })),
      },
    });

    // If swiped right, create a pipeline entry
    if (action === "RIGHT") {
      await prisma.pipelineEntry.create({
        data: {
          organizationId: orgId,
          donorId: match.donorId,
          stage: "DISCOVERED",
        },
      });
    }

    return NextResponse.json({
      status: newStatus,
      ...(action === "RIGHT"
        ? { message: "Added to your pipeline!" }
        : { message: "Got it, we'll improve future suggestions." }),
    });
  } catch (error) {
    console.error("Swipe error:", error);
    return NextResponse.json(
      { error: "Swipe failed" },
      { status: 500 }
    );
  }
}
