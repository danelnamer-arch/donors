"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineColumnSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown-menu";

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
  { key: "DISCOVERED", label: "Discovered", color: "bg-zinc-400", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "RESEARCHING", label: "Researching", color: "bg-blue-500", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "OUTREACH", label: "Outreach", color: "bg-amber-500", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "IN_CONVERSATION", label: "In Conversation", color: "bg-purple-500", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "APPLIED", label: "Applied", color: "bg-indigo-500", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

const STAGE_BORDER_COLORS: Record<string, string> = {
  DISCOVERED: "border-l-zinc-400",
  RESEARCHING: "border-l-blue-500",
  OUTREACH: "border-l-amber-500",
  IN_CONVERSATION: "border-l-purple-500",
  APPLIED: "border-l-indigo-500",
};

export default function PipelinePage() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline");
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

  async function moveStage(entryId: string, stage: string) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, stage } : e)));
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
      prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "IN_PROGRESS" } : e))
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
            e.id === entryId ? { ...e, enrichmentStatus: "COMPLETED", enrichedData: data.enrichedData } : e
          )
        );
        toast.success(`Enriched ${donorName}`, { id: toastId });
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e))
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
        prev.map((e) => (e.id === entryId ? { ...e, enrichmentStatus: "NONE" } : e))
      );
      toast.error(`Failed to enrich ${donorName}`, { id: toastId });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const entryId = active.id as string;
    const targetStage = over.id as string;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.stage === targetStage) return;

    moveStage(entryId, targetStage);
  }

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

  const grouped: Record<string, PipelineEntry[]> = {};
  for (const stage of STAGES) {
    grouped[stage.key] = entries.filter((e) => e.stage === stage.key);
  }
  const funded = entries.filter((e) => e.stage === "FUNDED");
  const rejected = entries.filter((e) => e.stage === "REJECTED");
  const totalActive = entries.length - funded.length - rejected.length;

  const activeEntry = entries.find((e) => e.id === activeId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Pipeline</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {totalActive} active &middot; {funded.length} funded
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard")}>
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Discover More
          </Button>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4">
                {STAGES.map((stage) => (
                  <DroppableColumn
                    key={stage.key}
                    stage={stage}
                    entries={grouped[stage.key] || []}
                    isOver={activeId !== null}
                    onMoveStage={moveStage}
                    onEnrich={enrichDonor}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeEntry ? (
                  <div className="w-[260px] rounded-lg border-2 border-brand bg-white p-3 opacity-90 shadow-2xl dark:bg-zinc-950">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{activeEntry.donor.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{activeEntry.donor.type}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {(funded.length > 0 || rejected.length > 0) && (
              <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <h2 className="mb-4 text-sm font-semibold text-zinc-500">Completed</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...funded, ...rejected].map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/donor/${entry.donor.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{entry.donor.name}</p>
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
  );
}

function DroppableColumn({
  stage,
  entries,
  isOver,
  onMoveStage,
  onEnrich,
}: {
  stage: typeof STAGES[number];
  entries: PipelineEntry[];
  isOver: boolean;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, name: string) => void;
}) {
  const { setNodeRef, isOver: isOverThis } = useDroppable({ id: stage.key });

  return (
    <div ref={setNodeRef} className="min-w-[260px] flex-1">
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{stage.label}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
          {entries.length}
        </span>
      </div>
      <div
        className={`min-h-[120px] space-y-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          isOverThis
            ? "border-brand bg-brand-light/50"
            : isOver
              ? "border-zinc-300 dark:border-zinc-700"
              : "border-transparent"
        }`}
      >
        {entries.map((entry) => (
          <DraggablePipelineCard
            key={entry.id}
            entry={entry}
            currentStage={stage.key}
            onMoveStage={onMoveStage}
            onEnrich={onEnrich}
          />
        ))}
        {entries.length === 0 && (
          <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-800">
            {isOverThis ? "Drop here" : "No donors yet"}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggablePipelineCard({
  entry,
  currentStage,
  onMoveStage,
  onEnrich,
}: {
  entry: PipelineEntry;
  currentStage: string;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, name: string) => void;
}) {
  const isEnriching = entry.enrichmentStatus === "IN_PROGRESS";
  const isEnriched = entry.enrichmentStatus === "COMPLETED";

  const stageKeys = STAGES.map((s) => s.key);
  const currentIdx = stageKeys.indexOf(currentStage);

  return (
    <div
      className={`rounded-lg border border-zinc-200 border-l-[3px] ${STAGE_BORDER_COLORS[currentStage]} bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950`}
      data-entry-id={entry.id}
    >
      <div className="flex items-start justify-between">
        <Link href={`/donor/${entry.donor.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-zinc-900 hover:text-brand dark:text-zinc-100">
              {entry.donor.name}
            </p>
            {isEnriched && (
              <span className="shrink-0 rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Enriched
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {entry.donor.type}{entry.donor.country ? ` · ${entry.donor.country}` : ""}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownTrigger className="ml-2 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </DropdownTrigger>
          <DropdownContent align="end">
            {STAGES.map((s, i) => {
              if (i <= currentIdx) return null;
              return (
                <DropdownItem key={s.key} onClick={() => onMoveStage(entry.id, s.key)}>
                  Move to {s.label}
                </DropdownItem>
              );
            })}
            <DropdownSeparator />
            {!isEnriched && (
              <DropdownItem onClick={() => onEnrich(entry.id, entry.donor.name)} disabled={isEnriching}>
                {isEnriching ? "Enriching..." : "Enrich"}
              </DropdownItem>
            )}
            <DropdownItem onClick={() => window.location.href = `/donor/${entry.donor.id}`}>
              View Details
            </DropdownItem>
            {["OUTREACH", "IN_CONVERSATION", "APPLIED"].includes(currentStage) && (
              <DropdownItem onClick={() => window.location.href = `/donor/${entry.donor.id}?outreach=true`}>
                Draft Outreach
              </DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem onClick={() => onMoveStage(entry.id, "FUNDED")}>
              Mark Funded
            </DropdownItem>
            <DropdownItem destructive onClick={() => onMoveStage(entry.id, "REJECTED")}>
              Reject
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      {entry.donor.causes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.donor.causes.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
