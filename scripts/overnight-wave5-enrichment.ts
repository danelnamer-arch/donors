/**
 * Overnight Wave 5 — Deep Enrichment + Website Re-verification
 *
 * Standalone script that runs post-discovery quality improvement:
 *   Phase 26: Deep Enrichment Pass — enrich donors with quality < 0.5
 *   Phase 27: Website Re-verification — verify unverified donor websites
 *
 * This is the final wave of the overnight pipeline. It doesn't discover
 * new donors but upgrades existing ones for better matching quality.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts
 *   npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts --resume
 *   npx tsx --env-file=.env scripts/overnight-wave5-enrichment.ts --dry-run
 *
 * Expected yield: 0 new donors, ~200 quality uplifts + ~300 website verifications
 * Runtime: ~2 hours
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import * as fs from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";
import { prisma } from "@/lib/prisma";
import { runEnrichmentPipeline } from "@/lib/agents/orchestrator";
import { findAndVerifyWebsite } from "@/lib/agents/website-verifier";

// ─── Parse CLI arguments ────────────────────────────────────────

const args = process.argv.slice(2);
const resume = args.includes("--resume");
const dryRun = args.includes("--dry-run");

// ─── Validate environment ───────────────────────────────────────

const requiredEnvVars = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "TAVILY_API_KEY",
];

function validateEnv(): void {
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`\nMissing required environment variables: ${missing.join(", ")}`);
    console.error("Make sure you have a .env file or pass --env-file=.env\n");
    process.exit(1);
  }
}

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

interface Wave5Checkpoint {
  runId: string;
  startedAt: string;
  lastUpdatedAt: string;
  /** "phase26" or "phase27" */
  currentPhase: "phase26" | "phase27";
  /** Index within current phase */
  currentIndex: number;
  /** Phase 26 stats */
  phase26: { enriched: number; errors: number; total: number };
  /** Phase 27 stats */
  phase27: { verified: number; alreadyVerified: number; failed: number; total: number };
  status: "running" | "completed" | "interrupted";
}

function loadCheckpoint(filepath: string): Wave5Checkpoint | null {
  try {
    if (!fs.existsSync(filepath)) return null;
    const raw = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as Wave5Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(filepath: string, cp: Wave5Checkpoint): void {
  cp.lastUpdatedAt = timestamp();
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(cp, null, 2));
}

// ─── Graceful shutdown ──────────────────────────────────────────

let shuttingDown = false;

// ─── Phase 26: Deep Enrichment Pass ─────────────────────────────

async function runPhase26(
  cp: Wave5Checkpoint,
  cpPath: string
): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log("PHASE 26: Deep Enrichment Pass");
  console.log(`${"═".repeat(60)}\n`);

  const maxDonors = 200;
  const minQuality = 0.5;

  const donors = await prisma.donor.findMany({
    where: {
      dataQualityScore: { lt: minQuality },
      researchStatus: { not: "COMPLETED" },
    },
    orderBy: { dataQualityScore: "asc" },
    take: maxDonors,
    select: { id: true, name: true, dataQualityScore: true },
  });

  cp.phase26.total = donors.length;
  console.log(`Found ${donors.length} donors with quality < ${minQuality} for enrichment`);

  if (dryRun) {
    for (const d of donors) {
      console.log(`  [DRY RUN] Would enrich: ${d.name} (score: ${d.dataQualityScore.toFixed(2)})`);
    }
    return;
  }

  const startIndex = cp.currentPhase === "phase26" ? cp.currentIndex : 0;

  for (let i = startIndex; i < donors.length; i++) {
    if (shuttingDown) break;

    const donor = donors[i];
    cp.currentPhase = "phase26";
    cp.currentIndex = i;

    console.log(`\n[Enrich ${i + 1}/${donors.length}] ${donor.name} (score: ${donor.dataQualityScore.toFixed(2)})`);

    try {
      const result = await runEnrichmentPipeline(donor.id);

      if (result.success) {
        cp.phase26.enriched++;
        console.log(`  ✓ Enriched: ${donor.name}`);
      } else {
        cp.phase26.errors++;
        console.log(`  ✗ Failed: ${result.error}`);
      }
    } catch (err) {
      console.log(`  FAILED: ${err}`);
      cp.phase26.errors++;
    }

    saveCheckpoint(cpPath, cp);

    if (i < donors.length - 1 && !shuttingDown) {
      await sleep(15000); // 15s between enrichments
    }
  }

  console.log(`\nPhase 26 complete: ${cp.phase26.enriched} enriched, ${cp.phase26.errors} errors`);
}

// ─── Phase 27: Website Re-verification ──────────────────────────

