import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { discoverAndStoreSimilarOrgs } from "@/lib/guidestar-israel/similar-org-finder";
import {
  reverseDonorDiscovery,
  storeDiscoveredDonors,
} from "@/lib/guidestar-israel/reverse-donor-discovery";
import { getSimilarOrgNames } from "@/lib/utils/org-helpers";

/**
 * POST /api/organizations/[orgId]/discover-peer-donors
 *
 * User-triggered "Find donors of similar organizations" feature.
 * This is a premium action that:
 * 1. Discovers/refreshes peer organizations (via Similar Org Finder)
 * 2. For each peer org, finds their donors (GuideStar + media + ProPublica + Perplexity)
 * 3. Stores discovered donors and enriches the org's data
 * 4. Returns discovered donors to the user
 *
 * This also enriches our DB — every time a user triggers this,
 * we discover new donors AND new organizations that benefit all future users.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify the user belongs to this org
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        mission: true,
        causes: true,
        geographicFocus: true,
        similarOrgs: true,
        israeliRegistrationNumber: true,
        users: { where: { id: user.id }, select: { id: true } },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (org.users.length === 0) {
      return NextResponse.json(
        { error: "You don't belong to this organization" },
        { status: 403 }
      );
    }

    // Parse request body for options
    let body: {
      refreshSimilarOrgs?: boolean;
      maxPeers?: number;
      useGuidestar?: boolean;
      useMedia?: boolean;
      useProPublica?: boolean;
      usePerplexity?: boolean;
    } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — use defaults
    }

    const refreshSimilarOrgs = body.refreshSimilarOrgs ?? true;
    const maxPeers = Math.min(body.maxPeers ?? 5, 15); // Cap at 15 to control costs

    // Step 1: Discover/refresh similar organizations if needed
    let similarOrgNames = getSimilarOrgNames(org.similarOrgs);

    if (refreshSimilarOrgs || similarOrgNames.length < 5) {
      console.log(
        `[discover-peer-donors] Refreshing similar orgs for "${org.name}"...`
      );

      const discoverySummary = await discoverAndStoreSimilarOrgs(orgId, {
        usePerplexity: true,
        useGuidestarCategories: !!org.israeliRegistrationNumber,
        useBoardOverlap: false, // Slow — skip for user-triggered action
      });

      // Reload org to get updated similarOrgs
      const updatedOrg = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { similarOrgs: true },
      });

      similarOrgNames = updatedOrg ? getSimilarOrgNames(updatedOrg.similarOrgs) : similarOrgNames;

      console.log(
        `[discover-peer-donors] Similar org discovery: ${discoverySummary.totalFound} found, ${discoverySummary.newNames.length} new`
      );
    }

    if (similarOrgNames.length === 0) {
      return NextResponse.json({
        message: "No similar organizations found to investigate",
        donors: [],
        similarOrgs: [],
        stats: { peersProcessed: 0, donorsFound: 0, donorsStored: 0 },
      });
    }

    // Step 2: Run reverse donor discovery on peer orgs
    console.log(
      `[discover-peer-donors] Running reverse discovery on ${Math.min(maxPeers, similarOrgNames.length)} peers...`
    );

    const result = await reverseDonorDiscovery(similarOrgNames, {
      maxPeers,
      useGuidestar: body.useGuidestar ?? true,
      useMedia: body.useMedia ?? true,
      useProPublica: body.useProPublica ?? true,
      usePerplexity: body.usePerplexity ?? true,
      delayBetweenPeersMs: 8000,
    });

    // Step 3: Store discovered donors in DB
    const storeResult = await storeDiscoveredDonors(result.donors, orgId);

    console.log(
      `[discover-peer-donors] Complete for "${org.name}": ` +
        `${result.totalDonorsFound} donors found, ${storeResult.donorsStored} stored, ` +
        `${storeResult.grantsStored} grants created, ${storeResult.orgsStored} peer orgs stored`
    );

    return NextResponse.json({
      message: `Discovered ${result.totalDonorsFound} donors from ${result.peersProcessed} peer organizations`,
      donors: result.donors.map((d) => ({
        name: d.name,
        source: d.source,
        amountUSD: d.amountUSD,
        amountILS: d.amountILS,
        year: d.year,
        recipientOrg: d.recipientOrgName,
        confidence: d.confidence,
      })),
      similarOrgs: similarOrgNames,
      stats: {
        peersProcessed: result.peersProcessed,
        donorsFound: result.totalDonorsFound,
        donorsStored: storeResult.donorsStored,
        grantsStored: storeResult.grantsStored,
        orgsStored: storeResult.orgsStored,
        bySource: result.bySource,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[discover-peer-donors] Error:", error);
    return NextResponse.json(
      {
        error: "Discovery failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
