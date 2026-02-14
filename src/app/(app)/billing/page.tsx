"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsGridSkeleton } from "@/components/ui/skeleton";

interface SubscriptionInfo {
  tier: string;
  status: string;
  totalMatchesUsed: number;
  dailyMatchesUsed: number;
  enrichmentsUsed: number;
  enrichmentsLimit: number;
}

const PLANS = [
  {
    tier: "FREE",
    name: "Free",
    price: "$0",
    period: "",
    features: [
      "5 donor matches total",
      "3 matches per day",
      "Basic donor info",
      "Pipeline board",
    ],
    limitations: ["No enrichment", "Limited matches"],
  },
  {
    tier: "STARTER",
    name: "Starter",
    price: "$29",
    period: "/mo",
    features: [
      "Unlimited donor matches",
      "5 enrichments/month",
      "Deep donor research",
      "Pipeline board",
      "Priority support",
    ],
    limitations: [],
  },
  {
    tier: "PRO",
    name: "Pro",
    price: "$79",
    period: "/mo",
    features: [
      "Unlimited donor matches",
      "20 enrichments/month",
      "Deep donor research",
      "Pipeline board",
      "Priority support",
      "Export data",
    ],
    limitations: [],
    popular: true,
  },
];

export default function BillingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/usage", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data);
      } else {
        toast.error("Failed to load billing info");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchBilling();
    }
  }, [status, router, fetchBilling]);

  async function handleUpgrade(tier: string) {
    setUpgrading(tier);
    try {
      const priceType = tier === "STARTER" ? "starter" : "pro";
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: priceType }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setUpgrading(null);
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="mb-2 h-8 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <StatsGridSkeleton />
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
          ))}
        </div>
      </main>
    );
  }

  const currentTier = subscription?.tier ?? "FREE";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Billing & Plans
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          Manage your subscription and enrichment credits.
        </p>

        {/* Current usage */}
        {subscription && (
          <Card className="mb-8">
            <CardContent className="py-6">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Current Usage</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-zinc-500">Plan</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {PLANS.find((p) => p.tier === currentTier)?.name ?? "Free"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Matches</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {subscription.totalMatchesUsed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Today&apos;s Matches</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {subscription.dailyMatchesUsed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Enrichments</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {subscription.enrichmentsUsed}/{subscription.enrichmentsLimit}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const isDowngrade =
              (currentTier === "PRO" && plan.tier !== "PRO") ||
              (currentTier === "STARTER" && plan.tier === "FREE");

            return (
              <Card
                key={plan.tier}
                className={`relative ${
                  plan.popular
                    ? "border-2 border-brand shadow-lg shadow-brand/10 dark:shadow-brand/5"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="info">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="py-6">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                  <p className="mt-1">
                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{plan.price}</span>
                    {plan.period && <span className="text-sm text-zinc-500">{plan.period}</span>}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                    {plan.limitations.map((limitation) => (
                      <li
                        key={limitation}
                        className="flex items-start gap-2 text-sm text-zinc-400"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        {limitation}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button variant="outline" disabled className="w-full">
                        Current Plan
                      </Button>
                    ) : isDowngrade ? (
                      <Button variant="ghost" disabled className="w-full">
                        Downgrade
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        loading={upgrading === plan.tier}
                        onClick={() => handleUpgrade(plan.tier)}
                      >
                        Upgrade to {plan.name}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enrichment credits */}
        <Card className="mt-8">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Need more enrichments?</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Purchase additional deep research credits at $3 each.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleUpgrade("ENRICHMENT")}
                disabled={currentTier === "FREE"}
              >
                Buy Credits
              </Button>
            </div>
            {currentTier === "FREE" && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Upgrade to a paid plan first to use enrichments.
              </p>
            )}
          </CardContent>
        </Card>
    </main>
  );
}
