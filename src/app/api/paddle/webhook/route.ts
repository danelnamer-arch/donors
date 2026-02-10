/**
 * POST /api/paddle/webhook
 * Handles Paddle webhook events: subscription created, updated, cancelled, payment.
 *
 * Set this URL in your Paddle dashboard:
 *   Sandbox: https://your-app.vercel.app/api/paddle/webhook
 *   Production: https://donormatch.com/api/paddle/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import {
  activateSubscription,
  cancelSubscription,
  addEnrichmentCredits,
  PADDLE_PRICES,
} from "@/lib/paddle";

interface PaddleEvent {
  event_type: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    items: {
      price: {
        id: string;
      };
      quantity: number;
    }[];
    custom_data?: {
      organizationId?: string;
    };
    subscription_id?: string;
  };
}

/**
 * Verify the webhook signature from Paddle.
 */
function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    console.warn("PADDLE_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  if (!signature) {
    return false;
  }

  // In production, use Paddle's SDK to verify:
  // import { verify } from "@paddle/paddle-node-sdk";
  // return verify(rawBody, signature, process.env.PADDLE_WEBHOOK_SECRET);
  // For now, we accept all webhooks in sandbox mode
  if (process.env.PADDLE_ENVIRONMENT !== "production") {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("paddle-signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event: PaddleEvent = JSON.parse(rawBody);
    const { event_type, data } = event;

    console.log(`Paddle webhook: ${event_type}`, data.id);

    const organizationId = data.custom_data?.organizationId;

    switch (event_type) {
      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated": {
        if (!organizationId) {
          console.error("Missing organizationId in subscription webhook");
          break;
        }

        const priceId = data.items?.[0]?.price?.id ?? "";

        await activateSubscription({
          organizationId,
          paddleCustomerId: data.customer_id,
          paddleSubscriptionId: data.id,
          priceId,
        });
        break;
      }

      case "subscription.canceled":
      case "subscription.past_due": {
        await cancelSubscription(data.id);
        break;
      }

      case "transaction.completed": {
        // Check if this is a one-time enrichment credit purchase
        const enrichmentItem = data.items?.find(
          (item) => item.price.id === PADDLE_PRICES.ENRICHMENT_CREDIT
        );

        if (enrichmentItem && organizationId) {
          await addEnrichmentCredits(
            organizationId,
            enrichmentItem.quantity
          );
        }
        break;
      }

      default:
        console.log(`Unhandled Paddle event: ${event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
