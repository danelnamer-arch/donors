/**
 * Israeli Data Source Expansion — GuideStar IL, Reverse Donor Discovery & Media Mining
 *
 * Standalone script that runs new Israeli-specific discovery phases:
 *
 * Phase 15: GuideStar Israel Org Database Building
 * Phase 16: Reverse Donor Discovery (Who funds our peers?)
 * Phase 17: Israeli Government & Public Grant Sources
 * Phase 18: Israeli Corporate CSR
 * Phase 19: Israeli Media & News Mining for Donor Clues
 * Phase 20: American Friends Of Mining
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/israeli-data-expansion.ts
 *   npx tsx --env-file=.env scripts/israeli-data-expansion.ts --resume
 *   npx tsx --env-file=.env scripts/israeli-data-expansion.ts --dry-run
 *   npx tsx --env-file=.env scripts/israeli-data-expansion.ts --phase 15
 *
 * Expected yield: ~250-400 new donors + 100-200 orgs stored
 * Runtime: ~5-7 hours
 * Estimated API cost: ~$20-40 (Firecrawl + Perplexity + Gemini + OpenAI)
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import * as path from "path";
import { runMarathonDiscovery } from "@/lib/agents/marathon-runner";
import { MARATHON_PHASES } from "@/lib/agents/marathon-targets";
import type { MarathonPhase, DirectNameTarget } from "@/lib/agents/marathon-types";
import type { DiscoveryTarget } from "@/lib/agents/batch-discovery";
import { prisma } from "@/lib/prisma";

// ─── Parse CLI arguments ─────────────────────────────────────

const args = process.argv.slice(2);
const resume = args.includes("--resume");
const dryRun = args.includes("--dry-run");
const phaseIdx = args.indexOf("--phase");
const singlePhase = phaseIdx >= 0 ? parseInt(args[phaseIdx + 1], 10) : 0;

// ─── Validate environment ────────────────────────────────────

const requiredEnvVars = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
];

function validateEnv(): void {
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`\nMissing required environment variables: ${missing.join(", ")}`);
    console.error("Make sure you have a .env file or pass --env-file=.env\n");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn("\nWarning: GEMINI_API_KEY not set — GuideStar extraction will be limited.\n");
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("\nWarning: FIRECRAWL_API_KEY not set — GuideStar scraping won't work.\n");
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 15: GuideStar Israel Org Database Building
// ═══════════════════════════════════════════════════════════════

const GUIDESTAR_IL_SEARCH_TARGETS: DiscoveryTarget[] = [
  // Search by cause categories on GuideStar IL
  { cause: "Israeli nonprofits education youth schools", region: "Israel" },
  { cause: "Israeli nonprofits health medical hospitals", region: "Israel" },
  { cause: "Israeli nonprofits poverty social welfare", region: "Israel" },
  { cause: "Israeli nonprofits environment sustainability", region: "Israel" },
  { cause: "Israeli nonprofits arts culture museums", region: "Israel" },
  { cause: "Israeli nonprofits women rights gender", region: "Israel" },
  { cause: "Israeli nonprofits Arab coexistence shared society", region: "Israel" },
  { cause: "Israeli nonprofits disability accessibility", region: "Israel" },
  { cause: "Israeli nonprofits immigration aliyah absorption", region: "Israel" },
  { cause: "Israeli nonprofits elderly aging seniors", region: "Israel" },
  { cause: "Israeli nonprofits technology innovation startups", region: "Israel" },
  { cause: "Israeli nonprofits democracy human rights civil liberties", region: "Israel" },
  { cause: "Israeli nonprofits religious Jewish community", region: "Israel" },
  { cause: "Israeli nonprofits security veterans IDF soldiers", region: "Israel" },
  { cause: "Israeli nonprofits food agriculture rural development", region: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 16: Reverse Donor Discovery Targets
// ═══════════════════════════════════════════════════════════════

// These are generated dynamically from existing org DB — but we need fallback targets
const REVERSE_LOOKUP_TARGETS: DiscoveryTarget[] = [
  { cause: "major donors funders of Latet Israel humanitarian aid", region: "Israel" },
  { cause: "major donors funders of Yad Eliezer Yad Ezra V'Shulamit food poverty Israel", region: "Israel" },
  { cause: "major donors funders of Israel Museum Jerusalem", region: "Israel" },
  { cause: "major donors funders of Technion Israel Institute of Technology", region: "Israel" },
  { cause: "major donors funders of Hebrew University Jerusalem", region: "Israel" },
  { cause: "major donors funders of Tel Aviv University", region: "Israel" },
  { cause: "major donors funders of Weizmann Institute of Science", region: "Israel" },
  { cause: "major donors funders of Sheba Medical Center", region: "Israel" },
  { cause: "major donors funders of Hadassah Medical Organization", region: "Israel" },
  { cause: "major donors funders of JDC Joint Distribution Committee Israel", region: "Israel" },
  { cause: "major donors funders of Magen David Adom", region: "Israel" },
  { cause: "major donors funders of Peres Center for Peace Innovation", region: "Israel" },
  { cause: "major donors funders of Yad Vashem", region: "Israel" },
  { cause: "major donors funders of Israel Democracy Institute", region: "Israel" },
  { cause: "major donors funders of Association for Civil Rights Israel ACRI", region: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 17: Israeli Government & Public Grant Sources (examples)
// ═══════════════════════════════════════════════════════════════

const GOV_GRANT_TARGETS: DiscoveryTarget[] = [
  { cause: "Mifal HaPais lottery grants recipients Israel nonprofits", region: "Israel" },
  { cause: "Israel Ministry of Social Affairs funded organizations", region: "Israel" },
  { cause: "Israel Science Foundation ISF funded researchers grants", region: "Israel" },
  { cause: "Jewish Agency for Israel programs funding grants", region: "Israel" },
  { cause: "Ministry of Education Israel supported institutions", region: "Israel" },
  { cause: "National Insurance Institute Bituach Leumi grants Israel", region: "Israel" },
  { cause: "Council for Higher Education Israel funded programs", region: "Israel" },
  { cause: "Israel Innovation Authority grants funded startups", region: "Israel" },
  { cause: "Ministry of Aliyah and Integration funded programs", region: "Israel" },
  { cause: "Israel National Lottery grants cultural institutions", region: "Israel" },
];

const GOV_BODY_NAMES: DirectNameTarget[] = [
  { name: "Mifal HaPais National Lottery Israel", type: "GOVERNMENT", country: "Israel" },
  { name: "Jewish Agency for Israel JAFI", type: "FOUNDATION", country: "Israel", website: "jewishagency.org" },
  { name: "Israel Science Foundation ISF", type: "GOVERNMENT", country: "Israel" },
  { name: "Israel Innovation Authority", type: "GOVERNMENT", country: "Israel" },
  { name: "Yad Hanadiv Rothschild Foundation Israel", type: "FOUNDATION", country: "Israel", website: "yadhanadiv.org.il" },
  { name: "UJA-Federation of New York Israel grants", type: "FOUNDATION", country: "United States", website: "ujafedny.org" },
  { name: "Jewish Federations of North America JFNA Israel", type: "FOUNDATION", country: "United States" },
  { name: "Keren Hayesod United Israel Appeal", type: "FOUNDATION", country: "Israel", website: "kh-uia.org.il" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 18: Israeli Corporate CSR
// ═══════════════════════════════════════════════════════════════

const CORPORATE_CSR_TARGETS: DiscoveryTarget[] = [
  { cause: "Israeli corporations corporate social responsibility CSR philanthropy", region: "Israel" },
  { cause: "Israeli tech companies philanthropy charitable giving", region: "Israel" },
  { cause: "Israeli banks philanthropy Hapoalim Leumi Discount", region: "Israel" },
  { cause: "Israeli insurance companies philanthropy Harel Clal Migdal", region: "Israel" },
  { cause: "Maala CSR rankings Israel top companies social responsibility", region: "Israel" },
  { cause: "Israeli defense companies community investment Elbit Rafael IAI", region: "Israel" },
];

const ISRAELI_CORPORATE_NAMES: DirectNameTarget[] = [
  { name: "Check Point Software Technologies philanthropy CSR", type: "CORPORATE", country: "Israel" },
  { name: "Teva Pharmaceutical philanthropy CSR", type: "CORPORATE", country: "Israel" },
  { name: "Bank Hapoalim philanthropy CSR", type: "CORPORATE", country: "Israel" },
  { name: "Bank Leumi philanthropy CSR", type: "CORPORATE", country: "Israel" },
  { name: "ICL Group philanthropy community investment", type: "CORPORATE", country: "Israel" },
  { name: "Wix.com philanthropy CSR Israel", type: "CORPORATE", country: "Israel" },
  { name: "Monday.com philanthropy social impact", type: "CORPORATE", country: "Israel" },
  { name: "Fiverr philanthropy community investment", type: "CORPORATE", country: "Israel" },
  { name: "SolarEdge philanthropy CSR Israel", type: "CORPORATE", country: "Israel" },
  { name: "Elbit Systems community investment CSR", type: "CORPORATE", country: "Israel" },
  { name: "Nice Systems philanthropy CSR", type: "CORPORATE", country: "Israel" },
  { name: "CyberArk philanthropy Israel", type: "CORPORATE", country: "Israel" },
  { name: "Strauss Group philanthropy CSR Israel", type: "CORPORATE", country: "Israel" },
  { name: "Israel Discount Bank philanthropy", type: "CORPORATE", country: "Israel" },
  { name: "Delek Group philanthropy Israel", type: "CORPORATE", country: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 19: Israeli Media & News Mining for Donor Clues
// ═══════════════════════════════════════════════════════════════

const NEWS_TARGETS: DiscoveryTarget[] = [
  { cause: "major donations Israeli nonprofits 2024 2025 philanthropy", region: "Israel" },
  { cause: "Israeli philanthropy awards gala events fundraising", region: "Israel" },
  { cause: "Forbes Israel philanthropy list richest donors", region: "Israel" },
  { cause: "Calcalist philanthropy donation charity Israel", region: "Israel" },
  { cause: "Globes Israel corporate philanthropy major gifts", region: "Israel" },
  { cause: "TheMarker Israel donors foundations new grants", region: "Israel" },
  { cause: "Sheatufim civil society report Israel philanthropy", region: "Israel" },
  { cause: "Israeli philanthropy conference summit 2024 2025", region: "Israel" },
];

const CONFERENCE_TARGETS: DiscoveryTarget[] = [
  { cause: "Israeli Philanthropy Conference speakers donors", region: "Israel" },
  { cause: "Giving Israel summit philanthropy networking", region: "Israel" },
  { cause: "JFN Jewish Funders Network conference Israel", region: "Israel" },
  { cause: "Israeli social impact investing conference", region: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 20: American Friends Of Mining
// ═══════════════════════════════════════════════════════════════

const AMERICAN_FRIENDS_TARGETS: DiscoveryTarget[] = [
  { cause: "American Friends of Israeli organizations 501c3 foundations", region: "United States" },
  { cause: "American Friends of Hebrew University", region: "United States" },
  { cause: "American Friends of Tel Aviv University", region: "United States" },
  { cause: "American Friends of Technion", region: "United States" },
  { cause: "American Friends of Weizmann Institute", region: "United States" },
  { cause: "American Friends of Sheba Medical Center", region: "United States" },
  { cause: "American Friends of Magen David Adom", region: "United States" },
  { cause: "American Friends of Israel Museum", region: "United States" },
  { cause: "PEF Israel Endowment Funds", region: "United States" },
  { cause: "Central Fund of Israel donations", region: "United States" },
  { cause: "One Israel Fund American donations", region: "United States" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const EXPANSION_PHASES: MarathonPhase[] = [
  {
    number: 15,
    name: "GuideStar Israel Org Discovery",
    targets: GUIDESTAR_IL_SEARCH_TARGETS,
    delayBetweenMs: 15000,
    expectedYield: 100,
    strategy: "two-prong",
  },
  {
    number: 16,
    name: "Reverse Donor Discovery (Israel)",
    targets: REVERSE_LOOKUP_TARGETS,
    delayBetweenMs: 12000,
    expectedYield: 80,
    strategy: "two-prong",
  },
  {
    number: 17,
    name: "Israeli Government & Public Grants",
    targets: GOV_GRANT_TARGETS,
    directNames: GOV_BODY_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 40,
    strategy: "two-prong",
  },
  {
    number: 18,
    name: "Israeli Corporate CSR Discovery",
    targets: CORPORATE_CSR_TARGETS,
    directNames: ISRAELI_CORPORATE_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 30,
    strategy: "two-prong",
  },
  {
    number: 19,
    name: "Israeli News & Conference Mining",
    targets: [...NEWS_TARGETS, ...CONFERENCE_TARGETS],
    delayBetweenMs: 10000,
    expectedYield: 50,
    strategy: "discovery",
  },
  {
    number: 20,
    name: "American Friends Of Mining",
    targets: AMERICAN_FRIENDS_TARGETS,
    delayBetweenMs: 5000,
    expectedYield: 50,
    strategy: "two-prong",
  },
];

// Push into shared array so marathon runner can find them
for (const phase of EXPANSION_PHASES) {
  if (!MARATHON_PHASES.find((p) => p.number === phase.number)) {
    MARATHON_PHASES.push(phase);
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const scriptDir = path.resolve(__dirname);

  // Determine which phases to run
  const phasesToRun = singlePhase
    ? EXPANSION_PHASES.filter((p) => p.number === singlePhase)
    : EXPANSION_PHASES;

  if (phasesToRun.length === 0) {
    console.error(`\nPhase ${singlePhase} not found. Available: ${EXPANSION_PHASES.map(p => p.number).join(", ")}\n`);
    process.exit(1);
  }

  const totalTargets = phasesToRun.reduce(
    (sum, p) => sum + p.targets.length + (p.directNames?.length ?? 0),
    0
  );
  const totalExpected = phasesToRun.reduce((sum, p) => sum + p.expectedYield, 0);

  // Count existing orgs for context
  const orgCount = await prisma.organization.count();
  const donorCount = await prisma.donor.count();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║    FUNDERRA — ISRAELI DATA SOURCE EXPANSION            ║");
  console.log("║    GuideStar IL + Reverse Discovery + Media Mining       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:        ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Targets:     ${totalTargets} total across ${phasesToRun.length} phases`);
  console.log(`Expected:    ~${totalExpected} new donors`);
  console.log(`Current DB:  ${donorCount} donors, ${orgCount} organizations`);
  console.log(`\nPhase breakdown:`);

  for (const phase of phasesToRun) {
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    console.log(`  ${phase.number}. ${phase.name}`);
    console.log(`     ${targetCount} targets, ~${phase.expectedYield} expected, ${phase.delayBetweenMs / 1000}s delay`);
  }

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".il-data-expansion-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".il-data-expansion-progress.json")}`);

  if (dryRun) {
    console.log("\n--- DRY RUN — listing all targets without executing ---\n");
    for (const phase of phasesToRun) {
      console.log(`\nPhase ${phase.number}: ${phase.name}`);
      console.log("  Discovery targets:");
      for (const t of phase.targets) {
        console.log(`    - ${t.cause} (${t.region})`);
      }
      if (phase.directNames) {
        console.log("  Direct names:");
        for (const n of phase.directNames) {
          console.log(`    - ${n.name} (${n.type}, ${n.country})`);
        }
      }
    }
    console.log("\n--- DRY RUN complete ---\n");
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases: phasesToRun.map((p) => p.number),
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".il-data-expansion-checkpoint.json"),
    progressPath: path.join(scriptDir, ".il-data-expansion-progress.json"),
    onProgress: (msg) => console.log(msg),
  });

  // Final stats
  const finalOrgCount = await prisma.organization.count();
  const finalDonorCount = await prisma.donor.count();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║           ISRAELI DATA EXPANSION COMPLETE                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  console.log(`Run ID:         ${result.runId}`);
  console.log(`Duration:       ${Math.round(result.durationMs / 60000)} minutes`);
  console.log(`Donors stored:  ${result.totalStored} new (${donorCount} → ${finalDonorCount})`);
  console.log(`Donors found:   ${result.totalDiscovered}`);
  console.log(`Errors:         ${result.totalErrors}`);
  console.log(`Orgs in DB:     ${orgCount} → ${finalOrgCount} (+${finalOrgCount - orgCount})`);
  console.log("");

  for (const pr of result.phaseResults) {
    console.log(`  Phase ${pr.phase} (${pr.name}): ${pr.stored} stored, ${pr.errors} errors, ${Math.round(pr.durationMs / 60000)}m`);
  }

  console.log("");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\nExpansion failed with fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
