/**
 * Batch Discovery Pipeline
 * Runs donor discovery across 20 diverse cause/region combinations
 * to build a comprehensive, multi-sector donor database.
 *
 * Uses the existing runDiscoveryPipeline() for each target,
 * with rate limiting and error recovery between runs.
 *
 * Expected yield: ~100 new donors at ~$50-80 API cost.
 */

import { runDiscoveryPipeline } from "./orchestrator";

export interface DiscoveryTarget {
  cause: string;
  targetPopulation?: string;
  region?: string;
  /** Hint for discovery prompts to focus on individual donors vs foundations */
  donorTypeHint?: "INDIVIDUAL" | "FOUNDATION";
}

export interface BatchResult {
  target: DiscoveryTarget;
  discovered: number;
  validated: number;
  stored: number;
  errors: string[];
  durationMs: number;
}

export interface BatchDiscoveryResult {
  totalTargets: number;
  completed: number;
  failed: number;
  totalDiscovered: number;
  totalStored: number;
  results: BatchResult[];
  durationMs: number;
}

/**
 * Default discovery targets — 20 diverse cause/region combinations.
 */
export const DEFAULT_DISCOVERY_TARGETS: DiscoveryTarget[] = [
  { cause: "global health", region: "United States" },
  { cause: "climate change", region: "Global" },
  { cause: "education equality", targetPopulation: "underserved youth" },
  { cause: "food security", region: "Africa" },
  { cause: "women empowerment", region: "South Asia" },
  { cause: "refugee assistance", region: "Europe" },
  { cause: "mental health", region: "United States" },
  { cause: "arts and culture", region: "United States" },
  { cause: "indigenous rights", region: "Americas" },
  { cause: "disability inclusion", region: "Global" },
  { cause: "LGBTQ rights", region: "United States" },
  { cause: "clean water", region: "Sub-Saharan Africa" },
  { cause: "elderly care", region: "United States" },
  { cause: "criminal justice reform", region: "United States" },
  { cause: "science research", region: "Global" },
  { cause: "housing and homelessness", region: "United States" },
  { cause: "early childhood development", region: "Global" },
  { cause: "interfaith dialogue", region: "Global" },
  { cause: "technology access", targetPopulation: "rural communities" },
  { cause: "disaster relief", region: "Global" },
];

/**
 * Run batch discovery across multiple targets sequentially.
 * Each target runs the full pipeline: search → research → extract → validate → store.
 */
export async function runBatchDiscovery(options?: {
  targets?: DiscoveryTarget[];
  delayBetweenMs?: number;
  onProgress?: (msg: string, targetIndex: number, total: number) => void;
}): Promise<BatchDiscoveryResult> {
  const targets = options?.targets ?? DEFAULT_DISCOVERY_TARGETS;
  const delay = options?.delayBetweenMs ?? 5000;
  const onProgress = options?.onProgress ?? (() => {});

  const results: BatchResult[] = [];
  let completed = 0;
  let failed = 0;
  let totalDiscovered = 0;
  let totalStored = 0;
  const startTime = Date.now();

  onProgress(`Starting batch discovery for ${targets.length} targets...`, 0, targets.length);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const label = `${target.cause}${target.region ? ` (${target.region})` : ""}${target.targetPopulation ? ` [${target.targetPopulation}]` : ""}`;

    onProgress(
      `[${i + 1}/${targets.length}] Discovering: ${label}`,
      i + 1,
      targets.length
    );

    const runStart = Date.now();

    try {
      const result = await runDiscoveryPipeline({
        cause: target.cause,
        targetPopulation: target.targetPopulation,
        region: target.region,
      });

      const batchResult: BatchResult = {
        target,
        discovered: result.discovered,
        validated: result.validated,
        stored: result.stored,
        errors: result.errors,
        durationMs: Date.now() - runStart,
      };

      results.push(batchResult);
      totalDiscovered += result.discovered;
      totalStored += result.stored;
      completed++;

      onProgress(
        `[${i + 1}/${targets.length}] ${label}: ${result.stored} stored, ${result.discovered} discovered${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
        i + 1,
        targets.length
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      results.push({
        target,
        discovered: 0,
        validated: 0,
        stored: 0,
        errors: [errMsg],
        durationMs: Date.now() - runStart,
      });
      failed++;

      onProgress(
        `[${i + 1}/${targets.length}] FAILED: ${label} — ${errMsg}`,
        i + 1,
        targets.length
      );
    }

    // Rate limiting between targets
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const totalDuration = Date.now() - startTime;
  onProgress(
    `Batch discovery complete: ${totalStored} stored from ${totalDiscovered} discovered (${completed} succeeded, ${failed} failed) in ${Math.round(totalDuration / 1000)}s`,
    targets.length,
    targets.length
  );

  return {
    totalTargets: targets.length,
    completed,
    failed,
    totalDiscovered,
    totalStored,
    results,
    durationMs: totalDuration,
  };
}
