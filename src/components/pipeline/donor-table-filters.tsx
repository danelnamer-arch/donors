"use client";

import { Input } from "@/components/ui/input";

const STAGE_OPTIONS = [
  { key: "DISCOVERED", label: "Discovered" },
  { key: "RESEARCHING", label: "Researching" },
  { key: "OUTREACH", label: "Outreach" },
  { key: "IN_CONVERSATION", label: "In Conversation" },
  { key: "APPLIED", label: "Applied" },
];

const TYPE_OPTIONS = ["FOUNDATION", "INDIVIDUAL", "CORPORATE", "GOVERNMENT", "DAF"];

const ENRICHMENT_OPTIONS = [
  { key: "NONE", label: "Not enriched" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Enriched" },
];

export interface PipelineFilters {
  search: string;
  stages: string[];
  types: string[];
  enrichment: string[];
}

interface DonorTableFiltersProps {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
}

export function DonorTableFilters({ filters, onChange }: DonorTableFiltersProps) {
  function toggleFilter(
    key: "stages" | "types" | "enrichment",
    value: string
  ) {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  const hasActiveFilters =
    filters.stages.length > 0 ||
    filters.types.length > 0 ||
    filters.enrichment.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <Input
          placeholder="Search donors..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-48 pl-8 text-xs"
        />
      </div>

      {/* Stage filter pills */}
      <FilterGroup label="Stage">
        {STAGE_OPTIONS.map((s) => (
          <FilterPill
            key={s.key}
            label={s.label}
            active={filters.stages.includes(s.key)}
            onClick={() => toggleFilter("stages", s.key)}
          />
        ))}
      </FilterGroup>

      {/* Type filter pills */}
      <FilterGroup label="Type">
        {TYPE_OPTIONS.map((t) => (
          <FilterPill
            key={t}
            label={t.charAt(0) + t.slice(1).toLowerCase()}
            active={filters.types.includes(t)}
            onClick={() => toggleFilter("types", t)}
          />
        ))}
      </FilterGroup>

      {/* Enrichment filter pills */}
      <FilterGroup label="Enrichment">
        {ENRICHMENT_OPTIONS.map((e) => (
          <FilterPill
            key={e.key}
            label={e.label}
            active={filters.enrichment.includes(e.key)}
            onClick={() => toggleFilter("enrichment", e.key)}
          />
        ))}
      </FilterGroup>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() =>
            onChange({ search: filters.search, stages: [], types: [], enrichment: [] })
          }
          className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}:
      </span>
      {children}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-brand text-white"
          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
