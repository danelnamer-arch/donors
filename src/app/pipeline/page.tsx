"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PipelineEntry {
  id: string;
  stage: string;
  enrichmentStatus: string;
  enrichedData: Record<string, unknown> | null;
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
  { key: "DISCOVERED", label: "Discovered", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "RESEARCHING", label: "Researching", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "OUTREACH", label: "Outreach", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "IN_CONVERSATION", label: "In Conversation", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "APPLIED", label: "Applied", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

export default function PipelinePage() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline");
      const data = await res.json();
      if (res.ok) setEntries(data.entries);
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
    if (status === "authenticated") fetchPipeline();
  }, [status, router, fetchPipeline]);

  async function moveStage(entryId: string, stage: string) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, stage } : e)));
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, stage }),
      });
      if (!res.ok) fetchPipeline();
    } catch {
      fetchPipeline();
    }
  }

  async function enrichDonor(entryId: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "IN_PROGRESS" } : e))
    );
    try {
      const res = await fetch("/api/pipeline/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, enrichmentStatus: "COMPLETED", enrichedData: data.enrichedData } : e
          )
        );
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e))
        );
        if (data.upgrade) router.push("/billing");
      }
    } catch {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e))
      );
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Nav />
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" />
        </div>
      </>
    );
  }

  const grouped: Record<string, PipelineEntry[]> = {};
  for (const stage of STAGES) {
    grouped[stage.key] = entries.filter((e) => e.stage === stage.key);
  }
  const funded = entries.filter((e) => e.stage === "FUNDED");
  const rejected = entries.filter((e) => e.stage === "REJECTED");
  const totalActive = entries.length - funded.length - rejected.length;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Pipeline</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {totalActive} active &middot; {funded.length} funded
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard")}>Discover More</Button>
        </div>

        {entries.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light">
              <svg className="h-8 w-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">Your pipeline is empty</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Swipe right on donors you like — they&apos;ll appear here.
            </p>
            <Button className="mt-4" onClick={() => router.push("/dashboard")}>
              Discover Donors
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => (
                <div key={stage.key} className="min-w-[260px] flex-1">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stage.icon} />
                    </svg>
                    <span className="text-sm font-semibold text-zinc-700">{stage.label}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                      {grouped[stage.key]?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(grouped[stage.key] || []).map((entry) => (
                      <PipelineCard
                        key={entry.id}
                        entry={entry}
                        currentStage={stage.key}
                        onMoveStage={moveStage}
                        onEnrich={enrichDonor}
                      />
                    ))}
                    {(grouped[stage.key] || []).length === 0 && (
                      <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-xs text-zinc-400">
                        No donors yet
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(funded.length > 0 || rejected.length > 0) && (
              <div className="mt-10 border-t border-zinc-200 pt-6">
                <h2 className="mb-4 text-sm font-semibold text-zinc-500">Completed</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...funded, ...rejected].map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/donor/${entry.donor.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
                    >
                      <div>
                        <p className="font-medium text-zinc-900">{entry.donor.name}</p>
                        <p className="text-xs text-zinc-500">{entry.donor.type}</p>
                      </div>
                      <Badge variant={entry.stage === "FUNDED" ? "success" : "danger"}>
                        {entry.stage === "FUNDED" ? "Funded" : "Rejected"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function PipelineCard({
  entry,
  currentStage,
  onMoveStage,
  onEnrich,
}: {
  entry: PipelineEntry;
  currentStage: string;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isEnriching = entry.enrichmentStatus === "IN_PROGRESS";
  const isEnriched = entry.enrichmentStatus === "COMPLETED";

  const stageKeys = STAGES.map((s) => s.key);
  const nextKey = stageKeys[stageKeys.indexOf(currentStage) + 1];
  const nextLabel = STAGES.find((s) => s.key === nextKey)?.label;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <Link href={`/donor/${entry.donor.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-zinc-900 hover:text-brand">
              {entry.donor.name}
            </p>
            {isEnriched && (
              <span className="shrink-0 rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
                Enriched
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {entry.donor.type}{entry.donor.country ? ` · ${entry.donor.country}` : ""}
          </p>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
          {entry.donor.causes.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
              {c}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
          {nextKey && (
            <Button size="sm" variant="secondary" onClick={() => onMoveStage(entry.id, nextKey)}>
              → {nextLabel}
            </Button>
          )}
          {!isEnriched && (
            <Button size="sm" variant="secondary" loading={isEnriching} onClick={() => onEnrich(entry.id)}>
              {isEnriching ? "Enriching..." : "Enrich"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onMoveStage(entry.id, "FUNDED")}>
            Funded
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMoveStage(entry.id, "REJECTED")}>
            Reject
          </Button>
        </div>
      )}

      {!open && nextKey && (
        <button
          onClick={() => onMoveStage(entry.id, nextKey)}
          className="mt-2 text-xs font-medium text-brand hover:underline"
        >
          Move to {nextLabel} →
        </button>
      )}
    </div>
  );
}
