"use client";

import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./kanban-card";
import type { PipelineEntry } from "./types";
import type { STAGES } from "./types";

interface KanbanColumnProps {
  stage: (typeof STAGES)[number];
  entries: PipelineEntry[];
  isOver: boolean;
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, name: string) => void;
  onSelectDonor: (donorId: string, entryId: string) => void;
}

export function KanbanColumn({
  stage,
  entries,
  isOver,
  onMoveStage,
  onEnrich,
  onSelectDonor,
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverThis } = useDroppable({ id: stage.key });

  return (
    <div ref={setNodeRef} className="min-w-[260px] flex-1">
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {stage.label}
        </span>
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
          <KanbanCard
            key={entry.id}
            entry={entry}
            currentStage={stage.key}
            onMoveStage={onMoveStage}
            onEnrich={onEnrich}
            onSelect={onSelectDonor}
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
