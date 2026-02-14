import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { weeklyDigestEmail, DigestData } from "@/lib/email/templates";

/**
 * GET /api/cron/weekly-digest
 * Send weekly digest emails to all organizations with users.
 * Protected by CRON_SECRET header.
 *
 * Vercel cron: Monday 9am UTC
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all organizations with their users
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        users: { select: { id: true, email: true } },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const org of orgs) {
      if (org.users.length === 0) {
        skipped++;
        continue;
      }

      // Count new matches this week
      const newMatches = await prisma.match.findMany({
        where: {
          organizationId: org.id,
          createdAt: { gte: oneWeekAgo },
          status: "SWIPED_RIGHT",
        },
        include: { donor: { select: { name: true } } },
        orderBy: { score: "desc" },
        take: 5,
      });

      // Count pipeline changes
      const pipelineChanges = await prisma.activityLog.count({
        where: {
          pipelineEntry: { organizationId: org.id },
          action: "STAGE_CHANGE",
          createdAt: { gte: oneWeekAgo },
        },
      });

      // Count newly funded
      const fundedEntries = await prisma.pipelineEntry.findMany({
        where: {
          organizationId: org.id,
          stage: "FUNDED",
          updatedAt: { gte: oneWeekAgo },
        },
        include: { donor: { select: { name: true } } },
      });

      const data: DigestData = {
        newMatchCount: newMatches.length,
        topMatches: newMatches.map((m) => m.donor.name),
        pipelineChanges,
        fundedCount: fundedEntries.length,
        fundedNames: fundedEntries.map((e) => e.donor.name),
      };

      // Skip if nothing happened
      if (data.newMatchCount === 0 && data.pipelineChanges === 0 && data.fundedCount === 0) {
        skipped++;
        continue;
      }

      const { subject, html } = weeklyDigestEmail(org.name, data);

      // Send to all org users
      await Promise.allSettled(
        org.users.map((user) =>
          sendEmail({
            to: user.email,
            subject,
            html,
            template: "weekly-digest",
            organizationId: org.id,
            userId: user.id,
          })
        )
      );

      sent++;
    }

    return NextResponse.json({
      message: `Weekly digest sent to ${sent} organizations (${skipped} skipped)`,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("Weekly digest cron error:", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
