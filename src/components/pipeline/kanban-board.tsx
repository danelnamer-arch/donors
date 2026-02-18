"use client";

import { useState } from "react";
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
import { KanbanColumn } from "./kanban-column";
import type { PipelineEntry } from "./types";
import { STAGES } from "./types";

interface KanbanBoardProps {
  entries: PipelineEntry[];
  onMoveStage: (entryId: string, stage: string) => void;
  onEnrich: (entryId: string, name: string) => void;
  onSelectDonor: (donorId: string, entryId: string) => void;
}

export function KanbanBoard({
  entries,
  onMoveStage,
  onEnrich,
  onSelectDonor,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const grouped: Record<string, PipelineEntry[]> = {};
  for (const stage of STAGES) {
    grouped[stage.key] = entries.filter((e) => e.stage === stage.key);
  }

  const activeEntry = entries.find((e) => e.id === activeId);

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

    onMoveStage(entryId, targetStage);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            entries={grouped[stage.key] || []}
            isOver={activeId !== null}
            onMoveStage={onMoveStage}
            onEnrich={onEnrich}
            onSelectDonor={onSelectDonor}
          />
        ))}
      </div>

      <DragOverlay>
        {activeEntry ? (
          <div className="w-[260px] rounded-lg border-2 border-brand bg-white p-3 opacity-90 shadow-2xl dark:bg-zinc-950">
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {activeEntry.donor.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{activeEntry.donor.type}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
