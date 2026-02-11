import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/donors/:id
 * Get full donor profile with grants, publications, pipeline info, and notes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: {
        grants: { orderBy: { amount: "desc" }, take: 20 },
        publications: { orderBy: { publishedAt: "desc" }, take: 10 },
      },
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Get pipeline entry if in user's pipeline
    let pipelineEntry = null;
    if (user.organizationId) {
      pipelineEntry = await prisma.pipelineEntry.findUnique({
        where: {
          organizationId_donorId: {
            organizationId: user.organizationId,
            donorId: id,
          },
        },
        include: {
          notes: {
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } } },
          },
          activityLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });
    }

    // Giving stats
    const totalGiving = donor.grants.reduce((sum, g) => sum + (g.amount || 0), 0);
    const grantYears = donor.grants.map((g) => g.year).filter(Boolean) as number[];
    const avgGrant = donor.grants.length > 0 ? totalGiving / donor.grants.length : 0;

    return NextResponse.json({
      donor: {
        id: donor.id,
        name: donor.name,
        type: donor.type,
        description: donor.description,
        website: donor.website,
        email: donor.email,
        phone: donor.phone,
        country: donor.country,
        city: donor.city,
        causes: donor.causes,
        targetPopulations: donor.targetPopulations,
        geographicFocus: donor.geographicFocus,
        dataQualityScore: donor.dataQualityScore,
      },
      grants: donor.grants.map((g) => ({
        id: g.id,
        recipientName: g.recipientName,
        amount: g.amount,
        currency: g.currency,
        year: g.year,
        purpose: g.purpose,
        sourceUrl: g.sourceUrl,
      })),
      publications: donor.publications.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        url: p.url,
        summary: p.summary,
        publishedAt: p.publishedAt,
      })),
      stats: {
        totalGiving,
        avgGrant: Math.round(avgGrant),
        grantCount: donor.grants.length,
        yearRange:
          grantYears.length > 0
            ? `${Math.min(...grantYears)}–${Math.max(...grantYears)}`
            : null,
      },
      pipeline: pipelineEntry
        ? {
            id: pipelineEntry.id,
            stage: pipelineEntry.stage,
            enrichmentStatus: pipelineEntry.enrichmentStatus,
            enrichedData: pipelineEntry.enrichedData,
            notes: pipelineEntry.notes.map((n) => ({
              id: n.id,
              content: n.content,
              createdAt: n.createdAt,
              user: n.user.name || n.user.email,
            })),
            activity: pipelineEntry.activityLogs.map((a) => ({
              id: a.id,
              action: a.action,
              details: a.details,
              createdAt: a.createdAt,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("Donor detail error:", error);
    return NextResponse.json({ error: "Failed to load donor" }, { status: 500 });
  }
}
