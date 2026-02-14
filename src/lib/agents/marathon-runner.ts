/**
 * Marathon Discovery Runner
 *
 * Orchestrates a multi-hour, multi-phase donor discovery process.
 * Designed to be run as a standalone CLI script overnight, but also
 * callable from the admin API for future use.
 *
 * Features:
 * - 5-phase execution (IRS 990 → Israel → American → Federations → Enrichment)
 * - Two-prong Israeli discovery (cause-based + direct-name research)
 * - Pre-research deduplication (saves ~10 API calls per duplicate)
 * - Checkpoint/resume support
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Progress file for live monitoring
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";
import { prisma } from "@/lib/prisma";
import { runDiscoveryPipeline, runEnrichmentPipeline } from "./orchestrator";
import { deepResearchDonor } from "./deep-research-agent";
import { crawlDonorWebsite } from "./crawl-agent";
import { validateDonorCandidate } from "./validator-agent";
import { findAndVerifyWebsite } from "./website-verifier";
import { extractDonorProfile, analyzeGrantGeography } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/openai";
import { normalizeGrantAmount, normalizeTotalGiving } from "@/lib/utils/normalize-amount";
import { validateDonorCreate, validateGrant } from "@/lib/validation/validate-and-normalize";
import { importAllSectors } from "@/lib/irs990";
import { DedupChecker } from "./dedup-checker";
import { MARATHON_PHASES, getPhase } from "./marathon-targets";
import type {
  MarathonConfig,
  MarathonCheckpoint,
  MarathonProgress,
  MarathonResult,
  PhaseResult,
  CompletedTarget,
  DirectNameTarget,
} from "./marathon-types";
import type { DonorCandidate } from "./types";

// ─── Helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// ─── Checkpoint I/O ─────────────────────────────────────────────

function loadCheckpoint(filepath: string): MarathonCheckpoint | null {
  try {
    if (!fs.existsSync(filepath)) return null;
    const raw = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as MarathonCheckpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(filepath: string, checkpoint: MarathonCheckpoint): void {
  checkpoint.lastUpdatedAt = timestamp();
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
}

function saveProgress(filepath: string, progress: MarathonProgress): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(progress, null, 2));
}

// ─── Shared State ───────────────────────────────────────────────

let shuttingDown = false;
const activityLog: string[] = [];

function log(config: MarathonConfig, msg: string): void {
  const line = `[${timestamp()}] ${msg}`;
  config.onProgress(line);
  activityLog.push(line);
  if (activityLog.length > 30) activityLog.shift();
}

// ─── Direct Name Research Pipeline ──────────────────────────────

/**
 * Research a specific donor by name using the full pipeline:
 * Perplexity research → Gemini extraction → website crawl → validation → storage.
 *
 * This is used for Phase 2 Prong B (known Israeli/Jewish donors).
 */
