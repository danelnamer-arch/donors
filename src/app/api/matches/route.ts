import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { generateMatches, storeMatches, getNextMatches } from "@/lib/matching";
import { canUseMatch } from "@/lib/paddle";

/**
 * GET /api/matches
 * Get pending matches for the user's organization.
 * If no pending matches exist, generates new ones.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Complete onboarding first", redirect: "/onboarding" },
        { status: 400 }
      );
    }

    // Check usage limits
    const usage = await canUseMatch(orgId);

    // Get existing pending matches
    let matches = await getNextMatches(orgId, 10);

    // If no pending matches, generate new ones
    if (matches.length === 0) {
      const scored = await generateMatches(orgId, { limit: 20 });
      if (scored.length > 0) {
        await storeMatches(orgId, scored);
        matches = await getNextMatches(orgId, 10);
      }
    }

    return NextResponse.json({
      matches: matches.map((m) => ({
        id: m.id,
        reasoning: m.reasoning,
        scoreBreakdown: m.scoreBreakdown as Record<string, number> | null,
        donor: {
          id: m.donor.id,
          name: m.donor.name,
          type: m.donor.type,
          description: m.donor.description,
          website: m.donor.website,
          country: m.donor.country,
          causes: m.donor.causes,
          targetPopulations: m.donor.targetPopulations,
          geographicFocus: m.donor.geographicFocus,
          grants: m.donor.grants.map((g) => ({
            recipientName: g.recipientName,
            amount: g.amount,
            year: g.year,
            purpose: g.purpose,
          })),
          publications: m.donor.publications.map((p) => ({
            title: p.title,
            url: p.url,
            publishedAt: p.publishedAt,
          })),
        },
      })),
      usage: {
        allowed: usage.allowed,
        remaining: usage.remaining,
        message: usage.reason,
      },
    });
  } catch (error) {
    console.error("Matches error:", error);
    return NextResponse.json(
      { error: "Failed to get matches" },
      { status: 500 }
    );
  }
}
