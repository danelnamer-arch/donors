"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { SwipeCard } from "@/components/swipe-card";
import { Button } from "@/components/ui/button";

interface MatchData {
  id: string;
  reasoning: string;
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
  const [error, setError] = useState("");
  const [swiping, setSwiping] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();

      if (!res.ok) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || "Failed to load matches");
        return;
      }

      setMatches(data.matches);
      setUsage(data.usage);
      setCurrentIndex(0);
    } catch {
      setError("Failed to connect to server");
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
        }
        return;
      }

      // Move to next card
      setCurrentIndex((prev) => prev + 1);

      // Fetch more if running low
      if (currentIndex >= matches.length - 3) {
        fetchMatches();
      }
    } catch {
      setError("Swipe failed");
    } finally {
      setSwiping(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Nav />
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-black" />
            <p className="text-sm text-zinc-500">Finding donor matches for you...</p>
          </div>
        </div>
      </>
    );
  }

  const currentMatch = matches[currentIndex];
  const noMoreMatches = !currentMatch || currentIndex >= matches.length;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Usage bar */}
        {usage && !usage.allowed && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {usage.message}
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-2"
              onClick={() => router.push("/billing")}
            >
              Upgrade Plan
            </Button>
          </div>
        )}

        {usage?.remaining !== undefined && usage.remaining < Infinity && (
          <div className="mb-4 text-sm text-zinc-500">
            {usage.remaining} match{usage.remaining === 1 ? "" : "es"} remaining today
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={fetchMatches}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Swipe area */}
        <div className="flex flex-col items-center">
          {noMoreMatches ? (
            <div className="mt-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                No more matches right now
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                We&apos;re looking for more donors that fit your organization.
                Check back soon!
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={fetchMatches}
              >
                Check for New Matches
              </Button>
            </div>
          ) : (
            <>
              <SwipeCard
                match={currentMatch}
                onSwipe={handleSwipe}
                disabled={swiping || !usage?.allowed}
              />
              <p className="mt-4 text-xs text-zinc-400">
                {currentIndex + 1} of {matches.length} matches
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