async function researchAndStoreDonor(
  target: DirectNameTarget,
  dedupChecker: DedupChecker,
  config: MarathonConfig
): Promise<{ stored: boolean; error?: string }> {
  const name = target.name;

  // Check dedup
  const dedupResult = dedupChecker.isDuplicate({
    name,
    website: target.website,
  });
  if (dedupResult.isDuplicate) {
    log(config, `  SKIP (dedup): ${name} — ${dedupResult.reason}`);
    return { stored: false };
  }

  // Also check DB directly (belt and suspenders)
  const existing = await prisma.donor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    log(config, `  SKIP (DB): ${name} — already exists`);
    return { stored: false };
  }

  // Step 1: Deep research via Perplexity
  log(config, `  Researching: ${name}`);
  const research = await deepResearchDonor(name);
  if (!research.success || !research.data) {
    return { stored: false, error: `Research failed for ${name}: ${research.error}` };
  }

  let donorData: Partial<DonorCandidate> = {
    ...research.data,
    name,
    type: target.type ?? (research.data.type as DonorCandidate["type"]) ?? "FOUNDATION",
    country: target.country ?? research.data.country,
    donorConfidence: target.defaultConfidence ?? "CONFIRMED",
  };

  // Step 2: Gemini structured extraction
  if (donorData.description && process.env.GEMINI_API_KEY) {
    try {
      const rawText = [donorData.description, donorData.causes?.join(", "), donorData.geographicFocus?.join(", ")]
        .filter(Boolean)
        .join("\n");
      const geminiProfile = await extractDonorProfile(rawText, name);

      donorData = {
        ...donorData,
        headquartersCountry: donorData.headquartersCountry ?? geminiProfile.headquartersCountry ?? target.country,
        headquartersCity: donorData.headquartersCity ?? geminiProfile.headquartersCity ?? undefined,
        activeRegions: mergeArrays(donorData.activeRegions, geminiProfile.activeRegions),
        causes: mergeArrays(donorData.causes, geminiProfile.causes),
        targetPopulations: mergeArrays(donorData.targetPopulations, geminiProfile.targetPopulations),
        geographicFocus: mergeArrays(donorData.geographicFocus, geminiProfile.geographicFocus),
        totalGivingUsd: normalizeTotalGiving(donorData.totalGivingUsd ?? geminiProfile.totalGivingUsd) ?? undefined,
        avgGrantSizeUsd: normalizeGrantAmount(donorData.avgGrantSizeUsd ?? geminiProfile.avgGrantSizeUsd) ?? undefined,
        contactEmail: donorData.contactEmail ?? geminiProfile.email ?? undefined,
        contactPhone: donorData.contactPhone ?? geminiProfile.phone ?? undefined,
        website: donorData.website ?? geminiProfile.website ?? target.website ?? undefined,
        grants: deduplicateGrants([
          ...(donorData.grants ?? []),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...geminiProfile.grants.map((g: any) => ({
            recipientName: String(g.recipientName ?? ""),
            amount: normalizeGrantAmount(g.amount) ?? undefined,
            year: g.year != null ? Number(g.year) : undefined,
            purpose: g.purpose ?? undefined,
          })),
        ]),
      };
    } catch (err) {
      log(config, `  Gemini extraction failed for ${name}: ${err}`);
    }
  }

  // Step 3: Website crawl
  if (donorData.website) {
    try {
      const crawlResult = await crawlDonorWebsite(donorData.website, name);
      if (crawlResult.success && crawlResult.data) {
        donorData = {
          ...donorData,
          description:
            donorData.description && donorData.description.length > (crawlResult.data.description?.length ?? 0)
              ? donorData.description
              : crawlResult.data.description ?? donorData.description,
          causes: mergeArrays(donorData.causes, crawlResult.data.causes),
          targetPopulations: mergeArrays(donorData.targetPopulations, crawlResult.data.targetPopulations),
          geographicFocus: mergeArrays(donorData.geographicFocus, crawlResult.data.geographicFocus),
          grants: deduplicateGrants([...(donorData.grants ?? []), ...(crawlResult.data.grants ?? [])]),
          dataSources: [...(donorData.dataSources ?? []), ...(crawlResult.data.dataSources ?? [])],
        };
      }
    } catch (err) {
      log(config, `  Crawl failed for ${name}: ${err}`);
    }
  }

  // Step 4: Website verification
  try {
    const verification = await findAndVerifyWebsite(name, {
      claimedUrl: donorData.website,
      ein: undefined,
      irsWebsite: undefined,
    });
    donorData.websiteVerified = verification.verified;
    donorData.websiteSource = verification.source;
    if (verification.verified && verification.url) {
      donorData.website = verification.url;
    }
  } catch (err) {
    log(config, `  Website verification failed for ${name}: ${err}`);
  }

  // Step 5: Grant geography analysis
  if ((donorData.grants?.length ?? 0) > 0 && process.env.GEMINI_API_KEY) {
    try {
      const grantGeo = await analyzeGrantGeography(
        name,
        donorData.grants!.map((g) => ({
          recipientName: g.recipientName,
          purpose: g.purpose ?? null,
        }))
      );
      donorData.activeRegions = mergeArrays(donorData.activeRegions, grantGeo);
    } catch (err) {
      log(config, `  Grant geography failed for ${name}: ${err}`);
    }
  }

  // Compute giving stats
  computeGivingStats(donorData);

  // Step 6: Validation
  const validation = await validateDonorCandidate(donorData);
  if (!validation.success || !validation.data?.isValid) {
    return { stored: false, error: `Validation failed for ${name}: ${validation.error ?? "not verifiable"}` };
  }

  // Step 7: Store
  try {
    await storeDonorDirect(donorData, validation.data.dataQualityScore);
    log(config, `  ✓ STORED: ${name}`);
    return { stored: true };
  } catch (err) {
    return { stored: false, error: `Storage failed for ${name}: ${err}` };
  }
}

