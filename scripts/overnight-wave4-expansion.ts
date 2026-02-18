/**
 * Overnight Wave 4 — European Jewish + Israeli Tech/Political + Sector Gap Expansion
 *
 * Standalone script that adds phases 21-25 to the marathon pipeline:
 *   Phase 21: European Jewish Philanthropy (UK, France, Germany, Global)
 *   Phase 22: Missing Israeli Foundations & Christian Zionist
 *   Phase 23: Israeli Tech Founders & Political Donors (Armis, Cybereason, etc.)
 *   Phase 24: Israeli Sector Gap Filling (Bedouin, Ethiopian, post-Oct-7)
 *   Phase 25: Similar Org Backfill (calls backfill logic inline)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/overnight-wave4-expansion.ts
 *   npx tsx --env-file=.env scripts/overnight-wave4-expansion.ts --resume
 *   npx tsx --env-file=.env scripts/overnight-wave4-expansion.ts --dry-run
 *
 * Expected yield: ~150 new donors
 * Runtime: ~2-3 hours
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
// PHASE 21: European Jewish Philanthropy
// ═══════════════════════════════════════════════════════════════

const EU_JEWISH_CAUSE_TARGETS: DiscoveryTarget[] = [
  { cause: "UK Jewish philanthropy foundations Israel support grants", region: "United Kingdom" },
  { cause: "French Jewish philanthropy foundations Israel France", region: "France" },
  { cause: "German political foundations Israel Stiftung programs", region: "Germany" },
  { cause: "Swiss Jewish philanthropy foundations Israel banking", region: "Switzerland" },
  { cause: "European Jewish philanthropy organizations Israel support", region: "Europe" },
  { cause: "Australian Jewish philanthropy foundations Israel giving", region: "Australia" },
  { cause: "Latin American Jewish philanthropy foundations Israel Brazil Argentina", region: "Global" },
  { cause: "Rothschild family foundations global Israel philanthropy", region: "Global" },
];

const EU_JEWISH_DIRECT_NAMES: DirectNameTarget[] = [
  // UK Foundations
  { name: "Pears Foundation UK Israel", type: "FOUNDATION", country: "United Kingdom", website: "pearsfoundation.org.uk" },
  { name: "Rothschild Foundation UK Israel Yad Hanadiv", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Gerald Ronson Foundation Israel UK", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Wolfson Foundation Israel UK grants", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Clore Duffield Foundation Israel UK", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Dangoor Education Israel philanthropy", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Maurice Wohl Charitable Foundation Israel", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Kirsh Foundation South Africa Israel", type: "FOUNDATION", country: "United Kingdom" },
  { name: "JNF UK Jewish National Fund", type: "FOUNDATION", country: "United Kingdom" },
  { name: "Sir Mick Davis philanthropy Israel UK", type: "INDIVIDUAL", country: "United Kingdom" },

  // French Foundations
  { name: "Fondation du Judaisme Francais Israel France", type: "FOUNDATION", country: "France" },
  { name: "Alliance Israelite Universelle France Israel", type: "FOUNDATION", country: "France" },
  { name: "Fondation France Israel philanthropy", type: "FOUNDATION", country: "France" },

  // German Political Foundations
  { name: "Konrad Adenauer Stiftung Israel programs", type: "FOUNDATION", country: "Germany" },
  { name: "Friedrich Ebert Stiftung Israel programs", type: "FOUNDATION", country: "Germany" },

  // Global Foundations
  { name: "Genesis Philanthropy Group Israel Russian Jewish", type: "FOUNDATION", country: "United States", website: "gpg.org" },
  { name: "Pratt Foundation Australia Israel", type: "FOUNDATION", country: "Australia" },
  { name: "Lowy Family Group Australia Israel philanthropy", type: "FOUNDATION", country: "Australia" },
  { name: "Besen Family Foundation Australia Israel", type: "FOUNDATION", country: "Australia" },
  { name: "Oppenheimer Memorial Trust South Africa Israel", type: "FOUNDATION", country: "South Africa" },
  { name: "Gerald Schwartz and Heather Reisman Foundation Canada Israel", type: "FOUNDATION", country: "Canada" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 22: Missing Israeli Foundations + Christian Zionist
// ═══════════════════════════════════════════════════════════════

const MISSING_ISRAELI_FOUNDATIONS: DirectNameTarget[] = [
  // Major missing Israeli foundations
  { name: "Rashi Foundation Israel social change", type: "FOUNDATION", country: "Israel" },
  { name: "Teva Pharmaceutical Foundation Israel health", type: "FOUNDATION", country: "Israel" },
  { name: "Bank Hapoalim Foundation community Israel", type: "FOUNDATION", country: "Israel" },
  { name: "Israel Discount Bank Foundation community", type: "FOUNDATION", country: "Israel" },
  { name: "Mandel Foundation Israel leadership education", type: "FOUNDATION", country: "Israel" },
  { name: "Maimonides Fund Israel Jewish education", type: "FOUNDATION", country: "United States" },
  { name: "Steinhardt Foundation Jewish Life Israel", type: "FOUNDATION", country: "United States" },
  { name: "Tikvah Fund Israel Jewish thought education", type: "FOUNDATION", country: "United States" },
  { name: "Or Movement Israel education periphery", type: "FOUNDATION", country: "Israel" },
  { name: "Karev Foundation Israel volunteering education", type: "FOUNDATION", country: "Israel" },
  { name: "Atidim Foundation Israel STEM education periphery", type: "FOUNDATION", country: "Israel" },
  { name: "Perach tutoring program Israel education", type: "OTHER", country: "Israel" },
  { name: "Keren Shemesh Israel sunshine foundation children", type: "FOUNDATION", country: "Israel" },
  { name: "Matan United Way Israel giving", type: "FOUNDATION", country: "Israel" },
  { name: "Sheatufim Israel civil society infrastructure", type: "FOUNDATION", country: "Israel" },
  { name: "Social Finance Israel impact investing", type: "FOUNDATION", country: "Israel" },

  // Major American Jewish Federation Israel programs
  { name: "UJA-Federation of New York Israel programs", type: "FOUNDATION", country: "United States" },
  { name: "Jewish Federation of Greater Los Angeles Israel", type: "FOUNDATION", country: "United States" },
  { name: "Jewish United Fund JUF Chicago Israel", type: "FOUNDATION", country: "United States" },
  { name: "Combined Jewish Philanthropies CJP Boston Israel", type: "FOUNDATION", country: "United States" },
  { name: "JDC American Jewish Joint Distribution Committee Israel", type: "OTHER", country: "United States", website: "jdc.org" },

  // Christian Zionist organizations
  { name: "International Fellowship of Christians and Jews IFCJ", type: "FOUNDATION", country: "United States", website: "ifcj.org" },
  { name: "Christians United for Israel CUFI", type: "FOUNDATION", country: "United States", website: "cufi.org" },
  { name: "Bridges for Peace Israel Christian support", type: "FOUNDATION", country: "Israel", website: "bridgesforpeace.com" },
  { name: "International Christian Embassy Jerusalem ICEJ", type: "FOUNDATION", country: "Israel", website: "icej.org" },
  { name: "John Hagee Ministries Israel philanthropy", type: "FOUNDATION", country: "United States" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 23: Israeli Tech Founders & Political Donors
// ═══════════════════════════════════════════════════════════════

const TECH_POLITICAL_CAUSE_TARGETS: DiscoveryTarget[] = [
  { cause: "Israeli tech leaders political donations Knesset party funding exposed", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli donors political causes right-wing left-wing philanthropy public statements", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli business leaders political activism social justice causes", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli startup founders social impact political engagement philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli cybersecurity industry leaders philanthropy 8200 alumni giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli unicorn founders philanthropy personal giving social causes 2024", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

const TECH_POLITICAL_DIRECT_NAMES: DirectNameTarget[] = [
  // Cybersecurity founders — SUSPECTED confidence (donate privately)
  { name: "Nadir Izrael philanthropy Armis co-founder CTO cybersecurity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yevgeny Dibrov philanthropy Armis co-founder CEO cybersecurity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Alon Arvatz philanthropy PointFive IntSights co-founder", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Lior Div philanthropy Cybereason co-founder CEO", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yonatan Striem-Amit philanthropy Cybereason co-founder CTO", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Ohad Bobrov philanthropy CyberArk security leader Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Tomer Weingarten philanthropy SentinelOne co-founder Israeli", type: "INDIVIDUAL", country: "United States", defaultConfidence: "SUSPECTED" },
  { name: "Adi Sharabani philanthropy Snyk co-founder Israel security", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Guy Podjarny philanthropy Snyk co-founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Nadav Zafrir philanthropy Team8 founder ex-8200 commander", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },

  // ironSource founders
  { name: "Israel Grimberg philanthropy ironSource co-founder Unity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Omer Kaplan philanthropy ironSource co-founder Unity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Tomer Bar-Zeev philanthropy ironSource co-founder Unity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },

  // Additional tech/political donors
  { name: "Roy More philanthropy Verbit founder AI Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Assaf Rappaport philanthropy Wiz co-founder cybersecurity", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 24: Israeli Sector Gap Filling
// ═══════════════════════════════════════════════════════════════

const SECTOR_GAP_TARGETS: DiscoveryTarget[] = [
  { cause: "Bedouin Negev development foundations philanthropy Israel", region: "Israel" },
  { cause: "Ethiopian Israeli community foundations philanthropy", region: "Israel" },
  { cause: "Druze community foundations philanthropy Israel", region: "Israel" },
  { cause: "Ultra-Orthodox Haredi social services foundations Israel", region: "Israel" },
  { cause: "domestic violence survivors women shelter foundations Israel", region: "Israel" },
  { cause: "PTSD trauma resilience foundations Israel post October 7", region: "Israel" },
  { cause: "lone soldiers support foundations Israel IDF", region: "Israel" },
  { cause: "reservist families support foundations Israel 2024", region: "Israel" },
  { cause: "community resilience centers foundations Israel south north", region: "Israel" },
  { cause: "autism special needs support foundations Israel ASD", region: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS (phases 21-25)
// ═══════════════════════════════════════════════════════════════

import { MARATHON_PHASES } from "@/lib/agents/marathon-targets";

const EXPANSION_PHASES: MarathonPhase[] = [
  {
    number: 21,
    name: "European Jewish Philanthropy",
    targets: EU_JEWISH_CAUSE_TARGETS,
    directNames: EU_JEWISH_DIRECT_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 35,
    strategy: "two-prong",
  },
  {
    number: 22,
    name: "Missing Israeli Foundations & Christian Zionist",
    targets: [],
    directNames: MISSING_ISRAELI_FOUNDATIONS,
    delayBetweenMs: 10000,
    expectedYield: 30,
    strategy: "two-prong",
  },
  {
    number: 23,
    name: "Israeli Tech Founders & Political Donors",
    targets: TECH_POLITICAL_CAUSE_TARGETS,
    directNames: TECH_POLITICAL_DIRECT_NAMES,
    delayBetweenMs: 10000,
    expectedYield: 35,
    strategy: "two-prong",
  },
  {
    number: 24,
    name: "Israeli Sector Gap Filling",
    targets: SECTOR_GAP_TARGETS,
    delayBetweenMs: 10000,
    expectedYield: 30,
    strategy: "discovery",
  },
  {
    number: 25,
    name: "Enrichment: Low-Quality Wave 4 Donors",
    targets: [],
    delayBetweenMs: 15000,
    expectedYield: 0,
    strategy: "enrichment",
  },
];

// Push expansion phases into the shared array so getPhase() can find them
for (const phase of EXPANSION_PHASES) {
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
  console.log("║     FUNDERRA — WAVE 4: EU JEWISH + TECH/POLITICAL      ║");
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

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".wave4-expansion-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".wave4-expansion-progress.json")}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases: EXPANSION_PHASES.map((p) => p.number),
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".wave4-expansion-checkpoint.json"),
    progressPath: path.join(scriptDir, ".wave4-expansion-progress.json"),
    onProgress: (msg) => console.log(msg),
  });

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║           WAVE 4 EXPANSION COMPLETE                      ║");
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
  console.error("\nWave 4 expansion failed with fatal error:", err);
  process.exit(1);
});
