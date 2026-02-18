/**
 * Israeli Tech & Political Donor Discovery — Phases 28-31
 *
 * Standalone script focused on finding ~50 Israeli tech/political donors:
 *   Phase 28: AI/Deep-Tech + Fintech Founders (17 direct names + 6 cause targets)
 *   Phase 29: Cybersecurity Wave 2 + Post-Oct-7 Donors (12 direct names + 6 cause targets)
 *   Phase 30: Politically Vocal Tech Leaders (8 cause targets, discovery-only)
 *   Phase 31: Enrichment Pass — enrich all newly found individuals with quality < 0.5
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/israeli-tech-political-donors.ts
 *   npx tsx --env-file=.env scripts/israeli-tech-political-donors.ts --resume
 *   npx tsx --env-file=.env scripts/israeli-tech-political-donors.ts --dry-run
 *
 * Expected yield: ~30-50 new individual donors
 * Runtime: ~3-5 hours
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import * as path from "path";
import { runMarathonDiscovery } from "@/lib/agents/marathon-runner";
import type { MarathonPhase, DirectNameTarget } from "@/lib/agents/marathon-types";
import type { DiscoveryTarget } from "@/lib/agents/batch-discovery";

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

// ═══════════════════════════════════════════════════════════════
// PHASE 28: AI/Deep-Tech + Fintech Founders
// ═══════════════════════════════════════════════════════════════

const PHASE_28_DIRECT_NAMES: DirectNameTarget[] = [
  // AI/Deep-Tech Founders
  { name: "Ori Goshen", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yoav Shoham", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Noam Shazeer", type: "INDIVIDUAL", country: "United States", defaultConfidence: "SUSPECTED" },
  { name: "Barak Schiller", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Amir Konigsberg", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Daniel Reisner", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Dedi Gilad", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Adi Pinhas", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  // Fintech / E-commerce Founders
  { name: "Micha Kaufman", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Shai Wininger", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yuval Tal", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Arik Shtilman", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Nir Debbi", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Shahar Waiser", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Oded Zehavi", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Eilon Reshef", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Alon Cohen", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
];

const PHASE_28_CAUSES: DiscoveryTarget[] = [
  { cause: "Israeli AI founders philanthropy AI21 Labs Mobileye deep learning startups donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli fintech founders philanthropy Payoneer Rapyd payments startups charitable giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli e-commerce founders philanthropy Global-e Fiverr marketplace startups donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "autonomous driving founders philanthropy Mobileye Brodmann17 self-driving Israeli startups", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "computer science professors philanthropy Stanford Hebrew University Technion Israeli academics", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli-born Silicon Valley AI founders philanthropy tech leaders personal giving", region: "United States", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 29: Cybersecurity Wave 2 + Post-Oct-7 Donors
// ═══════════════════════════════════════════════════════════════

const PHASE_29_DIRECT_NAMES: DirectNameTarget[] = [
  { name: "Udi Mokady", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Mickey Boodaei", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Shlomi Ben Haim", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Amit Yoran", type: "INDIVIDUAL", country: "United States", defaultConfidence: "SUSPECTED" },
  { name: "Dorit Dor", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Amos Genish", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Kobi Samboursky", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Liran Grinberg", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yoav Tzruya", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Dror Davidoff", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Assaf Hefetz", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Erez Kreiner", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
];

const PHASE_29_CAUSES: DiscoveryTarget[] = [
  { cause: "cybersecurity founders CyberArk JFrog Imperva Israeli philanthropy wave 2 donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech community October 7 donations emergency philanthropic response", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli startup founders emergency fund October 7 war relief tech donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "post-October 7 resilience giving Israeli tech entrepreneurs rebuilding communities", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Transmit Security Imperva founders philanthropy Mickey Boodaei cyber Israel", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Tenable CEO Amit Yoran Israeli-American cybersecurity philanthropy national security", region: "United States", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 30: Politically Vocal Tech Leaders (discovery-only)
// ═══════════════════════════════════════════════════════════════

const PHASE_30_CAUSES: DiscoveryTarget[] = [
  { cause: "Israeli tech leaders political activism public statements philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech founders democracy protests judicial reform philanthropy political donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech founders right-wing settlement support philanthropy national religious", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech founders left-wing peace NGO support philanthropy two-state", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech leaders social media political advocacy philanthropy causes", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli startup nation political engagement founders donors exposed", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tech leaders Knesset political donations exposed philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli business leaders political party funding media investigation philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS (phases 28-31)
// ═══════════════════════════════════════════════════════════════

import { MARATHON_PHASES } from "@/lib/agents/marathon-targets";

const TECH_POLITICAL_PHASES: MarathonPhase[] = [
  {
    number: 28,
    name: "AI/Deep-Tech + Fintech Founders",
    targets: PHASE_28_CAUSES,
    directNames: PHASE_28_DIRECT_NAMES,
    delayBetweenMs: 12000,
    expectedYield: 15,
    strategy: "two-prong",
  },
  {
    number: 29,
    name: "Cybersecurity Wave 2 + Post-Oct-7 Donors",
    targets: PHASE_29_CAUSES,
    directNames: PHASE_29_DIRECT_NAMES,
    delayBetweenMs: 12000,
    expectedYield: 12,
    strategy: "two-prong",
  },
  {
    number: 30,
    name: "Politically Vocal Tech Leaders",
    targets: PHASE_30_CAUSES,
    delayBetweenMs: 15000,
    expectedYield: 15,
    strategy: "discovery",
  },
  {
    number: 31,
    name: "Enrichment: New Tech/Political Individuals",
    targets: [],
    delayBetweenMs: 15000,
    expectedYield: 0,
    strategy: "enrichment",
  },
];

// Push phases into shared array so getPhase() can find them
for (const phase of TECH_POLITICAL_PHASES) {
  if (!MARATHON_PHASES.find((p) => p.number === phase.number)) {
    MARATHON_PHASES.push(phase);
  }
}

// ─── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const scriptDir = path.resolve(__dirname);

  const totalTargets = TECH_POLITICAL_PHASES.reduce(
    (sum, p) => sum + p.targets.length + (p.directNames?.length ?? 0),
    0
  );
  const totalExpected = TECH_POLITICAL_PHASES.reduce((sum, p) => sum + p.expectedYield, 0);

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║     FUNDERRA — ISRAELI TECH & POLITICAL DONORS          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:     ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Provider: ${process.env.EXTRACTION_PROVIDER ?? "openai"} (EXTRACTION_PROVIDER)`);
  console.log(`Targets:  ${totalTargets} total across ${TECH_POLITICAL_PHASES.length} phases`);
  console.log(`Expected: ~${totalExpected} new individual donors`);
  console.log(`\nPhase breakdown:`);

  for (const phase of TECH_POLITICAL_PHASES) {
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    console.log(`  ${phase.number}. ${phase.name}`);
    console.log(`     ${targetCount} targets, ~${phase.expectedYield} expected yield, ${phase.delayBetweenMs / 1000}s delay`);
  }

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".tech-political-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".tech-political-progress.json")}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases: TECH_POLITICAL_PHASES.map((p) => p.number),
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".tech-political-checkpoint.json"),
    progressPath: path.join(scriptDir, ".tech-political-progress.json"),
    onProgress: (msg) => console.log(msg),
    enrichment: {
      maxDonors: 100,
      minQualityThreshold: 0.5,
    },
  });

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║       TECH & POLITICAL DONOR DISCOVERY COMPLETE          ║");
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
  console.error("\nTech/political donor discovery failed with fatal error:", err);
  process.exit(1);
});
