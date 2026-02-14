/**
 * Israeli Private Donor Discovery Script
 *
 * Standalone script focused on finding hundreds of Israeli INDIVIDUAL
 * type donors through creative multi-channel search strategies.
 *
 * This complements the existing expansion (phases 6-7) by adding:
 * 1. Israeli tech exit founders & business leaders (Forbes, TheMarker, Globes)
 * 2. University/hospital building naming reverse-engineering
 * 3. Media-exposed & controversial donors
 * 4. "American Friends of" board member extraction
 * 5. Suspected donors with wealth signals but unproven giving
 * 6. Israeli expat philanthropists (US, UK, Europe)
 * 7. Cultural, sports & arts patrons
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/israeli-private-donors.ts
 *   npx tsx --env-file=.env scripts/israeli-private-donors.ts --resume
 *   npx tsx --env-file=.env scripts/israeli-private-donors.ts --dry-run
 *
 * Expected yield: ~200-300 new individual donors
 * Runtime: ~5-7 hours
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
// GROUP A: Israeli Business Media & Rich Lists (8 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_A_BUSINESS_MEDIA: DiscoveryTarget[] = [
  { cause: "Forbes Israel richest Israelis billionaires philanthropy personal donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "TheMarker Globes richest Israelis philanthropy charitable giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Calcalist Israeli billionaires personal charitable donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli tycoons philanthropy personal giving Dun and Bradstreet Israel", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "BDI Code Israel business leaders personal philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli millionaires philanthropists Maala CSR personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israel Giving Report individual donors private philanthropy trends", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "JFN Jewish Funders Network Israeli individual members philanthropists", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP B: Tech Exits & Startup Wealth (8 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_B_TECH_EXITS: DiscoveryTarget[] = [
  { cause: "Israeli tech startup exit founders philanthropists unicorn billions", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli cybersecurity founders philanthropy Check Point Wiz Armis", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli fintech founders philanthropy personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli AI startup founders philanthropy Mobileye autonomous driving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli Nasdaq IPO founders personal philanthropy donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "8200 alumni Israeli entrepreneurs philanthropy SIGINT Unit", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli venture capital partners philanthropy personal giving GP LP", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli SaaS company founders exits philanthropy Wix monday Fiverr", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP C: Real Estate & Diamond Industry (5 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_C_REAL_ESTATE_DIAMONDS: DiscoveryTarget[] = [
  { cause: "Israeli real estate developers tycoons philanthropy personal donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli diamond industry leaders philanthropy Ramat Gan bourse personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli construction magnates philanthropy Ofer Ashtrom Shikun Binui", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli property developers philanthropy Tel Aviv luxury real estate", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli billionaires London real estate philanthropy personal giving", region: "United Kingdom", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP D: University & Hospital Building Naming (6 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_D_BUILDING_NAMING: DiscoveryTarget[] = [
  { cause: "Hebrew University building wing named after donor benefactor philanthropist", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Technion building named after donor philanthropist Haifa", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Tel Aviv University building named after donor benefactor", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Weizmann Institute building named after donor philanthropist", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Hadassah hospital Sheba Ichilov wing named after donor philanthropist Israel", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Ben Gurion University Reichman IDC donor building naming benefactor", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP E: Controversial & Media-Exposed Donors (7 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_E_CONTROVERSIAL: DiscoveryTarget[] = [
  { cause: "controversial Israeli donors philanthropy settlements right-wing exposed media", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli donors BDS movement pro-Israel philanthropy exposed media", region: "Global", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli political donors exposed Likud Labor party funding", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli oligarchs philanthropy controversial donations media investigation", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli donors US politics AIPAC philanthropy exposed", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli donors European causes philanthropy UK France Germany", region: "Europe", donorTypeHint: "INDIVIDUAL" },
  { cause: "Haaretz investigation Israeli philanthropists wealthy donors exposed", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP F: Cultural & Arts Patronage (5 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_F_CULTURE_ARTS: DiscoveryTarget[] = [
  { cause: "Israeli art collectors patrons museum philanthropy personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israel Museum patrons donors individual benefactors Jerusalem", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Tel Aviv Museum patrons donors individual benefactors", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israel Philharmonic Orchestra patrons donors individual supporters", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli film industry patrons donors Gesher theater individual philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP G: Sports Patronage (3 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_G_SPORTS: DiscoveryTarget[] = [
  { cause: "Maccabi Tel Aviv Hapoel owners sponsors individual donors patrons", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli football basketball team owners philanthropy personal", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israel sports philanthropy individual donors Sylvan Adams Giro Italia", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP H: "American Friends Of" Reverse Engineering (5 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_H_AMERICAN_FRIENDS: DiscoveryTarget[] = [
  { cause: "American Friends of Hebrew University major individual donors board members", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "American Friends of Tel Aviv University major donors board AFTAU", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "American Friends of Sheba Medical Center donors board individual", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "American Friends of IDF FIDF major individual donors board", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "American Friends of Magen David Adom donors board individual", region: "United States", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP I: Israeli Awards & Prizes (3 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_I_AWARDS: DiscoveryTarget[] = [
  { cause: "Israel Prize winners philanthropy wealthy Israelis personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Dan David Prize Genesis Prize laureates philanthropy", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli Presidential Award volunteer philanthropy wealthy individuals", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP J: Israeli Expat Philanthropists (5 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_J_EXPATS: DiscoveryTarget[] = [
  { cause: "Israeli expat philanthropists New York London giving to Israel", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli-American philanthropists Silicon Valley tech personal giving Israel", region: "United States", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli-British philanthropists London personal giving Israel", region: "United Kingdom", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli diaspora philanthropists wealthy individuals giving back", region: "Global", donorTypeHint: "INDIVIDUAL" },
  { cause: "Jewish-Israeli philanthropists Monaco Switzerland tax exile philanthropy", region: "Europe", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP K: Sector-Specific Wealthy Israelis (6 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_K_INDUSTRY: DiscoveryTarget[] = [
  { cause: "Israeli pharmaceutical industry leaders Teva philanthropy personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli banking finance leaders philanthropy Leumi Hapoalim Discount personal", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli food industry leaders Strauss Osem Tnuva philanthropy personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli shipping magnates Ofer ZIM philanthropy personal", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli energy sector leaders Delek Isramco philanthropy personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli media moguls philanthropy Keshet Reshet personal giving", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// GROUP L: Suspected Donors — Wealth Signals Without Proof (5 targets)
// ═══════════════════════════════════════════════════════════════

const GROUP_L_SUSPECTED: DiscoveryTarget[] = [
  { cause: "Israeli billionaires who might donate privately anonymous giving Israel", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "wealthy Israelis social causes involvement board nonprofit no public donations", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli high net worth individuals nonprofit board members suspected donors", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "Israeli family offices private wealth management philanthropy advisory", region: "Israel", donorTypeHint: "INDIVIDUAL" },
  { cause: "ultra high net worth Israelis UHNWI private banking philanthropy signals", region: "Israel", donorTypeHint: "INDIVIDUAL" },
];

// ═══════════════════════════════════════════════════════════════
// TIER 1: Top Israeli Billionaire Philanthropists (25 names)
// ═══════════════════════════════════════════════════════════════

const TIER_1_BILLIONAIRES: DirectNameTarget[] = [
  // Tech sector
  { name: "Nir Zuk philanthropy Palo Alto Networks", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shlomo Kramer philanthropy Cato Networks Imperva", type: "INDIVIDUAL", country: "Israel" },
  { name: "Zohar Zisapel philanthropy RAD Group", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yehuda Zisapel philanthropy RAD Data Communications", type: "INDIVIDUAL", country: "Israel" },
  { name: "Amnon Shashua philanthropy Mobileye OrCam", type: "INDIVIDUAL", country: "Israel" },
  { name: "Benny Landa philanthropy Landa Corporation", type: "INDIVIDUAL", country: "Israel" },
  { name: "Avishai Abrahami philanthropy Wix founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Assaf Rappaport philanthropy Wiz cybersecurity founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Ehud Shabtai philanthropy Waze founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Uri Levine philanthropy Waze co-founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shlomo Dovrat philanthropy Gemini Israel Funds", type: "INDIVIDUAL", country: "Israel" },
  { name: "Kobi Richter philanthropy Meitar law firm", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yossi Vardi philanthropy ICQ investor", type: "INDIVIDUAL", country: "Israel" },
  // Real estate and industry
  { name: "Eyal Ofer philanthropy Ofer Global", type: "INDIVIDUAL", country: "Israel" },
  { name: "Idan Ofer philanthropy Kenon Holdings", type: "INDIVIDUAL", country: "Israel" },
  { name: "Arnon Milchan philanthropy film producer", type: "INDIVIDUAL", country: "Israel" },
  { name: "Lev Leviev philanthropy Africa Israel diamonds", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yitzhak Tshuva philanthropy Delek Group", type: "INDIVIDUAL", country: "Israel" },
  { name: "Stef Wertheimer philanthropy ISCAR Tefen", type: "INDIVIDUAL", country: "Israel" },
  { name: "Eitan Wertheimer philanthropy ISCAR IMC", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shari Arison philanthropy Arison Group", type: "INDIVIDUAL", country: "Israel" },
  { name: "Morris Kahn philanthropy SpaceIL Coral World", type: "INDIVIDUAL", country: "Israel" },
  { name: "Sylvan Adams philanthropy cycling Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Avigdor Willenz philanthropy Galileo Technology Habana Labs", type: "INDIVIDUAL", country: "Israel" },
  { name: "Nochi Dankner philanthropy IDB Holdings", type: "INDIVIDUAL", country: "Israel" },
];

// ═══════════════════════════════════════════════════════════════
// TIER 2: Israeli-American & Diaspora Philanthropists (25 names)
// ═══════════════════════════════════════════════════════════════

const TIER_2_DIASPORA: DirectNameTarget[] = [
  { name: "Haim Saban philanthropy Saban Capital", type: "INDIVIDUAL", country: "United States" },
  { name: "Adam Milstein philanthropy Israeli-American Council", type: "INDIVIDUAL", country: "United States" },
  { name: "Miriam Adelson philanthropy Las Vegas Sands Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Len Blavatnik philanthropy Access Industries", type: "INDIVIDUAL", country: "United States" },
  { name: "Roman Abramovich philanthropy Israel donations", type: "INDIVIDUAL", country: "Israel" },
  { name: "Paul Singer philanthropy Israel Elliott Management", type: "INDIVIDUAL", country: "United States" },
  { name: "Seth Klarman philanthropy Israel Baupost Group", type: "INDIVIDUAL", country: "United States" },
  { name: "Lynn Schusterman philanthropy Israel Oklahoma", type: "INDIVIDUAL", country: "United States" },
  { name: "Ronald Lauder philanthropy Israel World Jewish Congress", type: "INDIVIDUAL", country: "United States" },
  { name: "Michael Steinhardt philanthropy Birthright Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Charles Bronfman philanthropy Israel Canada", type: "INDIVIDUAL", country: "Canada" },
  { name: "Stephen Schwarzman philanthropy Israel Blackstone", type: "INDIVIDUAL", country: "United States" },
  { name: "Mort Zuckerman philanthropy Israel media", type: "INDIVIDUAL", country: "United States" },
  { name: "Ira Rennert philanthropy Israel Hamptons", type: "INDIVIDUAL", country: "United States" },
  { name: "Lester Crown philanthropy Israel General Dynamics", type: "INDIVIDUAL", country: "United States" },
  { name: "Cheryl Saban philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Dan Gertler philanthropy Israel DRC", type: "INDIVIDUAL", country: "Israel" },
  { name: "Beny Steinmetz philanthropy Israel diamonds", type: "INDIVIDUAL", country: "Israel" },
  { name: "Sammy Ofer philanthropy Israel shipping", type: "INDIVIDUAL", country: "Israel" },
  { name: "Edgar Bronfman philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Leon Black philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "David Rubenstein philanthropy Israel Carlyle", type: "INDIVIDUAL", country: "United States" },
  { name: "Michael Milken philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Leon Cooperman philanthropy Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Marc Rich philanthropy Israel", type: "INDIVIDUAL", country: "Switzerland" },
];

// ═══════════════════════════════════════════════════════════════
// TIER 3: Mid-Tier Israeli Tech & Business Philanthropists (25 names)
// ═══════════════════════════════════════════════════════════════

const TIER_3_MID_TIER: DirectNameTarget[] = [
  { name: "Erel Margalit philanthropy JVP Jerusalem Venture Partners", type: "INDIVIDUAL", country: "Israel" },
  { name: "Dov Moran philanthropy M-Systems USB inventor", type: "INDIVIDUAL", country: "Israel" },
  { name: "Marius Nacht philanthropy Check Point co-founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Gil Shwed philanthropy Check Point founder CEO", type: "INDIVIDUAL", country: "Israel" },
  { name: "Nir Barkat philanthropy Jerusalem mayor tech investor", type: "INDIVIDUAL", country: "Israel" },
  { name: "Eyal Waldman philanthropy Mellanox founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Teddy Sagi philanthropy Playtech Kape Technologies", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yuri Milner philanthropy DST Global Breakthrough Prize Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Adam Neumann philanthropy WeWork founder Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Vivi Nevo philanthropy NV Investments Israel", type: "INDIVIDUAL", country: "United States" },
  { name: "Danna Azrieli philanthropy Azrieli Group heiress", type: "INDIVIDUAL", country: "Israel" },
  { name: "Sharon Azrieli philanthropy Azrieli Foundation", type: "INDIVIDUAL", country: "Canada" },
  { name: "Ofra Strauss philanthropy Strauss Group Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Raya Strauss Ben Dror philanthropy Strauss impact investing", type: "INDIVIDUAL", country: "Israel" },
  { name: "Michael Federmann philanthropy Elbit Dan Hotels Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Chaim Katzman philanthropy Gazit Globe real estate", type: "INDIVIDUAL", country: "Israel" },
  { name: "Oudi Recanati philanthropy IDB Clal Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "David Fattal philanthropy Fattal Hotels Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Yaron Galai philanthropy Outbrain co-founder Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Rami Levy philanthropy supermarket chain Israel social", type: "INDIVIDUAL", country: "Israel" },
  { name: "Avi Naor philanthropy NICE Systems co-founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Shai Agassi philanthropy Better Place founder Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Roy Segal philanthropy monday.com founder", type: "INDIVIDUAL", country: "Israel" },
  { name: "Mickey Federmann philanthropy Dan Hotels Israel", type: "INDIVIDUAL", country: "Israel" },
  { name: "Galia Maor philanthropy Bank Leumi CEO Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
];

// ═══════════════════════════════════════════════════════════════
// TIER 4: Suspected Donors — Wealth Signals (25 names)
// ═══════════════════════════════════════════════════════════════

const TIER_4_SUSPECTED: DirectNameTarget[] = [
  { name: "Oren Zeev philanthropy Zeev Ventures Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Eden Shochat philanthropy Aleph VC Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Yoav Leitersdorf philanthropy YL Ventures Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Gigi Levy-Weiss philanthropy NFX Israel gaming", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Tal Barnoach philanthropy Disruptive AI Israel VC", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Oren Kaniel philanthropy AppsFlyer founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Or Offer philanthropy Lightricks founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Zeev Holtzman philanthropy Giza Venture Capital Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yigal Erlich philanthropy Yozma Group Israel VC pioneer", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Rami Beracha philanthropy Pitango VC Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Chemi Peres philanthropy Pitango VC Shimon Peres son", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Jonathan Kolber philanthropy FIMI Opportunity Funds Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Boaz Dinte philanthropy Viola Group Israel PE", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Avi Eyal philanthropy Entrée Capital Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Amir Gal-Or philanthropy Infinity Group Israel China", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Eldad Tamir philanthropy Tamir Fishman Israel PE", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Izhar Shay philanthropy Knesset member tech investor", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Dov Seidman philanthropy LRN ethics Israel connections", type: "INDIVIDUAL", country: "United States", defaultConfidence: "SUSPECTED" },
  { name: "Barak Eilam philanthropy NICE Systems CEO Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Nir Zohar philanthropy Wix president Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Amos Shapira philanthropy Cellcom Israel CEO", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Giora Kaplan philanthropy Mellanox CTO Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yoav Stern philanthropy Nano Dimension Israel 3D printing", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Arik Czerniak philanthropy Israeli biotech investor", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Adi Sideman philanthropy YouNow founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
];

// ═══════════════════════════════════════════════════════════════
// TIER 5: Additional High-Profile Names (20 names)
// ═══════════════════════════════════════════════════════════════

const TIER_5_ADDITIONAL: DirectNameTarget[] = [
  { name: "Irit Izakson philanthropy Israel social venture", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "LIKELY" },
  { name: "Roni Einav philanthropy Einav Group media Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Orit Farkash-Hacohen philanthropy Knesset member Israel tech", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Jacob Harpaz philanthropy Israel Military Industries", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Danny Goldstein philanthropy Elbit Systems Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Tzachi Hagag philanthropy Hagag Group real estate", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Delek Razon philanthropy Shikun Binui real estate", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Kobi Alexander philanthropy Comverse Technology", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Moti Zisser philanthropy Elbit Imaging Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Avi Katz philanthropy Tower Semiconductor", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Shaul Shani philanthropy SolarEdge founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Guy Shani philanthropy SolarEdge co-founder Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Alon Shani philanthropy 888 Holdings Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yaron Adler philanthropy DragonTech ventures Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Eilon Tirosh philanthropy Imperative Care medical Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Shlomit Wagman philanthropy Israel finance leader", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Esti Peshin philanthropy Israel Aerospace Industries cyber", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yair Hamburger philanthropy Elta Systems Israel", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Yoel Esteron philanthropy Calcalist TheMarker editor Israel media", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
  { name: "Esti Ackerman philanthropy Israeli tech executive", type: "INDIVIDUAL", country: "Israel", defaultConfidence: "SUSPECTED" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS (phases 8-14, no conflict with 1-7)
// ═══════════════════════════════════════════════════════════════

import { MARATHON_PHASES } from "@/lib/agents/marathon-targets";

const EXPANSION_PHASES: MarathonPhase[] = [
  {
    number: 8,
    name: "Israeli Tech & Business Media Discovery",
    targets: [...GROUP_A_BUSINESS_MEDIA, ...GROUP_B_TECH_EXITS],
    directNames: TIER_1_BILLIONAIRES,
    delayBetweenMs: 12000,
    expectedYield: 50,
    strategy: "two-prong",
  },
  {
    number: 9,
    name: "Israeli Real Estate, Diamonds & Industry",
    targets: [...GROUP_C_REAL_ESTATE_DIAMONDS, ...GROUP_K_INDUSTRY],
    directNames: TIER_3_MID_TIER.slice(0, 12),
    delayBetweenMs: 12000,
    expectedYield: 35,
    strategy: "two-prong",
  },
  {
    number: 10,
    name: "Building Naming, Culture & Sports Discovery",
    targets: [...GROUP_D_BUILDING_NAMING, ...GROUP_F_CULTURE_ARTS, ...GROUP_G_SPORTS],
    directNames: TIER_3_MID_TIER.slice(12),
    delayBetweenMs: 12000,
    expectedYield: 40,
    strategy: "two-prong",
  },
  {
    number: 11,
    name: "Controversial & Media-Exposed Israeli Donors",
    targets: [...GROUP_E_CONTROVERSIAL, ...GROUP_I_AWARDS],
    directNames: TIER_2_DIASPORA.slice(0, 13),
    delayBetweenMs: 15000,
    expectedYield: 30,
    strategy: "two-prong",
  },
  {
    number: 12,
    name: "American Friends & Diaspora Donors",
    targets: [...GROUP_H_AMERICAN_FRIENDS, ...GROUP_J_EXPATS],
    directNames: TIER_2_DIASPORA.slice(13),
    delayBetweenMs: 12000,
    expectedYield: 35,
    strategy: "two-prong",
  },
  {
    number: 13,
    name: "Suspected & Wealth-Signal Israeli Donors",
    targets: GROUP_L_SUSPECTED,
    directNames: [...TIER_4_SUSPECTED, ...TIER_5_ADDITIONAL],
    delayBetweenMs: 10000,
    expectedYield: 40,
    strategy: "two-prong",
  },
  {
    number: 14,
    name: "Enrichment: Low-Quality Israeli Individuals",
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
  console.log("║     FUNDERRA — ISRAELI PRIVATE DONOR DISCOVERY         ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:     ${resume ? "RESUME" : dryRun ? "DRY RUN" : "FRESH RUN"}`);
  console.log(`Targets:  ${totalTargets} total across ${EXPANSION_PHASES.length} phases`);
  console.log(`Expected: ~${totalExpected} new individual donors`);
  console.log(`\nPhase breakdown:`);

  for (const phase of EXPANSION_PHASES) {
    const targetCount = phase.targets.length + (phase.directNames?.length ?? 0);
    console.log(`  ${phase.number}. ${phase.name}`);
    console.log(`     ${targetCount} targets, ~${phase.expectedYield} expected yield, ${phase.delayBetweenMs / 1000}s delay`);
  }

  console.log(`\nCheckpoint: ${path.join(scriptDir, ".private-donors-checkpoint.json")}`);
  console.log(`Progress:   ${path.join(scriptDir, ".private-donors-progress.json")}`);
  console.log(`\nStarting in 3 seconds... (Ctrl+C to cancel)\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = await runMarathonDiscovery({
    phases: EXPANSION_PHASES.map((p) => p.number),
    resume,
    dryRun,
    checkpointPath: path.join(scriptDir, ".private-donors-checkpoint.json"),
    progressPath: path.join(scriptDir, ".private-donors-progress.json"),
    onProgress: (msg) => console.log(msg),
  });

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║           PRIVATE DONOR DISCOVERY COMPLETE               ║");
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
  console.error("\nPrivate donor discovery failed with fatal error:", err);
  process.exit(1);
});
