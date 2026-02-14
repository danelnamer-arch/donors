"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SwipeCard } from "@/components/swipe-card";
import { Button } from "@/components/ui/button";
import { SwipeCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MatchData {
  id: string;
  reasoning: string;
  scoreBreakdown?: {
    causeAlignment: number;
    geographicOverlap: number;
    populationOverlap: number;
    semanticSimilarity: number;
    grantSizeAlignment: number;
    grantRecipientSimilarity: number;
    recencyBonus: number;
    feedbackBoost: number;
    dataQuality: number;
  } | null;
  donor: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    country: string | null;
    causes: string[];
    targetPopulations: string[];
    geographicFocus: string[];
    grants: {
      recipientName: string;
      amount: number | null;
      year: number | null;
      purpose: string | null;
    }[];
    publications: {
      title: string;
      url: string | null;
      publishedAt: Date | null;
    }[];
  };
}

interface UsageInfo {
  allowed: boolean;
  remaining?: number;
  message?: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();

      if (!res.ok) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        toast.error(data.error || "Failed to load matches");
        return;
      }

      setMatches(data.matches);
      setUsage(data.usage);
      setCurrentIndex(0);
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchMatches();
    }
  }, [status, router, fetchMatches]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (swiping || !usage?.allowed || loading) return;
      const currentMatch = matches[currentIndex];
      if (!currentMatch) return;

      if (e.key === "ArrowLeft" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleSwipe(currentMatch.id, "LEFT");
      } else if (e.key === "ArrowRight" || e.key === "y" || e.key === "Y") {
        e.preventDefault();
        handleSwipe(currentMatch.id, "RIGHT");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function handleSwipe(matchId: string, action: "RIGHT" | "LEFT") {
    setSwiping(true);
    try {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.upgrade) {
          setUsage({ allowed: false, message: data.error });
        } else {
          toast.error(data.error || "Swipe failed");
        }
        return;
      }

      if (action === "RIGHT") {
        toast.success("Added to pipeline!", { duration: 2000 });
      }

      setCurrentIndex((prev) => prev + 1);

      if (currentIndex >= matches.length - 3) {
        fetchMatches();
      }
    } catch {
      toast.error("Swipe failed. Please try again.");
    } finally {
      setSwiping(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center">
          <SwipeCardSkeleton />
        </div>
      </main>
    );
  }

  const currentMatch = matches[currentIndex];
  const noMoreMatches = !currentMatch || currentIndex >= matches.length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Usage bar */}
        {usage && !usage.allowed && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {usage.message}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push("/billing")}
                >
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>
        )}

        {usage?.remaining !== undefined && usage.remaining < Infinity && (
          <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {usage.remaining} match{usage.remaining === 1 ? "" : "es"} remaining today
          </div>
        )}

        {/* Swipe area */}
        <div className="flex flex-col items-center">
          {noMoreMatches ? (
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              }
              title="No more matches right now"
              description="We're looking for more donors that fit your organization. Check back soon!"
              action={
                <Button variant="outline" onClick={fetchMatches}>
                  Check for New Matches
                </Button>
              }
            />
          ) : (
            <>
              {/* Stacked cards behind */}
              <div className="relative w-full max-w-lg">
                {matches[currentIndex + 2] && (
                  <div className="absolute inset-x-0 top-4 mx-auto max-w-lg scale-[0.92] rounded-2xl border border-zinc-200 bg-zinc-50 opacity-40 dark:border-zinc-800 dark:bg-zinc-900" style={{ height: 80 }} />
                )}
                {matches[currentIndex + 1] && (
                  <div className="absolute inset-x-0 top-2 mx-auto max-w-lg scale-[0.96] rounded-2xl border border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900" style={{ height: 80 }} />
                )}
                <SwipeCard
                  match={currentMatch}
                  onSwipe={handleSwipe}
                  disabled={swiping || !usage?.allowed}
                />
              </div>
              <div className="mt-4 flex items-center gap-4">
                <p className="text-xs text-zinc-400">
                  {currentIndex + 1} of {matches.length} matches
                </p>
                <div className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 sm:flex dark:border-zinc-800">
                  <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                    Y
                  </kbd>
                  <span>interested</span>
                  <span className="mx-1 text-zinc-300">|</span>
                  <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                    N
                  </kbd>
                  <span>pass</span>
                </div>
              </div>
            </>
          )}
        </div>
    </main>
  );
}
