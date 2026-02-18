"use client";

import { useState } from "react";
import { formatGrantAmount } from "@/lib/utils/format-amount";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown-menu";
import type { PipelineEntry } from "./types";
import { STAGES, STAGE_BORDER_COLORS } from "./types";

interface KanbanCardProps {
  entry: PipelineEntry;
  currentStage: string;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, name: string) => void;
  onSelect: (donorId: string, entryId: string) => void;
}

export function KanbanCard({
  entry,
  currentStage,
  onMoveStage,
  onEnrich,
  onSelect,
}: KanbanCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isEnriching = entry.enrichmentStatus === "IN_PROGRESS";
  const isEnriched = entry.enrichmentStatus === "COMPLETED";

  const stageKeys = STAGES.map((s) => s.key);
  const currentIdx = stageKeys.indexOf(currentStage);

  return (
    <div
      className={`group rounded-lg border border-zinc-200 border-l-[3px] ${STAGE_BORDER_COLORS[currentStage]} bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950`}
      data-entry-id={entry.id}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Row 1: Name + dropdown */}
      <div className="flex items-start justify-between">
        <button
          onClick={() => onSelect(entry.donor.id, entry.id)}
          className="min-w-0 flex-1 text-left"
        >
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
        </button>
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
            <DropdownItem onClick={() => onSelect(entry.donor.id, entry.id)}>
              View Details
            </DropdownItem>
            {["OUTREACH", "IN_CONVERSATION", "APPLIED"].includes(currentStage) && (
              <DropdownItem onClick={() => onSelect(entry.donor.id, entry.id)}>
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

      {/* Row 2: Match score bar */}
      {entry.matchScore != null && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(entry.matchScore, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-zinc-400">{Math.round(entry.matchScore)}</span>
        </div>
      )}

      {/* Row 3: Total giving + last active */}
      {(entry.donor.totalGivingUsd || entry.donor.givingYearRange) && (
        <p className="mt-1.5 text-[11px] text-zinc-500">
          {entry.donor.totalGivingUsd ? formatGrantAmount(entry.donor.totalGivingUsd) : ""}
          {entry.donor.totalGivingUsd && entry.donor.givingYearRange ? " · " : ""}
          {entry.donor.givingYearRange || ""}
        </p>
      )}

      {/* Row 4: Causes */}
      {entry.donor.causes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.donor.causes.slice(0, 2).map((c) => (
            <span key={c} className="max-w-[90px] truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
              {c}
            </span>
          ))}
          {entry.donor.causes.length > 2 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-400 dark:bg-zinc-800">
              +{entry.donor.causes.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Row 5: Hover quick actions */}
      <div
        className={`mt-2 flex gap-1 transition-all ${
          showActions ? "h-auto opacity-100" : "h-0 overflow-hidden opacity-0"
        }`}
      >
        {!isEnriched && !isEnriching && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnrich(entry.id, entry.donor.name);
            }}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
            title="Enrich"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(entry.donor.id, entry.id);
          }}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          title="View Details"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        {currentIdx < stageKeys.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveStage(entry.id, stageKeys[currentIdx + 1]);
            }}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title={`Move to ${STAGES[currentIdx + 1]?.label}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
