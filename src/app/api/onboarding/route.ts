import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";

// ─── Vercel route config ────────────────────────────────────────
export const maxDuration = 30;

/**
 * POST /api/onboarding
 * Create an organization and link the current user to it.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      orgName,
      mission,
      website,
      country,
      size,
      annualBudgetRange,
      causes,
      targetAudience,
      geographicFocus,
      similarOrgs,
      existingDonors,
      rawProfileText,
      politicalStance,
      israeliRegistrationNumber,
    } = body;

    if (!orgName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Create the organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        mission: mission || null,
        website: website || null,
        country: country || null,
        size: size || null,
        annualBudgetRange: annualBudgetRange || null,
        causes: causes || [],
        targetAudience: targetAudience || null,
        geographicFocus: geographicFocus || [],
        similarOrgs: similarOrgs || [],
        existingDonors: existingDonors || [],
        rawProfileText: rawProfileText || null,
        politicalStance: politicalStance || null,
        israeliRegistrationNumber: israeliRegistrationNumber || null,
        guidestarIsraelUrl: israeliRegistrationNumber
          ? `https://www.guidestar.org.il/organization/${israeliRegistrationNumber}`
          : null,
      },
    });

    // Link user to organization
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    });

    // Generate mission embedding in background (don't block the response)
    // When rawProfileText is available, use it for richer embeddings
    if (mission || rawProfileText) {
      const embeddingText = rawProfileText
        ? rawProfileText.slice(0, 8000)
        : [
            mission,
            causes?.length ? `Causes: ${causes.join(", ")}` : "",
            targetAudience ? `Target audience: ${targetAudience}` : "",
            geographicFocus?.length
              ? `Geographic focus: ${geographicFocus.join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(". ");
      generateEmbedding(embeddingText)
        .then(async (embedding) => {
          await prisma.$executeRawUnsafe(
            `UPDATE "Organization" SET "missionEmbedding" = $1::vector WHERE id = $2`,
            JSON.stringify(embedding),
            org.id
          );
        })
        .catch((err) => {
          console.error("Failed to generate org embedding:", err);
        });
    }

    // Generate political embedding if political stance is available
    if (politicalStance) {
      generateEmbedding(politicalStance)
        .then(async (embedding) => {
          await prisma.$executeRawUnsafe(
            `UPDATE "Organization" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
            JSON.stringify(embedding),
            org.id
          );
        })
        .catch((err) => {
          console.error("Failed to generate org political embedding:", err);
        });
    }

    // Auto-enrich from GuideStar Israel if registration number is provided
    // This is fire-and-forget — don't block the response
    if (israeliRegistrationNumber) {
      import("@/lib/guidestar-israel/scraper")
        .then(({ scrapeGuidestarOrg }) =>
          scrapeGuidestarOrg(israeliRegistrationNumber)
        )
        .then(async (profile) => {
          // Update org with GuideStar data (mission, causes, board members, budget)
          const updateData: Record<string, unknown> = {};

          if (profile.missionEnglish && !mission) {
            updateData.mission = profile.missionEnglish;
          }
          if (profile.normalizedCauses.length > 0 && (!causes || causes.length === 0)) {
            updateData.causes = profile.normalizedCauses;
          }
          if (profile.annualBudgetILS) {
            updateData.annualBudgetRange = `₪${(profile.annualBudgetILS / 1_000_000).toFixed(1)}M`;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.organization.update({
              where: { id: org.id },
              data: updateData,
            });
            console.log(`[onboarding] GuideStar enriched org "${orgName}" with:`, Object.keys(updateData));
          }

          // Auto-discover similar orgs from GuideStar categories + mission
          import("@/lib/guidestar-israel/similar-org-finder")
            .then(({ discoverAndStoreSimilarOrgs }) =>
              discoverAndStoreSimilarOrgs(org.id, {
                usePerplexity: true,
                useGuidestarCategories: true,
                useBoardOverlap: false, // Too slow for onboarding
                maxResults: 20,
              })
            )
            .then((result) => {
              console.log(
                `[onboarding] Auto-discovered ${result.newNames.length} similar orgs for "${orgName}"`
              );
            })
            .catch((err) => {
              console.error("[onboarding] Similar org discovery failed:", err);
            });
        })
        .catch((err) => {
          console.error("[onboarding] GuideStar enrichment failed:", err);
        });
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Onboarding failed" },
      { status: 500 }
    );
  }
}
