"use client";

import { useState, useMemo } from "react";
import { formatGrantAmount } from "@/lib/utils/format-amount";
import type { PipelineEntry } from "./types";

const STAGES: Record<string, { label: string; color: string; dot: string }> = {
  DISCOVERED: { label: "Discovered", color: "default", dot: "bg-zinc-400" },
  RESEARCHING: { label: "Researching", color: "info", dot: "bg-blue-500" },
  OUTREACH: { label: "Outreach", color: "warning", dot: "bg-amber-500" },
  IN_CONVERSATION: { label: "In Conversation", color: "warning", dot: "bg-purple-500" },
  APPLIED: { label: "Applied", color: "info", dot: "bg-indigo-500" },
};

const STAGE_KEYS = Object.keys(STAGES);

type SortKey =
  | "name"
  | "stage"
  | "type"
  | "matchScore"
  | "totalGiving"
  | "avgGrant"
  | "grantCount"
  | "country"
  | "enrichment"
  | "updatedAt";

type SortDir = "asc" | "desc";

interface DonorTableProps {
  entries: PipelineEntry[];
  selectedId: string | null;
  onSelectDonor: (donorId: string, entryId: string) => void;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, donorName: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DonorTable({
  entries,
  selectedId,
  onSelectDonor,
  onMoveStage,
  onEnrich,
}: DonorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...entries];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.donor.name.localeCompare(b.donor.name);
        case "stage":
          return dir * (STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage));
        case "type":
          return dir * a.donor.type.localeCompare(b.donor.type);
        case "matchScore":
          return dir * ((a.matchScore ?? 0) - (b.matchScore ?? 0));
        case "totalGiving":
          return dir * ((a.donor.totalGivingUsd ?? 0) - (b.donor.totalGivingUsd ?? 0));
        case "avgGrant":
          return dir * ((a.donor.avgGrantSizeUsd ?? 0) - (b.donor.avgGrantSizeUsd ?? 0));
        case "grantCount":
          return dir * ((a.donor.grantCount ?? 0) - (b.donor.grantCount ?? 0));
        case "country":
          return dir * (a.donor.country ?? "").localeCompare(b.donor.country ?? "");
        case "enrichment":
          return dir * a.enrichmentStatus.localeCompare(b.enrichmentStatus);
        case "updatedAt":
          return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        default:
          return 0;
      }
    });

    return arr;
  }, [entries, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <SortHeader label="Name" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} className="min-w-[200px]" />
            <SortHeader label="Stage" sortKey="stage" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[130px]" />
            <SortHeader label="Type" sortKey="type" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[100px]" />
            <SortHeader label="Score" sortKey="matchScore" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[80px]" />
            <SortHeader label="Total Giving" sortKey="totalGiving" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[110px] text-right" />
            <SortHeader label="Avg Grant" sortKey="avgGrant" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[100px] text-right" />
            <SortHeader label="Grants" sortKey="grantCount" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[60px] text-right" />
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 w-[150px]">
              Causes
            </th>
            <SortHeader label="Location" sortKey="country" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[100px]" />
            <SortHeader label="Enriched" sortKey="enrichment" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[100px]" />
            <SortHeader label="Updated" sortKey="updatedAt" current={sortKey} dir={sortDir} onClick={handleSort} className="w-[80px]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((entry) => {
            const isSelected = entry.donor.id === selectedId;
            const isEnriched = entry.enrichmentStatus === "COMPLETED";
            const isEnriching = entry.enrichmentStatus === "IN_PROGRESS";

            return (
              <tr
                key={entry.id}
                onClick={() => onSelectDonor(entry.donor.id, entry.id)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-brand-light/50 dark:bg-brand-light/10"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                {/* Name */}
                <td className="px-3 py-2.5">
                  <div className={`flex items-center gap-2 ${isSelected ? "border-l-2 border-brand pl-2" : ""}`}>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {entry.donor.name}
                    </span>
                  </div>
                </td>

                {/* Stage */}
                <td className="px-3 py-2.5">
                  <StageDropdown
                    currentStage={entry.stage}
                    onSelect={(stage) => onMoveStage(entry.id, stage)}
                  />
                </td>

                {/* Type */}
                <td className="px-3 py-2.5">
                  <span className="text-xs text-zinc-500">
                    {entry.donor.type.charAt(0) + entry.donor.type.slice(1).toLowerCase()}
                  </span>
                </td>

                {/* Match Score */}
                <td className="px-3 py-2.5">
                  {entry.matchScore != null ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.min(entry.matchScore, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-zinc-500">
                        {Math.round(entry.matchScore)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>

                {/* Total Giving */}
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {entry.donor.totalGivingUsd
                      ? formatGrantAmount(entry.donor.totalGivingUsd)
                      : "—"}
                  </span>
                </td>

                {/* Avg Grant */}
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs text-zinc-500">
                    {entry.donor.avgGrantSizeUsd
                      ? formatGrantAmount(entry.donor.avgGrantSizeUsd)
                      : "—"}
                  </span>
                </td>

                {/* Grant count */}
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs text-zinc-500">
                    {entry.donor.grantCount || "—"}
                  </span>
                </td>

                {/* Causes */}
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {entry.donor.causes.slice(0, 2).map((c) => (
                      <span
                        key={c}
                        className="max-w-[80px] truncate rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800"
                      >
                        {c}
                      </span>
                    ))}
                    {entry.donor.causes.length > 2 && (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
                        +{entry.donor.causes.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* Location */}
                <td className="px-3 py-2.5">
                  <span className="text-xs text-zinc-500 truncate">
                    {entry.donor.country || "—"}
                  </span>
                </td>

                {/* Enrichment */}
                <td className="px-3 py-2.5">
                  {isEnriching ? (
                    <span className="flex items-center gap-1 text-[11px] text-blue-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                      Running
                    </span>
                  ) : isEnriched ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Enriched
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnrich(entry.id, entry.donor.name);
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-brand-light hover:text-brand"
                    >
                      Enrich
                    </button>
                  )}
                </td>

                {/* Updated */}
                <td className="px-3 py-2.5">
                  <span className="text-[11px] text-zinc-400">
                    {timeAgo(entry.updatedAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sorted.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
          No donors match your filters
        </div>
      )}
    </div>
  );
}

/* ─── Sort header cell ──────────────────────────── */
function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = current === sortKey;
  return (
    <th
      className={`cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300 ${className}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <svg
            className={`h-3 w-3 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </span>
    </th>
  );
}

/* ─── Stage inline dropdown ─────────────────────── */
function StageDropdown({
  currentStage,
  onSelect,
}: {
  currentStage: string;
  onSelect: (stage: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const info = STAGES[currentStage] || { label: currentStage, dot: "bg-zinc-400" };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span className={`h-2 w-2 rounded-full ${info.dot}`} />
        {info.label}
        <svg className="h-3 w-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {Object.entries(STAGES).map(([key, val]) => (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  key === currentStage ? "font-medium text-brand" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${val.dot}`} />
                {val.label}
              </button>
            ))}
            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect("FUNDED");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-green-600 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Funded
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect("REJECTED");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Rejected
            </button>
          </div>
        </>
      )}
    </div>
  );
}
