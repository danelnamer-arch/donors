/**
 * Paddle billing client and helpers.
 * Handles subscriptions, checkout sessions, and usage tracking.
 *
 * Paddle products/prices to create in Paddle dashboard:
 *   - Product: "DonorMatch Starter" → Price: $29/mo
 *   - Product: "DonorMatch Pro"     → Price: $79/mo
 *   - Product: "Enrichment Credit"  → Price: $3 one-time
 */

import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { prisma } from "@/lib/prisma";

const globalForPaddle = globalThis as unknown as {
  paddle: Paddle | undefined;
};

function createPaddleClient(): Paddle {
  if (!process.env.PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY is not set");
  }
  const environment =
    process.env.PADDLE_ENVIRONMENT === "production"
      ? Environment.production
      : Environment.sandbox;

  return new Paddle(process.env.PADDLE_API_KEY, { environment });
}

export const paddle =
  globalForPaddle.paddle ?? createPaddleClient();

if (process.env.NODE_ENV !== "production") {
  globalForPaddle.paddle = paddle;
}

// ============================================================
// TIER CONFIGURATION
// ============================================================

// Set these to your actual Paddle price IDs after creating them in the dashboard
export const PADDLE_PRICES = {
  STARTER_MONTHLY: process.env.PADDLE_STARTER_PRICE_ID ?? "",
  PRO_MONTHLY: process.env.PADDLE_PRO_PRICE_ID ?? "",
  ENRICHMENT_CREDIT: process.env.PADDLE_ENRICHMENT_PRICE_ID ?? "",
};

export const TIER_LIMITS = {
  FREE: {
    totalMatchesLimit: 5,
    dailyMatchesLimit: 3,
    enrichmentsLimit: 0,
  },
  STARTER: {
    totalMatchesLimit: Infinity,
    dailyMatchesLimit: Infinity,
    enrichmentsLimit: 5,
  },
  PRO: {
    totalMatchesLimit: Infinity,
    dailyMatchesLimit: Infinity,
    enrichmentsLimit: 20,
  },
} as const;

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * Get or create a subscription record for an organization.
 */
export async function getOrCreateSubscription(organizationId: string) {
  let subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        organizationId,
        tier: "FREE",
        status: "ACTIVE",
        enrichmentsLimit: TIER_LIMITS.FREE.enrichmentsLimit,
      },
    });
  }

  return subscription;
}

/**
 * Check if an organization can use more matches today.
 */
export async function canUseMatch(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  const sub = await getOrCreateSubscription(organizationId);
  const limits = TIER_LIMITS[sub.tier];

  // Reset daily counter if needed
  const now = new Date();
  const resetAt = new Date(sub.dailyMatchesResetAt);
  if (now.toDateString() !== resetAt.toDateString()) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { dailyMatchesUsed: 0, dailyMatchesResetAt: now },
    });
    sub.dailyMatchesUsed = 0;
  }

  // Check total limit (free tier only)
  if (sub.tier === "FREE" && sub.totalMatchesUsed >= limits.totalMatchesLimit) {
    return {
      allowed: false,
      reason: "You've used all 5 free donor matches. Upgrade to unlock unlimited matches.",
    };
  }

  // Check daily limit (free tier only)
  if (sub.tier === "FREE" && sub.dailyMatchesUsed >= limits.dailyMatchesLimit) {
    return {
      allowed: false,
      reason: "You've used your 3 daily matches. Come back tomorrow or upgrade for unlimited.",
    };
  }

  const dailyRemaining =
    sub.tier === "FREE"
      ? limits.dailyMatchesLimit - sub.dailyMatchesUsed
      : Infinity;
  const totalRemaining =
    sub.tier === "FREE"
      ? limits.totalMatchesLimit - sub.totalMatchesUsed
      : Infinity;

  return {
    allowed: true,
    remaining: Math.min(dailyRemaining, totalRemaining),
  };
}

/**
 * Record that a match was used.
 */