async function runPhase27(
  cp: Wave5Checkpoint,
  cpPath: string
): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log("PHASE 27: Website Re-verification");
  console.log(`${"═".repeat(60)}\n`);

  const maxDonors = 300;

  const donors = await prisma.donor.findMany({
    where: {
      websiteVerified: false,
      website: { not: null },
    },
    take: maxDonors,
    select: { id: true, name: true, website: true, ein: true },
  });

  cp.phase27.total = donors.length;
  console.log(`Found ${donors.length} donors with unverified websites`);

  if (dryRun) {
    for (const d of donors) {
      console.log(`  [DRY RUN] Would verify: ${d.name} → ${d.website}`);
    }
    return;
  }

  const startIndex =
    cp.currentPhase === "phase27" ? cp.currentIndex : 0;

  for (let i = startIndex; i < donors.length; i++) {
    if (shuttingDown) break;

    const donor = donors[i];
    cp.currentPhase = "phase27";
    cp.currentIndex = i;

    console.log(`\n[Verify ${i + 1}/${donors.length}] ${donor.name} → ${donor.website}`);

    try {
      const result = await findAndVerifyWebsite(donor.name, {
        claimedUrl: donor.website,
        ein: donor.ein,
      });

      if (result.verified) {
        await prisma.donor.update({
          where: { id: donor.id },
          data: {
            website: result.url || donor.website,
            websiteVerified: true,
          },
        });
        cp.phase27.verified++;
        console.log(`  ✓ Verified: ${result.url || donor.website} (${result.source}, confidence: ${result.confidence})`);
      } else {
        cp.phase27.failed++;
        console.log(`  ✗ Not verified: ${result.reason}`);
      }
    } catch (err) {
      console.log(`  FAILED: ${err}`);
      cp.phase27.failed++;
    }

    saveCheckpoint(cpPath, cp);

    if (i < donors.length - 1 && !shuttingDown) {
      await sleep(5000); // 5s between verifications
    }
  }

  console.log(`\nPhase 27 complete: ${cp.phase27.verified} verified, ${cp.phase27.failed} failed`);
}

// ─── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const scriptDir = path.resolve(__dirname);
  const cpPath = path.join(scriptDir, ".wave5-enrichment-checkpoint.json");

  // Graceful shutdown
  const onShutdown = () => {
    if (shuttingDown) {
      console.log("Force shutdown — exiting immediately");
      process.exit(1);
    }
    shuttingDown = true;
    console.log("\n⚠ Shutdown signal received — saving checkpoint and exiting after current target...");
  };
  process.on("SIGINT", onShutdown);
  process.on("SIGTERM", onShutdown);

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║     FUNDERRA — WAVE 5: ENRICHMENT & VERIFICATION       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // Load or create checkpoint
  let cp: Wave5Checkpoint;
  if (resume) {
    const existing = loadCheckpoint(cpPath);
    if (existing && (existing.status === "running" || existing.status === "interrupted")) {
      cp = existing;
      cp.status = "running";
      console.log(`Resuming run ${cp.runId} from ${cp.currentPhase}, index ${cp.currentIndex}`);
    } else {
      console.log("No resumable checkpoint found — starting fresh");
      cp = {
        runId: uuid(),
        startedAt: timestamp(),
        lastUpdatedAt: timestamp(),
        currentPhase: "phase26",
        currentIndex: 0,
        phase26: { enriched: 0, errors: 0, total: 0 },
        phase27: { verified: 0, alreadyVerified: 0, failed: 0, total: 0 },
        status: "running",
      };
    }
  } else {
    cp = {
      runId: uuid(),
      startedAt: timestamp(),
      lastUpdatedAt: timestamp(),
      currentPhase: "phase26",
      currentIndex: 0,
      phase26: { enriched: 0, errors: 0, total: 0 },
      phase27: { verified: 0, alreadyVerified: 0, failed: 0, total: 0 },
      status: "running",
    };
  }

  console.log(`Mode:     ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Run ID:   ${cp.runId}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const startTime = Date.now();

  // Phase 26: Deep Enrichment
  if (!shuttingDown && (cp.currentPhase === "phase26" || !resume)) {
    await runPhase26(cp, cpPath);
  }

  // Phase 27: Website Re-verification
  if (!shuttingDown) {
    if (cp.currentPhase === "phase26") {
      // Move to phase 27
      cp.currentPhase = "phase27";
      cp.currentIndex = 0;
    }
    await runPhase27(cp, cpPath);
  }

  // Finalize
  cp.status = shuttingDown ? "interrupted" : "completed";
  saveCheckpoint(cpPath, cp);

  const totalDuration = Date.now() - startTime;
  const finalCount = await prisma.donor.count();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║           WAVE 5 ENRICHMENT COMPLETE                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  console.log(`Run ID:        ${cp.runId}`);
  console.log(`Duration:      ${formatDuration(totalDuration)}`);
  console.log(`Phase 26:      ${cp.phase26.enriched} enriched, ${cp.phase26.errors} errors (of ${cp.phase26.total})`);
  console.log(`Phase 27:      ${cp.phase27.verified} verified, ${cp.phase27.failed} failed (of ${cp.phase27.total})`);
  console.log(`DB donors:     ${finalCount}`);
  console.log("");

  // Cleanup listeners
  process.removeListener("SIGINT", onShutdown);
  process.removeListener("SIGTERM", onShutdown);

  process.exit(0);
}

main().catch((err) => {
  console.error("\nWave 5 enrichment failed with fatal error:", err);
  process.exit(1);
});
