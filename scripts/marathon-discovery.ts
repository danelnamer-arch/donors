/**
 * Marathon Discovery CLI Script
 *
 * Populates the donor database to ~500 entries over ~5-7 hours.
 * Supports checkpoint/resume if interrupted.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/marathon-discovery.ts           # Full run
 *   npx tsx --env-file=.env scripts/marathon-discovery.ts --resume   # Resume
 *   npx tsx --env-file=.env scripts/marathon-discovery.ts --dry-run  # Preview
 *   npx tsx --env-file=.env scripts/marathon-discovery.ts --phase=2  # Single phase
 *
 * Or via npm scripts:
 *   npm run marathon
 *   npm run marathon:resume
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import * as path from "path";
import { runMarathonDiscovery } from "@/lib/agents/marathon-runner";
import { MARATHON_PHASES, getTotalTargetCount, getTotalExpectedYield } from "@/lib/agents/marathon-targets";

// ─── Parse CLI arguments ────────────────────────────────────────

const args = process.argv.slice(2);
const resume = args.includes("--resume");
const dryRun = args.includes("--dry-run");
const phaseArg = args.find((a) => a.startsWith("--phase="));
const phaseOnly = phaseArg ? parseInt(phaseArg.split("=")[1], 10) : null;

// ─── Validate environment ───────────────────────────────────────

const requiredEnvVars = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "TAVILY_API_KEY",
];

const optionalEnvVars = [
  "FIRECRAWL_API_KEY",
  "GEMINI_API_KEY",
];

function validateEnv(): void {
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`\nMissing required environment variables: ${missing.join(", ")}`);
    console.error("Make sure you have a .env file or pass --env-file=.env\n");
    process.exit(1);
  }

  const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn(`\nWarning: Optional env vars not set: ${missingOptional.join(", ")}`);
    console.warn("Some features (website crawling, Gemini extraction) will be limited.\n");
  }
}

// ─── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const phases = phaseOnly ? [phaseOnly] : [1, 2, 3, 4, 5];
  const scriptDir = path.resolve(__dirname);

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║              FUNDERRA — MARATHON DISCOVERY              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:     ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Phases:   ${phaseOnly ? `Phase ${phaseOnly} only` : "All (1-5)"}`);
  console.log(`Targets:  ${getTotalTargetCount()} total across ${MARATHON_PHASES.length} phases`);
  console.log(`Expected: ~${getTotalExpectedYield()} new donors`);
  console.log(`\nPhase breakdown:`);

  for (const phase of MARATHON_PHASES) {
    if (phaseOnly && phase.number !== phaseOnly) continue;
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    console.log(`  ${phase.number}. ${phase.name}`);
    console.log(`     ${targetCount} targets, ~${phase.expectedYield} expected yield, ${phase.delayBetweenMs / 1000}s delay`);
  }

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".marathon-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".marathon-progress.json")}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases,
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".marathon-checkpoint.json"),
    progressPath: path.join(scriptDir, ".marathon-progress.json"),
    onProgress: (msg) => console.log(msg),
    irs990: {
      maxPagesPerKeyword: 4,
    },
    enrichment: {
      maxDonors: 300,
      minQualityThreshold: 0.4,
    },
  });

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    MARATHON COMPLETE                      ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  console.log(`Run ID:        ${result.runId}`);
  console.log(`Duration:      ${Math.round(result.durationMs / 60000)} minutes`);
  console.log(`Total stored:  ${result.totalStored}`);
  console.log(`Total found:   ${result.totalDiscovered}`);
  console.log(`Total errors:  ${result.totalErrors}`);
  console.log(`DB donors:     ${result.finalDbDonorCount}`);
  console.log("");

  for (const pr of result.phaseResults) {
    console.log(`  Phase ${pr.phase} (${pr.name}): ${pr.stored} stored, ${pr.errors} errors, ${Math.round(pr.durationMs / 60000)}m`);
  }

  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nMarathon failed with fatal error:", err);
  process.exit(1);
});