export async function recordMatchUsage(organizationId: string) {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      totalMatchesUsed: { increment: 1 },
      dailyMatchesUsed: { increment: 1 },
    },
  });
}

/**
 * Check if an organization can use an enrichment.
 */
export async function canUseEnrichment(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  remaining?: number;
}> {
  const sub = await getOrCreateSubscription(organizationId);

  if (sub.tier === "FREE") {
    return {
      allowed: false,
      reason: "Enrichment is available on paid plans. Upgrade to Starter or Pro.",
    };
  }

  if (sub.enrichmentsUsed >= sub.enrichmentsLimit) {
    return {
      allowed: false,
      reason: `You've used all ${sub.enrichmentsLimit} enrichments this month. Purchase additional credits ($3 each).`,
    };
  }

  return {
    allowed: true,
    remaining: sub.enrichmentsLimit - sub.enrichmentsUsed,
  };
}

/**
 * Record that an enrichment was used.
 */
export async function recordEnrichmentUsage(organizationId: string) {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      enrichmentsUsed: { increment: 1 },
    },
  });
}

// ============================================================
// PADDLE OPERATIONS
// ============================================================

/**
 * Create a Paddle checkout URL for upgrading to a paid plan.
 */
export async function createCheckoutUrl(params: {
  organizationId: string;
  priceId: string;
  userEmail: string;
  successUrl: string;
}): Promise<string | null> {
  try {
    const sub = await getOrCreateSubscription(params.organizationId);

    const transaction = await paddle.transactions.create({
      items: [{ priceId: params.priceId, quantity: 1 }],
      ...(sub.paddleCustomerId
        ? { customerId: sub.paddleCustomerId }
        : {}),
      customData: {
        organizationId: params.organizationId,
      },
    });

    // Paddle returns a checkout URL on the transaction
    const env = process.env.PADDLE_ENVIRONMENT === "production" ? "checkout" : "sandbox-checkout";
    return `https://${env}.paddle.com/transactions/${transaction.id}`;
  } catch (error) {
    console.error("Paddle checkout error:", error);
    return null;
  }
}

/**
 * Handle subscription activation — called when Paddle confirms payment.
 */
export async function activateSubscription(params: {
  organizationId: string;
  paddleCustomerId: string;
  paddleSubscriptionId: string;
  priceId: string;
}) {
  // Determine tier from price ID
  let tier: "FREE" | "STARTER" | "PRO" = "FREE";
  let enrichmentsLimit = 0;

  if (params.priceId === PADDLE_PRICES.STARTER_MONTHLY) {
    tier = "STARTER";
    enrichmentsLimit = TIER_LIMITS.STARTER.enrichmentsLimit;
  } else if (params.priceId === PADDLE_PRICES.PRO_MONTHLY) {
    tier = "PRO";
    enrichmentsLimit = TIER_LIMITS.PRO.enrichmentsLimit;
  }

  await prisma.subscription.upsert({
    where: { organizationId: params.organizationId },
    create: {
      organizationId: params.organizationId,
      paddleCustomerId: params.paddleCustomerId,
      paddleSubscriptionId: params.paddleSubscriptionId,
      tier,
      status: "ACTIVE",
      enrichmentsLimit,
    },
    update: {
      paddleCustomerId: params.paddleCustomerId,
      paddleSubscriptionId: params.paddleSubscriptionId,
      tier,
      status: "ACTIVE",
      enrichmentsLimit,
      enrichmentsUsed: 0, // Reset on new billing cycle
    },
  });
}

/**
 * Handle subscription cancellation.
 */
export async function cancelSubscription(paddleSubscriptionId: string) {
  await prisma.subscription.updateMany({
    where: { paddleSubscriptionId },
    data: {
      status: "CANCELLED",
      tier: "FREE",
      enrichmentsLimit: 0,
    },
  });
}

/**
 * Add enrichment credits after one-time purchase.
 */
export async function addEnrichmentCredits(
  organizationId: string,
  credits: number
) {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      enrichmentsLimit: { increment: credits },
    },
  });
}
