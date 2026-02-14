import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateOutreachEmail, type TemplateType } from "@/lib/outreach/generate";

const VALID_TYPES: TemplateType[] = [
  "introduction",
  "follow_up",
  "grant_inquiry",
  "thank_you",
  "loi",
];

/**
 * POST /api/outreach/generate
 * Generate an AI outreach draft for a pipeline entry.
 *
 * Body: { pipelineEntryId, templateType, saveAsNote? }
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

    const { pipelineEntryId, templateType, saveAsNote } = await request.json();

    if (!pipelineEntryId || !templateType || !VALID_TYPES.includes(templateType)) {
      return NextResponse.json(
        { error: "pipelineEntryId and valid templateType are required" },
        { status: 400 }
      );
    }

    // Fetch pipeline entry with donor data, match, and notes
    const entry = await prisma.pipelineEntry.findFirst({
      where: { id: pipelineEntryId, organizationId: orgId },
      include: {
        donor: {
          select: {
            name: true,
            type: true,
            description: true,
            causes: true,
            geographicFocus: true,
            grants: {
              select: { recipientName: true, amount: true, year: true },
              orderBy: { amount: "desc" },
              take: 10,
            },
          },
        },
        notes: {
          select: { content: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Pipeline entry not found" }, { status: 404 });
    }

    // Fetch org profile
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        mission: true,
        causes: true,
        geographicFocus: true,
        website: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Fetch match reasoning if available
    const match = await prisma.match.findUnique({
      where: {
        organizationId_donorId: {
          organizationId: orgId,
          donorId: entry.donorId,
        },
      },
      select: { reasoning: true },
    });

    // Generate the outreach draft
    const { subject, body } = await generateOutreachEmail({
      orgName: org.name,
      orgMission: org.mission,
      orgCauses: org.causes,
      orgGeoFocus: org.geographicFocus,
      orgWebsite: org.website,
      donorName: entry.donor.name,
      donorType: entry.donor.type,
      donorDescription: entry.donor.description,
      donorCauses: entry.donor.causes,
      donorGeoFocus: entry.donor.geographicFocus,
      matchReasoning: match?.reasoning ?? null,
      topGrants: entry.donor.grants.map((g) => ({
        recipientName: g.recipientName,
        amount: g.amount,
        year: g.year,
      })),
      existingNotes: entry.notes.map((n) => n.content),
      templateType,
    });

    // Save as OutreachDraft
    const draft = await prisma.outreachDraft.create({
      data: {
        pipelineEntryId,
        templateType,
        subject,
        body,
      },
    });

    // Optionally save as note
    if (saveAsNote) {
      await prisma.note.create({
        data: {
          pipelineEntryId,
          userId: user.id,
          content: `[AI Draft — ${templateType}]\nSubject: ${subject}\n\n${body}`,
        },
      });
    }

    return NextResponse.json({
      draftId: draft.id,
      subject,
      body,
    });
  } catch (error) {
    console.error("Outreach generation error:", error);
    return NextResponse.json({ error: "Failed to generate outreach" }, { status: 500 });
  }
}