/**
 * Store a donor directly (used by direct-name research).
 * Mirrors the storeDonor() logic in orchestrator.ts.
 */
async function storeDonorDirect(
  candidate: Partial<DonorCandidate>,
  aiQualityScore: number
): Promise<void> {
  const validation = validateDonorCreate(
    {
      name: candidate.name,
      type: candidate.type ?? "FOUNDATION",
      description: candidate.description,
      website: candidate.website,
      websiteVerified: candidate.websiteVerified ?? false,
      websiteSource: candidate.websiteSource,
      email: candidate.contactEmail,
      phone: candidate.contactPhone,
      socialLinks: candidate.socialLinks,
      country: candidate.headquartersCountry ?? candidate.country,
      city: candidate.headquartersCity ?? candidate.city,
      headquartersCountry: candidate.headquartersCountry,
      headquartersCity: candidate.headquartersCity,
      activeRegions: candidate.activeRegions ?? [],
      politicalAffiliation: candidate.politicalAffiliation ?? "UNKNOWN",
      politicalStance: candidate.politicalStance,
      causes: candidate.causes ?? [],
      targetPopulations: candidate.targetPopulations ?? [],
      geographicFocus: candidate.geographicFocus ?? [],
      totalGivingUsd: candidate.totalGivingUsd,
      avgGrantSizeUsd: candidate.avgGrantSizeUsd,
      grantCount: candidate.grants?.length ?? 0,
      givingYearRange: candidate.givingYearRange,
      donorConfidence: candidate.donorConfidence ?? "CONFIRMED",
      dataSources: candidate.dataSources ?? [],
      researchStatus: "COMPLETED",
    },
    { aiQualityScore }
  );

  if (!validation.success) {
    throw new Error(
      `Donor validation failed: ${validation.errors?.map((e) => `${e.path}: ${e.message}`).join(", ")}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donor = await prisma.donor.create({
    data: { ...validation.data, lastResearchedAt: new Date() } as any,
  });

  // Validate and store grants
  const validGrants = (candidate.grants ?? [])
    .map((g) => validateGrant(g))
    .filter((r) => r.success)
    .map((r) => r.data!);

  if (validGrants.length > 0) {
    await prisma.donorGrant.createMany({
      data: validGrants.map((g) => ({
        donorId: donor.id,
        recipientName: g.recipientName,
        recipientEin: g.recipientEin ?? undefined,
        amount: g.amount ?? undefined,
        currency: g.currency,
        year: g.year ?? undefined,
        purpose: g.purpose ?? undefined,
        sourceUrl: g.sourceUrl ?? undefined,
      })),
    });
  }

  // Generate and store embedding
  const embeddingText = [
    donor.name,
    donor.description,
    donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
    donor.geographicFocus.length ? `Geography: ${donor.geographicFocus.join(", ")}` : null,
    donor.activeRegions?.length ? `Active regions: ${donor.activeRegions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const embedding = await generateEmbedding(embeddingText);
  await prisma.$executeRawUnsafe(
    `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
    JSON.stringify(embedding),
    donor.id
  );

  // Generate political embedding if political stance is available
  if (donor.politicalStance) {
    try {
      const polEmb = await generateEmbedding(donor.politicalStance);
      await prisma.$executeRawUnsafe(
        `UPDATE "Donor" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
        JSON.stringify(polEmb),
        donor.id
      );
    } catch (err) {
      console.warn("[marathon-runner] Failed to generate political embedding:", err);
    }
  }
}

// ─── Utility Functions (mirrored from orchestrator) ─────────────

function mergeArrays(existing?: string[], incoming?: string[]): string[] {
  if (!incoming?.length) return existing ?? [];
  if (!existing?.length) return incoming;
  return [...new Set([...existing, ...incoming])];
}

type Grant = DonorCandidate["grants"][number];

function deduplicateGrants(grants: Grant[]): Grant[] {
  const seen = new Set<string>();
  return grants.filter((g) => {
    const key = `${g.recipientName.toLowerCase()}-${g.year ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeGivingStats(donorData: Partial<DonorCandidate>): void {
  const grants = donorData.grants ?? [];
  if (grants.length === 0) return;

  const amounts = grants.map((g) => g.amount).filter((a): a is number => a != null && a > 0);
  if (amounts.length > 0) {
    donorData.totalGivingUsd = donorData.totalGivingUsd ?? amounts.reduce((a, b) => a + b, 0);
    donorData.avgGrantSizeUsd = donorData.avgGrantSizeUsd ?? Math.round(donorData.totalGivingUsd / amounts.length);
  }

  const years = grants.map((g) => g.year).filter((y): y is number => y != null);
  if (years.length > 0) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    donorData.givingYearRange = donorData.givingYearRange ?? (minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`);
  }
}

// ─── Phase Executors ────────────────────────────────────────────

async function executePhase1(
  config: MarathonConfig,
  checkpoint: MarathonCheckpoint,
  dedupChecker: DedupChecker
): Promise<PhaseResult> {
  const phase = getPhase(1)!;
  const start = Date.now();

  log(config, `\n${"═".repeat(60)}`);
  log(config, `PHASE 1: ${phase.name}`);
  log(config, `${"═".repeat(60)}`);

  if (config.dryRun) {
    log(config, `[DRY RUN] Would run IRS 990 import across all sectors (maxPages: ${config.irs990?.maxPagesPerKeyword ?? 4})`);
    return { phase: 1, name: phase.name, stored: 0, discovered: 0, errors: 0, skippedDuplicates: 0, durationMs: 0, targetResults: [] };
  }

  let stored = 0;
  let discovered = 0;
  let errors = 0;

  try {
    log(config, `Starting IRS 990 import (maxPagesPerKeyword: ${config.irs990?.maxPagesPerKeyword ?? 4})...`);

    const result = await importAllSectors({
      maxPagesPerKeyword: config.irs990?.maxPagesPerKeyword ?? 4,
      onProgress: (msg) => log(config, `[irs990] ${msg}`),
    });

    stored = result.imported;
    discovered = result.searched;
    errors = Array.isArray(result.errors) ? result.errors.length : Number(result.errors) || 0;

    log(config, `Phase 1 complete: ${stored} imported, ${discovered} searched, ${result.duplicates} duplicates, ${errors} errors`);
  } catch (err) {
    log(config, `Phase 1 FAILED: ${err}`);
    errors++;
  }

  const duration = Date.now() - start;
  const target: CompletedTarget = {
    phase: 1,
    targetIndex: 0,
    label: "IRS 990 All Sectors",
    result: { discovered, stored, errors, skippedDuplicates: 0 },
    durationMs: duration,
  };

  checkpoint.targetsCompleted.push(target);
  checkpoint.totalStored += stored;
  checkpoint.totalDiscovered += discovered;
  checkpoint.totalErrors += errors;
  saveCheckpoint(config.checkpointPath, checkpoint);

  return {
    phase: 1,
    name: phase.name,
    stored,
    discovered,
    errors,
    skippedDuplicates: 0,
    durationMs: duration,
    targetResults: [target],
  };
}

async function executeDiscoveryPhase(
  phaseNumber: number,
  config: MarathonConfig,
  checkpoint: MarathonCheckpoint,
  dedupChecker: DedupChecker
): Promise<PhaseResult> {
  const phase = getPhase(phaseNumber)!;
  const start = Date.now();

  log(config, `\n${"═".repeat(60)}`);
  log(config, `PHASE ${phaseNumber}: ${phase.name}`);
  log(config, `${"═".repeat(60)}`);

  let totalStored = 0;
  let totalDiscovered = 0;
  let totalErrors = 0;
  let totalSkippedDups = 0;
  const targetResults: CompletedTarget[] = [];

  // Determine start index (for resume support)
  const startIndex = checkpoint.currentPhase === phaseNumber && checkpoint.currentProng !== "B"
    ? checkpoint.currentTargetIndex
    : 0;

  // Prong A: Cause-based discovery targets
  for (let i = startIndex; i < phase.targets.length; i++) {
    if (shuttingDown) break;

    const target = phase.targets[i];
    const label = `${target.cause}${target.region ? ` (${target.region})` : ""}`;

    checkpoint.currentPhase = phaseNumber;
    checkpoint.currentTargetIndex = i;
    checkpoint.currentProng = "A";

    log(config, `\n[${i + 1}/${phase.targets.length}] ${label}`);

    if (config.dryRun) {
      log(config, `  [DRY RUN] Would discover: ${label}`);
      continue;
    }

    const targetStart = Date.now();
    let stored = 0;
    let discovered = 0;
    let errors = 0;
    let skippedDups = 0;

    try {
      const result = await runDiscoveryPipeline({
        cause: target.cause,
        targetPopulation: target.targetPopulation,
        region: target.region,
        donorTypeHint: target.donorTypeHint,
        shouldSkip: (name) => dedupChecker.shouldSkip(name),
      });

      stored = result.stored;
      discovered = result.discovered;
      errors = result.errors.length;

      log(config, `  Result: ${stored} stored, ${discovered} discovered, ${errors} errors`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(config, `  FAILED: ${msg}`);
      errors = 1;

      // Retry once after 30s
      log(config, `  Retrying in 30s...`);
      await sleep(30000);
      try {
        const result = await runDiscoveryPipeline({
          cause: target.cause,
          targetPopulation: target.targetPopulation,
          region: target.region,
          donorTypeHint: target.donorTypeHint,
          shouldSkip: (name) => dedupChecker.shouldSkip(name),
        });
        stored = result.stored;
        discovered = result.discovered;
        errors = result.errors.length;
        log(config, `  Retry success: ${stored} stored`);
      } catch (retryErr) {
        log(config, `  Retry also failed: ${retryErr}`);
      }
    }

    const ct: CompletedTarget = {
      phase: phaseNumber,
      targetIndex: i,
      prong: "A",
      label,
      result: { discovered, stored, errors, skippedDuplicates: skippedDups },
      durationMs: Date.now() - targetStart,
    };
    targetResults.push(ct);
    checkpoint.targetsCompleted.push(ct);
    totalStored += stored;
    totalDiscovered += discovered;
    totalErrors += errors;
    totalSkippedDups += skippedDups;

    checkpoint.totalStored += stored;
    checkpoint.totalDiscovered += discovered;
    checkpoint.totalErrors += errors;
    saveCheckpoint(config.checkpointPath, checkpoint);
    updateProgress(config, checkpoint, phaseNumber, phase.name, i + 1, phase.targets.length, label);

    // Delay between targets
    if (i < phase.targets.length - 1 && !shuttingDown) {
      await sleep(phase.delayBetweenMs);
    }
  }

  // Prong B: Direct-name research (Phase 2 only)
  if (phase.directNames?.length && !shuttingDown) {
    log(config, `\n--- Prong B: Direct-name research (${phase.directNames.length} names) ---`);

    const directStartIndex =
      checkpoint.currentPhase === phaseNumber && checkpoint.currentProng === "B"
        ? checkpoint.currentTargetIndex
        : 0;

    for (let i = directStartIndex; i < phase.directNames.length; i++) {
      if (shuttingDown) break;

      const nameTarget = phase.directNames[i];
      checkpoint.currentPhase = phaseNumber;
      checkpoint.currentTargetIndex = i;
      checkpoint.currentProng = "B";

      log(config, `\n[Direct ${i + 1}/${phase.directNames.length}] ${nameTarget.name}`);

      if (config.dryRun) {
        log(config, `  [DRY RUN] Would research: ${nameTarget.name}`);
        continue;
      }

      const targetStart = Date.now();

      try {
        const result = await researchAndStoreDonor(nameTarget, dedupChecker, config);

        const ct: CompletedTarget = {
          phase: phaseNumber,
          targetIndex: i,
          prong: "B",
          label: nameTarget.name,
          result: {
            discovered: 1,
            stored: result.stored ? 1 : 0,
            errors: result.error ? 1 : 0,
            skippedDuplicates: result.stored ? 0 : (result.error ? 0 : 1),
          },
          durationMs: Date.now() - targetStart,
        };
        targetResults.push(ct);
        checkpoint.targetsCompleted.push(ct);

        if (result.stored) totalStored++;
        totalDiscovered++;
        if (result.error) {
          totalErrors++;
          log(config, `  Error: ${result.error}`);
        }

        checkpoint.totalStored += result.stored ? 1 : 0;
        checkpoint.totalDiscovered += 1;
        checkpoint.totalErrors += result.error ? 1 : 0;
      } catch (err) {
        log(config, `  FAILED: ${err}`);
        totalErrors++;
        checkpoint.totalErrors++;
      }

      saveCheckpoint(config.checkpointPath, checkpoint);
      updateProgress(config, checkpoint, phaseNumber, phase.name, i + 1, phase.directNames.length, nameTarget.name);

      if (i < phase.directNames.length - 1 && !shuttingDown) {
        await sleep(phase.delayBetweenMs);
      }
    }
  }

  return {
    phase: phaseNumber,
    name: phase.name,
    stored: totalStored,
    discovered: totalDiscovered,
    errors: totalErrors,
    skippedDuplicates: totalSkippedDups,
    durationMs: Date.now() - start,
    targetResults,
  };
}

async function executePhase5(
  config: MarathonConfig,
  checkpoint: MarathonCheckpoint,
  dedupChecker: DedupChecker
): Promise<PhaseResult> {
  const phase = getPhase(5)!;
  const start = Date.now();

  log(config, `\n${"═".repeat(60)}`);
  log(config, `PHASE 5: ${phase.name}`);
  log(config, `${"═".repeat(60)}`);

  const maxDonors = config.enrichment?.maxDonors ?? 75;
  const minQuality = config.enrichment?.minQualityThreshold ?? 0.4;

  // Find donors that need enrichment
  const donors = await prisma.donor.findMany({
    where: { dataQualityScore: { lt: minQuality } },
    orderBy: { dataQualityScore: "asc" },
    take: maxDonors,
    select: { id: true, name: true, dataQualityScore: true },
  });

  log(config, `Found ${donors.length} donors with quality < ${minQuality} for enrichment`);

  if (config.dryRun) {
    for (const d of donors) {
      log(config, `  [DRY RUN] Would enrich: ${d.name} (score: ${d.dataQualityScore.toFixed(2)})`);
    }
    return { phase: 5, name: phase.name, stored: 0, discovered: 0, errors: 0, skippedDuplicates: 0, durationMs: 0, targetResults: [] };
  }

  const startIndex =
    checkpoint.currentPhase === 5 ? checkpoint.currentTargetIndex : 0;

  let enriched = 0;
  let errors = 0;
  const targetResults: CompletedTarget[] = [];

  for (let i = startIndex; i < donors.length; i++) {
    if (shuttingDown) break;

    const donor = donors[i];
    checkpoint.currentPhase = 5;
    checkpoint.currentTargetIndex = i;

    log(config, `\n[Enrich ${i + 1}/${donors.length}] ${donor.name} (score: ${donor.dataQualityScore.toFixed(2)})`);

    const targetStart = Date.now();

    try {
      const result = await runEnrichmentPipeline(donor.id);

      if (result.success) {
        enriched++;
        log(config, `  ✓ Enriched: ${donor.name}`);
      } else {
        errors++;
        log(config, `  ✗ Failed: ${result.error}`);
      }

      const ct: CompletedTarget = {
        phase: 5,
        targetIndex: i,
        label: donor.name,
        result: {
          discovered: 0,
          stored: result.success ? 1 : 0,
          errors: result.success ? 0 : 1,
          skippedDuplicates: 0,
        },
        durationMs: Date.now() - targetStart,
      };
      targetResults.push(ct);
      checkpoint.targetsCompleted.push(ct);
    } catch (err) {
      log(config, `  FAILED: ${err}`);
      errors++;
    }

    checkpoint.totalErrors += errors > 0 ? 1 : 0;
    saveCheckpoint(config.checkpointPath, checkpoint);
    updateProgress(config, checkpoint, 5, phase.name, i + 1, donors.length, donor.name);

    if (i < donors.length - 1 && !shuttingDown) {
      await sleep(phase.delayBetweenMs);
    }
  }

  return {
    phase: 5,
    name: phase.name,
    stored: enriched,
    discovered: 0,
    errors,
    skippedDuplicates: 0,
    durationMs: Date.now() - start,
    targetResults,
  };
}

// ─── Progress Reporting ─────────────────────────────────────────

function updateProgress(
  config: MarathonConfig,
  checkpoint: MarathonCheckpoint,
  currentPhase: number,
  phaseName: string,
  currentTarget: number,
  totalTargets: number,
  targetLabel: string
): void {
  const elapsed = Date.now() - new Date(checkpoint.startedAt).getTime();
  const phasesTotal = config.phases.length;
  const phasesCompleted = config.phases.filter(
    (p) => p < currentPhase || (p === currentPhase && currentTarget >= totalTargets)
  ).length;

  // Rough estimation based on progress
  const overallProgress = phasesCompleted / phasesTotal + (currentTarget / totalTargets) / phasesTotal;
  const estimatedTotal = overallProgress > 0 ? elapsed / overallProgress : 0;
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

  const progress: MarathonProgress = {
    runId: checkpoint.runId,
    status: checkpoint.status,
    phase: { current: currentPhase, total: phasesTotal, name: phaseName },
    target: { current: currentTarget, total: totalTargets, label: targetLabel },
    stats: {
      totalStored: checkpoint.totalStored,
      totalDiscovered: checkpoint.totalDiscovered,
      totalErrors: checkpoint.totalErrors,
      totalSkippedDuplicates: 0,
      dbDonorCount: 0, // Will be filled lazily
      elapsedMs: elapsed,
      estimatedRemainingMs: estimatedRemaining,
    },
    recentActivity: activityLog.slice(-20),
  };

  saveProgress(config.progressPath, progress);
}

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Run the full marathon discovery process.
 * This is the main function — called by the CLI script or admin API.
 */
export async function runMarathonDiscovery(
  config: MarathonConfig
): Promise<MarathonResult> {
  const startTime = Date.now();

  // ─── Graceful shutdown ─────
  const onShutdown = () => {
    if (shuttingDown) {
      log(config, "Force shutdown — exiting immediately");
      process.exit(1);
    }
    shuttingDown = true;
    log(config, "\n⚠ Shutdown signal received — saving checkpoint and exiting after current target...");
  };
  process.on("SIGINT", onShutdown);
  process.on("SIGTERM", onShutdown);

  // ─── Initialize ─────
  log(config, "═══════════════════════════════════════════════════════════════");
  log(config, "             MARATHON DISCOVERY — Starting");
  log(config, "═══════════════════════════════════════════════════════════════");

  // Load dedup checker
  log(config, "Loading dedup checker...");
  const dedupChecker = new DedupChecker();
  await dedupChecker.loadSnapshot();
  log(config, `Loaded ${dedupChecker.donorCount} existing donors into dedup checker`);

  // Load or create checkpoint
  let checkpoint: MarathonCheckpoint;
  if (config.resume) {
    const existing = loadCheckpoint(config.checkpointPath);
    if (existing && (existing.status === "running" || existing.status === "interrupted")) {
      checkpoint = existing;
      checkpoint.status = "running";
      log(config, `Resuming run ${checkpoint.runId} from phase ${checkpoint.currentPhase}, target ${checkpoint.currentTargetIndex}`);
    } else {
      log(config, "No resumable checkpoint found — starting fresh");
      checkpoint = createFreshCheckpoint();
    }
  } else {
    checkpoint = createFreshCheckpoint();
  }

  saveCheckpoint(config.checkpointPath, checkpoint);

  // ─── Print overview ─────
  log(config, `\nPhases to run: ${config.phases.join(", ")}`);
  for (const phaseNum of config.phases) {
    const phase = getPhase(phaseNum);
    if (!phase) continue;
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    log(config, `  Phase ${phaseNum}: ${phase.name} (${targetCount} targets, ~${phase.expectedYield} expected)`);
  }
  log(config, "");

  // ─── Execute phases ─────
  const phaseResults: PhaseResult[] = [];

  for (const phaseNum of config.phases) {
    if (shuttingDown) break;

    // Skip phases already fully completed (when resuming)
    if (config.resume && isPhaseComplete(checkpoint, phaseNum)) {
      log(config, `Phase ${phaseNum} already completed — skipping`);
      continue;
    }

    let result: PhaseResult;

    const phaseConfig = getPhase(phaseNum);
    if (!phaseConfig) {
      log(config, `Unknown phase ${phaseNum} — skipping`);
      continue;
    }

    switch (phaseConfig.strategy) {
      case "irs990":
        result = await executePhase1(config, checkpoint, dedupChecker);
        break;
      case "discovery":
      case "two-prong":
      case "direct-name":
        result = await executeDiscoveryPhase(phaseNum, config, checkpoint, dedupChecker);
        break;
      case "enrichment":
        result = await executePhase5(config, checkpoint, dedupChecker);
        break;
      default:
        log(config, `Unknown strategy "${phaseConfig.strategy}" for phase ${phaseNum} — skipping`);
        continue;
    }

    phaseResults.push(result);

    // Refresh dedup snapshot after each phase (new donors were added)
    if (!config.dryRun) {
      log(config, "\nRefreshing dedup checker...");
      await dedupChecker.refreshSnapshot();
      log(config, `Dedup checker now has ${dedupChecker.donorCount} donors`);
    }
  }

  // ─── Finalize ─────
  checkpoint.status = shuttingDown ? "interrupted" : "completed";
  saveCheckpoint(config.checkpointPath, checkpoint);

  const totalDuration = Date.now() - startTime;
  const finalCount = await prisma.donor.count();

  log(config, `\n${"═".repeat(60)}`);
  log(config, `MARATHON ${shuttingDown ? "INTERRUPTED" : "COMPLETE"}`);
  log(config, `${"═".repeat(60)}`);
  log(config, `Duration: ${formatDuration(totalDuration)}`);
  log(config, `Total stored: ${checkpoint.totalStored}`);
  log(config, `Total discovered: ${checkpoint.totalDiscovered}`);
  log(config, `Total errors: ${checkpoint.totalErrors}`);
  log(config, `DB donor count: ${finalCount}`);
  log(config, `${"═".repeat(60)}`);

  // Cleanup listeners
  process.removeListener("SIGINT", onShutdown);
  process.removeListener("SIGTERM", onShutdown);

  return {
    runId: checkpoint.runId,
    totalStored: checkpoint.totalStored,
    totalDiscovered: checkpoint.totalDiscovered,
    totalErrors: checkpoint.totalErrors,
    totalSkippedDuplicates: 0,
    durationMs: totalDuration,
    phaseResults,
    finalDbDonorCount: finalCount,
  };
}

function createFreshCheckpoint(): MarathonCheckpoint {
  return {
    runId: uuid(),
    startedAt: timestamp(),
    lastUpdatedAt: timestamp(),
    currentPhase: 1,
    currentTargetIndex: 0,
    targetsCompleted: [],
    totalStored: 0,
    totalDiscovered: 0,
    totalErrors: 0,
    status: "running",
  };
}

function isPhaseComplete(checkpoint: MarathonCheckpoint, phaseNum: number): boolean {
  // A phase is complete if we have any targets from a LATER phase in the completed list
  return checkpoint.targetsCompleted.some((t) => t.phase > phaseNum);
}
