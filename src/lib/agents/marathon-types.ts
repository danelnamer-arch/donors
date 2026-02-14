/**
 * Marathon Discovery — Type Definitions
 *
 * Types for the marathon runner system that orchestrates
 * long-running (multi-hour) donor discovery across multiple phases.
 */

import type { DiscoveryTarget } from "./batch-discovery";

// ─── Phase Configuration ────────────────────────────────────────

export interface MarathonPhase {
  /** Phase number (1-5) */
  number: number;
  /** Human-readable phase name */
  name: string;
  /** Discovery targets for this phase (used by phases 2-4) */
  targets: DiscoveryTarget[];
  /** Direct donor names to research (used by phase 2 prong B) */
  directNames?: DirectNameTarget[];
  /** Delay between targets in milliseconds */
  delayBetweenMs: number;
  /** Expected donor yield (for progress estimation) */
  expectedYield: number;
  /** Phase execution strategy */
  strategy: "irs990" | "discovery" | "direct-name" | "two-prong" | "enrichment";
}

export interface DirectNameTarget {
  /** Donor name to research */
  name: string;
  /** Expected donor type */
  type?: "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER";
  /** Known country for hints */
  country?: string;
  /** Known website for hints */
  website?: string;
  /** Default confidence level for this donor */
  defaultConfidence?: "CONFIRMED" | "LIKELY" | "SUSPECTED";
}

// ─── Marathon Configuration ─────────────────────────────────────

export interface MarathonConfig {
  /** Which phases to run (1-5). Default: all */
  phases: number[];
  /** Resume from last checkpoint */
  resume: boolean;
  /** Log targets without executing */
  dryRun: boolean;
  /** Path to checkpoint file */
  checkpointPath: string;
  /** Path to progress file */
  progressPath: string;
  /** Progress callback */
  onProgress: (msg: string) => void;
  /** IRS 990 config */
  irs990?: {
    maxPagesPerKeyword?: number;
  };
  /** Enrichment config */
  enrichment?: {
    maxDonors?: number;
    minQualityThreshold?: number;
  };
}

// ─── Checkpoint (persisted to disk) ─────────────────────────────

export interface MarathonCheckpoint {
  /** Unique run identifier */
  runId: string;
  /** When this run started */
  startedAt: string;
  /** Last checkpoint update */
  lastUpdatedAt: string;
  /** Current phase number (1-5) */
  currentPhase: number;
  /** Current target index within the phase */
  currentTargetIndex: number;
  /** Whether we're in prong A or B for two-prong phases */
  currentProng?: "A" | "B";
  /** Completed targets with results */
  targetsCompleted: CompletedTarget[];
  /** Cumulative stats */
  totalStored: number;
  totalDiscovered: number;
  totalErrors: number;
  /** Run status */
  status: "running" | "completed" | "interrupted" | "failed";
}

export interface CompletedTarget {
  phase: number;
  targetIndex: number;
  prong?: "A" | "B";
  label: string;
  result: {
    discovered: number;
    stored: number;
    errors: number;
    skippedDuplicates: number;
  };
  durationMs: number;
}

// ─── Progress (live monitoring file) ────────────────────────────

export interface MarathonProgress {
  runId: string;
  status: string;
  phase: {
    current: number;
    total: number;
    name: string;
  };
  target: {
    current: number;
    total: number;
    label: string;
  };
  stats: {
    totalStored: number;
    totalDiscovered: number;
    totalErrors: number;
    totalSkippedDuplicates: number;
    dbDonorCount: number;
    elapsedMs: number;
    estimatedRemainingMs: number;
  };
  /** Last 20 activity log lines */
  recentActivity: string[];
}

// ─── Results ────────────────────────────────────────────────────

export interface PhaseResult {
  phase: number;
  name: string;
  stored: number;
  discovered: number;
  errors: number;
  skippedDuplicates: number;
  durationMs: number;
  targetResults: CompletedTarget[];
}

export interface MarathonResult {
  runId: string;
  totalStored: number;
  totalDiscovered: number;
  totalErrors: number;
  totalSkippedDuplicates: number;
  durationMs: number;
  phaseResults: PhaseResult[];
  finalDbDonorCount: number;
}
