import { NextRequest, NextResponse } from "next/server";
import { createCheckoutUrl, PADDLE_PRICES } from "@/lib/paddle";

/**
 * POST /api/billing/credits
 * Purchase additional enrichment credits ($3 each).
 *
 * Body: { organizationId, quantity, email }
 * Returns: { checkoutUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, quantity, email } = body;

    if (!organizationId || !quantity || !email) {
      return NextResponse.json(
        { error: "organizationId, quantity, and email are required" },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 100) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 100" },
        { status: 400 }
      );
    }

    const checkoutUrl = await createCheckoutUrl({
      organizationId,
      priceId: PADDLE_PRICES.ENRICHMENT_CREDIT,
      userEmail: email,
      successUrl: `${process.env.NEXTAUTH_URL}/dashboard?credits=purchased`,
    });

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Credits purchase error:", error);
    return NextResponse.json(
      { error: "Credits purchase failed" },
      { status: 500 }
    );
  }
}
