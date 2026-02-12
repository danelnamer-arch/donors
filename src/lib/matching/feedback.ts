/**
 * Swipe Feedback Loop
 * Extracts preference signals from past swipe actions to improve future matches.
 *
 * RIGHT swipes indicate interest (+1.0 weight).
 * LEFT swipes indicate disinterest (-0.5 weight, asymmetric because
 * a single right-swipe is a stronger signal than a single left-swipe).
 */

import { prisma } from "@/lib/prisma";

export interface SwipeFeedbackSignals {
  preferredCauses: Map<string, number>;
  preferredRegions: Map<string, number>;
  preferredDonorTypes: Map<string, number>;
  rejectedDonorIds: string[];
  hasEnoughData: boolean;
}

/**
 * Extract preference signals from an org's swipe history.
 * Returns cause/region/type preference maps and rejected donor IDs.
 */
export async function getSwipeFeedbackSignals(
  organizationId: string
): Promise<SwipeFeedbackSignals> {
  const feedback = await prisma.swipeFeedback.findMany({
    where: { organizationId },
    include: {
      donor: {
        select: {
          id: true,
          causes: true,
          geographicFocus: true,
          activeRegions: true,
          type: true,
          avgGrantSizeUsd: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (feedback.length < 5) {
    // Not enough data to form meaningful preferences
    return {
      preferredCauses: new Map(),
      preferredRegions: new Map(),
      preferredDonorTypes: new Map(),
      rejectedDonorIds: [],
      hasEnoughData: false,
    };
  }

  const causeScores = new Map<string, number>();
  const regionScores = new Map<string, number>();
  const typeScores = new Map<string, number>();
  const rejectedIds: string[] = [];

  for (const fb of feedback) {
    const weight = fb.action === "RIGHT" ? 1.0 : -0.5;

    // Cause preferences
    for (const cause of fb.donor.causes) {
      causeScores.set(cause, (causeScores.get(cause) ?? 0) + weight);
    }

    // Region preferences (combine geographicFocus + activeRegions)
    const regions = [...fb.donor.geographicFocus, ...fb.donor.activeRegions];
    for (const region of regions) {
      regionScores.set(region, (regionScores.get(region) ?? 0) + weight);
    }

    // Donor type preferences
    typeScores.set(fb.donor.type, (typeScores.get(fb.donor.type) ?? 0) + weight);

    // Track rejected donors
    if (fb.action === "LEFT") {
      rejectedIds.push(fb.donor.id);
    }
  }

  return {
    preferredCauses: causeScores,
    preferredRegions: regionScores,
    preferredDonorTypes: typeScores,
    rejectedDonorIds: rejectedIds,
    hasEnoughData: true,
  };
}

/**
 * Calculate a feedback boost score for a candidate based on learned preferences.
 * Returns 0-1 where 0.5 is neutral, >0.5 means the org has shown interest
 * in similar donors, <0.5 means the org has tended to pass on similar donors.
 */
export function calculateFeedbackBoost(
  candidate: {
    donorCauses: string[];
    donorGeoFocus: string[];
    donorActiveRegions: string[];
    donorType: string;
  },
  signals: SwipeFeedbackSignals
): number {
  if (!signals.hasEnoughData) return 0.5; // Neutral when no data

  let boost = 0;
  let factors = 0;

  // Cause preference signal
  for (const cause of candidate.donorCauses) {
    const score = signals.preferredCauses.get(cause);
    if (score !== undefined) {
      boost += Math.tanh(score / 3); // Normalize to [-1, 1] range
      factors++;
    }
  }

  // Region preference signal
  const regions = [...candidate.donorGeoFocus, ...candidate.donorActiveRegions];
  for (const region of regions) {
    const score = signals.preferredRegions.get(region);
    if (score !== undefined) {
      boost += Math.tanh(score / 3);
      factors++;
    }
  }

  // Type preference signal
  const typeScore = signals.preferredDonorTypes.get(candidate.donorType);
  if (typeScore !== undefined) {
    boost += Math.tanh(typeScore / 3);
    factors++;
  }

  if (factors === 0) return 0.5; // Neutral

  // Map average boost from [-1, 1] to [0, 1]
  return Math.max(0, Math.min(1, 0.5 + (boost / factors) * 0.5));
}
