/**
 * Israeli Donor & Individual Philanthropist Expansion Script
 *
 * Standalone script that runs new Israeli-specific and individual-focused
 * discovery targets through the existing marathon pipeline.
 *
 * This complements the main marathon by adding:
 * 1. Israeli foundations by sector (missing from original marathon)
 * 2. Known Israeli foundations & philanthropists (direct-name research)
 * 3. Individual philanthropists (HNW individuals, tech billionaires)
 * 4. Diaspora Jewish donors and "American Friends of" foundations
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/israeli-expansion.ts
 *   npx tsx --env-file=.env scripts/israeli-expansion.ts --resume
 *   npx tsx --env-file=.env scripts/israeli-expansion.ts --dry-run
 *
 * Expected yield: ~130-220 new donors
 * Runtime: ~3-4 hours
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

  if (!process.env.GEMINI_API_KEY) {
    console.warn("\nWarning: GEMINI_API_KEY not set — structured extraction will be limited.\n");
  }
}

// ═══════════════════════════════════════════════════════════════
// TARGETS: Israeli Foundations by Sector
// ═══════════════════════════════════════════════════════════════

const ISRAELI_SECTOR_TARGETS: DiscoveryTarget[] = [
  // Israeli family offices & private philanthropy
  { cause: "Israeli family offices and private philanthropy", region: "Israel" },
  { cause: "Israeli corporate social responsibility CSR programs", region: "Israel" },
  { cause: "Israeli venture philanthropy and impact investing funds", region: "Israel" },

  // Religious & community philanthropy
  { cause: "Haredi ultra-Orthodox Jewish philanthropy foundations Israel", region: "Israel" },

  // University & institutional endowments
  { cause: "Israeli university endowment offices Hebrew University Technion Tel Aviv", region: "Israel" },

  // Municipal & regional foundations
  { cause: "Jerusalem Foundation and Jerusalem-based philanthropic organizations", region: "Israel" },
  { cause: "Tel Aviv Foundation and municipal philanthropy Israel", region: "Israel" },

  // Sector-specific Israeli foundations
  { cause: "Israeli agricultural and rural development foundations", region: "Israel" },
  { cause: "Israeli women philanthropy and gender equality foundations", region: "Israel" },
  { cause: "Arab-Israeli civil society foundations and coexistence funding", region: "Israel" },
  { cause: "Israeli disability and special needs foundations", region: "Israel" },
  { cause: "Israeli immigrant absorption and aliyah support foundations", region: "Israel" },
  { cause: "Israeli environmental protection and climate foundations", region: "Israel" },
  { cause: "Israeli cultural institutions museums and performing arts funding", region: "Israel" },
  { cause: "Kibbutz movement foundations and communal giving Israel", region: "Israel" },
  { cause: "Israeli children and youth at-risk foundations", region: "Israel" },
  { cause: "Israeli elderly care and aging foundations", region: "Israel" },
  { cause: "Israeli sports and recreation foundations", region: "Israel" },
  { cause: "Israeli media and press freedom foundations", region: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// TARGETS: Known Israeli Foundations (Direct Name Research)
// ═══════════════════════════════════════════════════════════════

const ISRAELI_DIRECT_NAMES: DirectNameTarget[] = [
  // Major Israeli foundations NOT in current DB
  { name: "Jerusalem Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Tel Aviv Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "The New Israel Fund", type: "FOUNDATION", country: "Israel", website: "nif.org" },
  { name: "Yad Vashem Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "JNF-KKL Keren Kayemeth LeIsrael", type: "FOUNDATION", country: "Israel" },
  { name: "Israel Venture Network IVN", type: "FOUNDATION", country: "Israel" },
  { name: "Tmura Foundation Israel", type: "FOUNDATION", country: "Israel" },
  { name: "Ogen Social Finance Israel", type: "FOUNDATION", country: "Israel" },
  { name: "The Edmond de Rothschild Foundation Israel", type: "FOUNDATION", country: "Israel" },
  { name: "The Mifal HaPais Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Birthright Israel Foundation", type: "FOUNDATION", country: "Israel", website: "birthrightisrael.com" },
  { name: "Masa Israel Journey", type: "FOUNDATION", country: "Israel", website: "masaisrael.org" },
  { name: "The Harry and Jeanette Weinberg Foundation", type: "FOUNDATION", country: "United States" },
  { name: "The Avi Chai Foundation Israel", type: "FOUNDATION", country: "Israel" },

  // Mid-tier Israeli foundations
  { name: "Karev Foundation Israel", type: "FOUNDATION", country: "Israel" },
  { name: "The Appleseeds Academy Israel", type: "FOUNDATION", country: "Israel" },
  { name: "Or Yarok Israel road safety", type: "FOUNDATION", country: "Israel" },
  { name: "Elem Youth in Distress Israel", type: "FOUNDATION", country: "Israel" },
  { name: "Latet Israeli Humanitarian Aid", type: "FOUNDATION", country: "Israel" },
  { name: "The Tami Steinmetz Center for Peace Research", type: "FOUNDATION", country: "Israel" },
  { name: "The Van Leer Jerusalem Institute", type: "FOUNDATION", country: "Israel" },
  { name: "Yad Sarah Israel", type: "FOUNDATION", country: "Israel" },
  { name: "ALYN Hospital Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "The Israel Center for Excellence through Education ICE", type: "FOUNDATION", country: "Israel" },

  // Israeli tech philanthropists (INDIVIDUAL type)
  { name: "Yuri Milner philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shari Arison philanthropy Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Teddy Sagi philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Gil Shwed philanthropy Check Point", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yossi Vardi philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Erel Margalit philanthropy JVP", type: "INDIVIDUAL", country: "Israel" },
  { name: "Dov Moran philanthropy", type: "INDIVIDUAL", country: "Israel" },

  // Diaspora foundations
  { name: "The Alan B. Slifka Foundation", type: "FOUNDATION", country: "United States" },
  { name: "The Jacob and Hilda Blaustein Foundation", type: "FOUNDATION", country: "United States" },
  { name: "The Andrea and Charles Bronfman Philanthropies", type: "FOUNDATION", country: "United States" },
  { name: "The Samuel Sebba Charitable Trust", type: "FOUNDATION", country: "United Kingdom" },
  { name: "The Gerald Schwartz and Heather Reisman Foundation", type: "FOUNDATION", country: "Canada" },
];

// ═══════════════════════════════════════════════════════════════
// TARGETS: Individual Philanthropists (HNW Donors)
// ═══════════════════════════════════════════════════════════════

const INDIVIDUAL_DISCOVERY_TARGETS: DiscoveryTarget[] = [
  // Global HNW individual discovery
  { cause: "Forbes billionaire philanthropists giving pledge 2024", region: "Global" },
  { cause: "tech billionaire philanthropy individual donors", region: "United States" },
  { cause: "hedge fund managers philanthropy personal giving", region: "United States" },
  { cause: "real estate mogul philanthropy individual", region: "United States" },
  { cause: "family office philanthropy individual donors", region: "Global" },

  // Israeli HNW individuals
  { cause: "Israeli billionaires Forbes philanthropy personal giving", region: "Israel" },
  { cause: "Israeli tech entrepreneurs philanthropy startup exits", region: "Israel" },
  { cause: "Israeli real estate magnates philanthropy", region: "Israel" },
  { cause: "Israeli diamond industry philanthropy", region: "Israel" },

  // Diaspora Jewish individuals
  { cause: "Jewish American philanthropists individual giving", region: "United States" },
  { cause: "Jewish British philanthropists individual giving", region: "United Kingdom" },
  { cause: "Jewish Canadian philanthropists individual giving", region: "Canada" },
  { cause: "Jewish French philanthropists individual giving", region: "France" },
];

const INDIVIDUAL_DIRECT_NAMES: DirectNameTarget[] = [
  // Top Israeli individual donors
  { name: "Haim Saban philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Adam Neumann philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Eyal Waldman philanthropy Mellanox", type: "INDIVIDUAL", country: "Israel" },
  { name: "Nir Barkat philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Marius Nacht philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shlomo Kramer philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Zohar Zisapel philanthropy RAD", type: "INDIVIDUAL", country: "Israel" },
  { name: "Amnon Shashua philanthropy Mobileye", type: "INDIVIDUAL", country: "Israel" },

  // Top global Jewish individual donors
  { name: "Ronald Lauder philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Michael Bloomberg philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "George Soros philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Leon Black philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Henry Kravis philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "David Rubenstein philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Michael Milken philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Leon Cooperman philanthropy", type: "INDIVIDUAL", country: "United States" },
  { name: "Steve Schwarzman philanthropy", type: "INDIVIDUAL", country: "United States" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS (uses existing marathon infrastructure)
// ═══════════════════════════════════════════════════════════════

// We override MARATHON_PHASES locally — the runner reads from getPhase()
// but we use the generic executeDiscoveryPhase which reads .targets + .directNames
// Instead, we construct a custom config that maps to the same phase numbers

// We'll reuse phase numbers 2, 3 for our purposes
// Phase 6: Israeli expansion (sector + direct names)
// Phase 7: Individual expansion (cause + direct names)
// But the runner only supports phases 1-5 in its switch statement.
//
// Better approach: We import the raw runner logic and call it ourselves.
// Actually the simplest approach: add new phases to marathon-targets dynamically.
//
// SIMPLEST: Use the `two-prong` strategy which handles both targets + directNames.
// The executeDiscoveryPhase function handles any phase number for discovery/two-prong.

// We'll monkey-patch the MARATHON_PHASES with our expansion phases.

import { MARATHON_PHASES } from "@/lib/agents/marathon-targets";

// Add expansion phases (6, 7)
const EXPANSION_PHASES: MarathonPhase[] = [
  {
    number: 6,
    name: "Israeli Foundation Expansion",
    targets: ISRAELI_SECTOR_TARGETS,
    directNames: ISRAELI_DIRECT_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 80,
    strategy: "two-prong",
  },
  {
    number: 7,
    name: "Individual Philanthropist Expansion",
    targets: INDIVIDUAL_DISCOVERY_TARGETS,
    directNames: INDIVIDUAL_DIRECT_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 60,
    strategy: "two-prong",
  },
];

// Push expansion phases into the shared array so getPhase() can find them
for (const phase of EXPANSION_PHASES) {
  // Only add if not already present (for re-runs)
  if (!MARATHON_PHASES.find((p) => p.number === phase.number)) {
    MARATHON_PHASES.push(phase);
  }
}

// ─── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const scriptDir = path.resolve(__dirname);

  const totalTargets = EXPANSION_PHASES.reduce(
    (sum, p) => sum + p.targets.length + (p.directNames?.length ?? 0),
    0
  );
  const totalExpected = EXPANSION_PHASES.reduce((sum, p) => sum + p.expectedYield, 0);

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║     FUNDERRA — ISRAELI & INDIVIDUAL EXPANSION          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:     ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Targets:  ${totalTargets} total across ${EXPANSION_PHASES.length} phases`);
  console.log(`Expected: ~${totalExpected} new donors`);
  console.log(`\nPhase breakdown:`);

  for (const phase of EXPANSION_PHASES) {
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    console.log(`  ${phase.number}. ${phase.name}`);
    console.log(`     ${targetCount} targets, ~${phase.expectedYield} expected yield, ${phase.delayBetweenMs / 1000}s delay`);
  }

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".expansion-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".expansion-progress.json")}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases: EXPANSION_PHASES.map((p) => p.number),
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".expansion-checkpoint.json"),
    progressPath: path.join(scriptDir, ".expansion-progress.json"),
    onProgress: (msg) => console.log(msg),
  });

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                EXPANSION COMPLETE                        ║");
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
  console.error("\nExpansion failed with fatal error:", err);
  process.exit(1);
});
