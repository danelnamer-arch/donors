import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";

/**
 * GET /api/organizations/[orgId]
 * Fetch organization profile for settings.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user belongs to this org
    if (user.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        mission: true,
        website: true,
        country: true,
        location: true,
        size: true,
        annualBudgetRange: true,
        politicalAffiliation: true,
        politicalStance: true,
        israeliRegistrationNumber: true,
        guidestarIsraelUrl: true,
        causes: true,
        targetAudience: true,
        geographicFocus: true,
        similarOrgs: true,
        existingDonors: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error("GET org error:", error);
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 });
  }
}

/**
 * PATCH /api/organizations/[orgId]
 * Update organization profile fields (partial updates).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user belongs to this org
    if (user.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Get existing org to detect changes
    const existingOrg = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        mission: true,
        politicalStance: true,
        israeliRegistrationNumber: true,
        causes: true,
        targetAudience: true,
        geographicFocus: true,
      },
    });

    if (!existingOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Build update data — only include provided fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.mission !== undefined) updateData.mission = body.mission || null;
    if (body.website !== undefined) updateData.website = body.website || null;
    if (body.country !== undefined) updateData.country = body.country || null;
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.size !== undefined) updateData.size = body.size || null;
    if (body.annualBudgetRange !== undefined) updateData.annualBudgetRange = body.annualBudgetRange || null;
    if (body.politicalAffiliation !== undefined) updateData.politicalAffiliation = body.politicalAffiliation;
    if (body.politicalStance !== undefined) updateData.politicalStance = body.politicalStance || null;
    if (body.causes !== undefined) updateData.causes = body.causes;
    if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience;
    if (body.geographicFocus !== undefined) updateData.geographicFocus = body.geographicFocus;
    if (body.similarOrgs !== undefined) updateData.similarOrgs = body.similarOrgs;
    if (body.existingDonors !== undefined) updateData.existingDonors = body.existingDonors;

    if (body.israeliRegistrationNumber !== undefined) {
      updateData.israeliRegistrationNumber = body.israeliRegistrationNumber || null;
      updateData.guidestarIsraelUrl = body.israeliRegistrationNumber
        ? `https://www.guidestar.org.il/organization/${body.israeliRegistrationNumber}`
        : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    // Regenerate mission embedding if mission changed
    const newMission = body.mission !== undefined ? body.mission : existingOrg.mission;
    const missionChanged = body.mission !== undefined && body.mission !== existingOrg.mission;
    const causesChanged = body.causes !== undefined;
    const geoChanged = body.geographicFocus !== undefined;

    if (missionChanged || causesChanged || geoChanged) {
      const embeddingText = [
        newMission,
        (body.causes || existingOrg.causes)?.length
          ? `Causes: ${(body.causes || existingOrg.causes).join(", ")}`
          : "",
        (body.targetAudience || existingOrg.targetAudience)
          ? `Populations: ${body.targetAudience || existingOrg.targetAudience}`
          : "",
        (body.geographicFocus || existingOrg.geographicFocus)?.length
          ? `Geographic focus: ${(body.geographicFocus || existingOrg.geographicFocus).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(". ");

      if (embeddingText) {
        generateEmbedding(embeddingText)
          .then(async (embedding) => {
            await prisma.$executeRawUnsafe(
              `UPDATE "Organization" SET "missionEmbedding" = $1::vector WHERE id = $2`,
              JSON.stringify(embedding),
              orgId
            );
          })
          .catch((err) => {
            console.error("[settings] Failed to regenerate mission embedding:", err);
          });
      }
    }

    // Regenerate political embedding if political stance changed
    if (body.politicalStance !== undefined && body.politicalStance !== existingOrg.politicalStance) {
      if (body.politicalStance) {
        generateEmbedding(body.politicalStance)
          .then(async (embedding) => {
            await prisma.$executeRawUnsafe(
              `UPDATE "Organization" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
              JSON.stringify(embedding),
              orgId
            );
          })
          .catch((err) => {
            console.error("[settings] Failed to regenerate political embedding:", err);
          });
      }
    }

    // Trigger GuideStar enrichment if Israeli registration number newly set
    if (
      body.israeliRegistrationNumber &&
      body.israeliRegistrationNumber !== existingOrg.israeliRegistrationNumber
    ) {
      import("@/lib/guidestar-israel/scraper")
        .then(({ scrapeGuidestarOrg }) =>
          scrapeGuidestarOrg(body.israeliRegistrationNumber)
        )
        .then(async (profile) => {
          const enrichData: Record<string, unknown> = {};

          if (profile.missionEnglish && !newMission) {
            enrichData.mission = profile.missionEnglish;
          }
          if (profile.normalizedCauses?.length > 0 && (!updated.causes || updated.causes.length === 0)) {
            enrichData.causes = profile.normalizedCauses;
          }
          if (profile.annualBudgetILS) {
            enrichData.annualBudgetRange = `₪${(profile.annualBudgetILS / 1_000_000).toFixed(1)}M`;
          }

          if (Object.keys(enrichData).length > 0) {
            await prisma.organization.update({
              where: { id: orgId },
              data: enrichData,
            });
            console.log(`[settings] GuideStar enriched org with:`, Object.keys(enrichData));
          }

          // Auto-discover similar orgs
          import("@/lib/guidestar-israel/similar-org-finder")
            .then(({ discoverAndStoreSimilarOrgs }) =>
              discoverAndStoreSimilarOrgs(orgId, {
                usePerplexity: true,
                useGuidestarCategories: true,
                useBoardOverlap: false,
                maxResults: 20,
              })
            )
            .then((result) => {
              console.log(`[settings] Auto-discovered ${result.newNames.length} similar orgs`);
            })
            .catch((err) => {
              console.error("[settings] Similar org discovery failed:", err);
            });
        })
        .catch((err) => {
          console.error("[settings] GuideStar enrichment failed:", err);
        });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH org error:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}
