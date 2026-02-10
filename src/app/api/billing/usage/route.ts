import { NextRequest, NextResponse } from "next/server";
import { canUseMatch, canUseEnrichment, getOrCreateSubscription } from "@/lib/paddle";

/**
 * GET /api/billing/usage?organizationId=xxx
 * Get current usage and limits for an organization.
 */
export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const [subscription, matchStatus, enrichmentStatus] = await Promise.all([
      getOrCreateSubscription(organizationId),
      canUseMatch(organizationId),
      canUseEnrichment(organizationId),
    ]);

    return NextResponse.json({
      tier: subscription.tier,
      status: subscription.status,
      matches: {
        totalUsed: subscription.totalMatchesUsed,
        dailyUsed: subscription.dailyMatchesUsed,
        canUseMore: matchStatus.allowed,
        remaining: matchStatus.remaining,
        message: matchStatus.reason,
      },
      enrichments: {
        used: subscription.enrichmentsUsed,
        limit: subscription.enrichmentsLimit,
        canUseMore: enrichmentStatus.allowed,
        remaining: enrichmentStatus.remaining,
        message: enrichmentStatus.reason,
      },
    });
  } catch (error) {
    console.error("Usage check error:", error);
    return NextResponse.json(
      { error: "Failed to check usage" },
      { status: 500 }
    );
  }
}
