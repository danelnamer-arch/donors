import { NextRequest, NextResponse } from "next/server";
import { createCheckoutUrl, PADDLE_PRICES } from "@/lib/paddle";

/**
 * POST /api/billing/checkout
 * Create a Paddle checkout session for upgrading.
 *
 * Body: { organizationId, plan: "STARTER" | "PRO", email }
 * Returns: { checkoutUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, plan, email } = body;

    if (!organizationId || !plan || !email) {
      return NextResponse.json(
        { error: "organizationId, plan, and email are required" },
        { status: 400 }
      );
    }

    const priceId =
      plan === "STARTER"
        ? PADDLE_PRICES.STARTER_MONTHLY
        : plan === "PRO"
          ? PADDLE_PRICES.PRO_MONTHLY
          : null;

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan. Use STARTER or PRO" },
        { status: 400 }
      );
    }

    const checkoutUrl = await createCheckoutUrl({
      organizationId,
      priceId,
      userEmail: email,
      successUrl: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    });

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}
