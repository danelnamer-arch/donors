"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PipelineEntry {
  id: string;
  stage: string;
  updatedAt: string;
  donor: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    country: string | null;
    causes: string[];
  };
}

const STAGES = [
  { key: "DISCOVERED", label: "Discovered", color: "default" as const },
  { key: "RESEARCHING", label: "Researching", color: "info" as const },
  { key: "OUTREACH", label: "Outreach", color: "warning" as const },
  { key: "APPLIED", label: "Applied", color: "info" as const },
  { key: "IN_CONVERSATION", label: "In Conversation", color: "warning" as const },
  { key: "FUNDED", label: "Funded", color: "success" as const },
  { key: "REJECTED", label: "Rejected", color: "danger" as const },
];

export default function PipelinePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline");
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries);
      }
    } catch {
      // silently fail
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
      fetchPipeline();
    }
  }, [status, router, fetchPipeline]);

  async function moveStage(entryId: string, stage: string) {
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, stage }),
      });
      if (res.ok) {
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, stage } : e))
        );
      }
    } catch {
      // silently fail
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Nav />
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-black" />
        </div>
      </>
    );
  }

  // Group entries by stage
  const grouped: Record<string, PipelineEntry[]> = {};
  for (const stage of STAGES) {
    grouped[stage.key] = entries.filter((e) => e.stage === stage.key);
  }

  const activeStages = STAGES.filter(
    (s) => !["FUNDED", "REJECTED"].includes(s.key)
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Your Pipeline
          </h1>
          <div className="text-sm text-zinc-500">
            {entries.length} donor{entries.length === 1 ? "" : "s"} in pipeline
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="mt-16 text-center">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Your pipeline is empty
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Start by discovering donors — swipe right on ones you like, and
              they&apos;ll appear here.
            </p>
            <Button className="mt-4" onClick={() => router.push("/dashboard")}>
              Discover Donors
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeStages.map((stage) => (
              <div key={stage.key}>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant={stage.color}>{stage.label}</Badge>
                  <span className="text-xs text-zinc-400">
                    {grouped[stage.key]?.length || 0}
                  </span>
                </div>
                <div className="space-y-3">
                  {(grouped[stage.key] || []).map((entry) => (
                    <PipelineCard
                      key={entry.id}
                      entry={entry}
                      stages={STAGES}
                      onMoveStage={moveStage}
                    />
                  ))}
                  {(grouped[stage.key] || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
                      No donors here yet
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed section */}
        {(grouped["FUNDED"]?.length > 0 || grouped["REJECTED"]?.length > 0) && (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              Completed
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[...grouped["FUNDED"] || [], ...grouped["REJECTED"] || []].map(
                (entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.donor.name}
                      </p>
                      <p className="text-xs text-zinc-500">{entry.donor.type}</p>
                    </div>
                    <Badge
                      variant={entry.stage === "FUNDED" ? "success" : "danger"}
                    >
                      {entry.stage === "FUNDED" ? "Funded" : "Rejected"}
                    </Badge>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function PipelineCard({
  entry,
  stages,
  onMoveStage,
}: {
  entry: PipelineEntry;
  stages: typeof STAGES;
  onMoveStage: (entryId: string, stage: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const currentIdx = stages.findIndex((s) => s.key === entry.stage);
  const nextStage = stages[currentIdx + 1];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {entry.donor.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {entry.donor.type} {entry.donor.country ? `- ${entry.donor.country}` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="ml-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>
      </div>

      {entry.donor.causes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.donor.causes.slice(0, 3).map((cause) => (
            <span
              key={cause}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {cause}
            </span>
          ))}
        </div>
      )}

      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {nextStage && !["FUNDED", "REJECTED"].includes(nextStage.key) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onMoveStage(entry.id, nextStage.key)}
            >
              Move to {nextStage.label}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMoveStage(entry.id, "FUNDED")}
          >
            Mark Funded
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMoveStage(entry.id, "REJECTED")}
          >
            Rejected
          </Button>
          {entry.donor.website && (
            <a
              href={entry.donor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-md px-3 text-sm text-blue-600 hover:underline"
            >
              Website
            </a>
          )}
        </div>
      )}

      {!showActions && nextStage && !["FUNDED", "REJECTED"].includes(nextStage.key) && (
        <button
          onClick={() => onMoveStage(entry.id, nextStage.key)}
          className="mt-3 text-xs font-medium text-blue-600 hover:underline"
        >
          Move to {nextStage.label} &rarr;
        </button>
      )}
    </div>
  );
}
