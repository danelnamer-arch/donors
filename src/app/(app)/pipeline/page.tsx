"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineColumnSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewSwitcher } from "@/components/pipeline/view-switcher";
import { DonorTableFilters, type PipelineFilters } from "@/components/pipeline/donor-table-filters";
import { DonorTable } from "@/components/pipeline/donor-table";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { DonorDetailPanel } from "@/components/pipeline/donor-detail-panel";
import type { PipelineEntry } from "@/components/pipeline/types";

export default function PipelinePage() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<"table" | "board">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("funderra-pipeline-view") as "table" | "board") || "table";
    }
    return "table";
  });

  // Panel state
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState<PipelineFilters>({
    search: "",
    stages: [],
    types: [],
    enrichment: [],
  });

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline?include=match");
      const data = await res.json();
      if (res.ok) setEntries(data.entries);
      else toast.error("Failed to load pipeline");
    } catch {
      toast.error("Failed to load pipeline");
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

  // Persist view mode
  function handleViewChange(view: "table" | "board") {
    setViewMode(view);
    localStorage.setItem("funderra-pipeline-view", view);
  }

  // Pipeline actions
  async function moveStage(entryId: string, stage: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, stage } : e))
    );
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, stage }),
      });
      if (!res.ok) {
        toast.error("Failed to move donor");
        fetchPipeline();
      }
    } catch {
      toast.error("Failed to move donor");
      fetchPipeline();
    }
  }

  async function enrichDonor(entryId: string, donorName: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, enrichmentStatus: "IN_PROGRESS" } : e
      )
    );
    const toastId = toast.loading(`Enriching ${donorName}...`);
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
            e.id === entryId
              ? { ...e, enrichmentStatus: "COMPLETED", enrichedData: data.enrichedData }
              : e
          )
        );
        toast.success(`Enriched ${donorName}`, { id: toastId });
      } else {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e
          )
        );
        if (data.upgrade) {
          toast.error("Upgrade required for enrichments", { id: toastId });
          router.push("/billing");
        } else {
          toast.error(`Failed to enrich ${donorName}`, { id: toastId });
        }
      }
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e
        )
      );
      toast.error(`Failed to enrich ${donorName}`, { id: toastId });
    }
  }

  function handleSelectDonor(donorId: string) {
    setSelectedDonorId(donorId);
    setPanelOpen(true);
  }

  function handleClosePanel() {
    setPanelOpen(false);
    setSelectedDonorId(null);
  }

  function handlePanelStageChange(entryId: string, stage: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, stage } : e))
    );
  }

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Exclude funded/rejected from active views
      if (e.stage === "FUNDED" || e.stage === "REJECTED") return false;

      if (
        filters.search &&
        !e.donor.name.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;

      if (filters.stages.length > 0 && !filters.stages.includes(e.stage))
        return false;

      if (filters.types.length > 0 && !filters.types.includes(e.donor.type))
        return false;

      if (
        filters.enrichment.length > 0 &&
        !filters.enrichment.includes(e.enrichmentStatus)
      )
        return false;

      return true;
    });
  }, [entries, filters]);

  const funded = entries.filter((e) => e.stage === "FUNDED");
  const rejected = entries.filter((e) => e.stage === "REJECTED");
  const totalActive = entries.length - funded.length - rejected.length;

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="h-7 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <PipelineColumnSkeleton />
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 pt-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {totalActive} active &middot; {funded.length} funded
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewSwitcher view={viewMode} onChange={handleViewChange} />
          <Button onClick={() => router.push("/dashboard")}>
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Discover More
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="pb-4">
        <DonorTableFilters filters={filters} onChange={setFilters} />
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
            title="Your pipeline is empty"
            description="Swipe right on donors you like — they'll appear here."
            action={
              <Button onClick={() => router.push("/dashboard")}>
                Discover Donors
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-0">
          {/* Main view area */}
          <div className={`min-w-0 flex-1 overflow-auto ${panelOpen ? "pr-0" : ""}`}>
            {viewMode === "table" ? (
              <DonorTable
                entries={filteredEntries}
                selectedId={selectedDonorId}
                onSelectDonor={handleSelectDonor}
                onMoveStage={moveStage}
                onEnrich={enrichDonor}
              />
            ) : (
              <KanbanBoard
                entries={filteredEntries}
                onMoveStage={moveStage}
                onEnrich={enrichDonor}
                onSelectDonor={handleSelectDonor}
              />
            )}

            {/* Completed section (below both views) */}
            {(funded.length > 0 || rejected.length > 0) && (
              <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <h2 className="mb-4 text-sm font-semibold text-zinc-500">
                  Completed
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...funded, ...rejected].map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleSelectDonor(entry.donor.id)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {entry.donor.name}
                        </p>
                        <p className="text-xs text-zinc-500">{entry.donor.type}</p>
                      </div>
                      <Badge
                        variant={
                          entry.stage === "FUNDED" ? "success" : "danger"
                        }
                      >
                        {entry.stage === "FUNDED" ? "Funded" : "Rejected"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {panelOpen && selectedDonorId && (
            <DonorDetailPanel
              donorId={selectedDonorId}
              onClose={handleClosePanel}
              onStageChange={handlePanelStageChange}
              onEnrich={enrichDonor}
            />
          )}
        </div>
      )}
    </main>
  );
}
