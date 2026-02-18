/**
 * Board Member Cross-Reference Script
 *
 * Novel strategy: scrape GuideStar Israel for board members of foundations
 * in our donor DB, then cross-reference to discover:
 *
 * 1. Board members appearing on 2+ foundation boards (network hubs)
 * 2. Background check: do they have the profile of a philanthropic donor?
 *    (wealth signals, public giving, media mentions of charity work)
 * 3. If yes → research and store as INDIVIDUAL donor (LIKELY or SUSPECTED)
 * 4. For each board member, check what OTHER orgs they're on
 *    → those orgs become similar-org candidates + get stored in Org DB
 *
 * Board membership overlap is a strong indicator of giving networks.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/board-member-xref.ts
 *   npx tsx --env-file=.env scripts/board-member-xref.ts --dry-run
 *   npx tsx --env-file=.env scripts/board-member-xref.ts --limit 10
 *
 * Rate limited: 15s between GuideStar scrapes.
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";
import { searchGuidestarOrgs, scrapeGuidestarOrg } from "@/lib/guidestar-israel/scraper";

// ─── Parse CLI arguments ─────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 20;

const DELAY_BETWEEN_SCRAPES_MS = 15000;
const DELAY_BETWEEN_CHECKS_MS = 5000;

// ─── Types ───────────────────────────────────────────────────

interface BoardMemberOccurrence {
  memberName: string;
  orgName: string;
  orgRegNumber?: string;
}

interface DonorProfileCheck {
  name: string;
  isDonorProfile: boolean;
  confidence: "LIKELY" | "SUSPECTED" | null;
  reasoning: string;
  wealthSignals: string[];
  philanthropySignals: string[];
  otherOrgs: string[];
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Board Member Cross-Reference ===\n");
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Limit:  ${LIMIT} foundations to scrape\n`);

  // Step 1: Find Israeli foundations in our donor DB that we can scrape
  const israeliFoundations = await prisma.donor.findMany({
    where: {
      OR: [
        { headquartersCountry: "Israel" },
        { country: "Israel" },
        { israeliRegistrationNumber: { not: null } },
      ],
      type: "FOUNDATION",
    },
    select: {
      id: true,
      name: true,
      israeliRegistrationNumber: true,
    },
    take: LIMIT,
    orderBy: { dataQualityScore: "desc" },
  });

  console.log(`Found ${israeliFoundations.length} Israeli foundations in DB`);

  if (DRY_RUN) {
    console.log("\nSample foundations to scrape:");
    for (const f of israeliFoundations.slice(0, 10)) {
      console.log(`  - ${f.name} (reg: ${f.israeliRegistrationNumber || "N/A"})`);
    }
    console.log("\n--- DRY RUN complete ---\n");
    await prisma.$disconnect();
    return;
  }

  // Step 2: Scrape board members from each foundation
  const allOccurrences: BoardMemberOccurrence[] = [];
  let foundationsScraped = 0;
  let scrapeErrors = 0;

  for (let i = 0; i < israeliFoundations.length; i++) {
    const foundation = israeliFoundations[i];
    console.log(
      `\n[${i + 1}/${israeliFoundations.length}] Scraping board of: "${foundation.name}"`
    );

    let regNumber = foundation.israeliRegistrationNumber;

    // If no reg number, try to find via search
    if (!regNumber) {
      try {
        const searchResults = await searchGuidestarOrgs(foundation.name);
        if (searchResults.length > 0) {
          regNumber = searchResults[0].regNumber;
          // Save it back to DB
          await prisma.donor.update({
            where: { id: foundation.id },
            data: { israeliRegistrationNumber: regNumber },
          });
          console.log(`  Found reg number: ${regNumber}`);
        }
      } catch {
        console.log("  Could not find registration number — skipping");
        scrapeErrors++;
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SCRAPES_MS));
    }

    if (!regNumber) {
      console.log("  No registration number — skipping");
      continue;
    }

    try {
      const profile = await scrapeGuidestarOrg(regNumber);

      if (profile.boardMembers.length > 0) {
        console.log(`  Found ${profile.boardMembers.length} board members`);
        for (const member of profile.boardMembers) {
          allOccurrences.push({
            memberName: member,
            orgName: profile.nameEnglish || profile.name,
            orgRegNumber: regNumber,
          });
        }
        foundationsScraped++;
      } else {
        console.log("  No board members found");
      }
    } catch (err) {
      scrapeErrors++;
      console.error(
        `  Scrape failed: ${err instanceof Error ? err.message : err}`
      );
    }

    // Rate limit
    if (i < israeliFoundations.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SCRAPES_MS));
    }
  }

  console.log(`\n--- Board member collection complete ---`);
  console.log(`Foundations scraped: ${foundationsScraped}`);
  console.log(`Total board member occurrences: ${allOccurrences.length}`);
  console.log(`Scrape errors: ${scrapeErrors}\n`);

  // Step 3: Find board members on 2+ boards (network hubs)
  const memberOrgs = new Map<string, BoardMemberOccurrence[]>();
  for (const occ of allOccurrences) {
    const key = occ.memberName.toLowerCase().trim();
    if (!memberOrgs.has(key)) {
      memberOrgs.set(key, []);
    }
    memberOrgs.get(key)!.push(occ);
  }

  const multipleBoards = [...memberOrgs.entries()]
    .filter(([, occs]) => occs.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Board members on 2+ boards: ${multipleBoards.length}`);

  if (multipleBoards.length > 0) {
    console.log("\nTop multi-board members:");
    for (const [name, occs] of multipleBoards.slice(0, 10)) {
      const orgNames = occs.map((o) => o.orgName).join(", ");
      console.log(`  ${name} (${occs.length} boards): ${orgNames}`);
    }
  }

  // Step 4: Background check each multi-board member for donor profile
  console.log("\n--- Running donor profile background checks ---\n");

  let donorsCreated = 0;
  let notDonorProfile = 0;
  let checkErrors = 0;

  // Also check ALL unique board members (not just multi-board)
  const allUniqueMembers = [...memberOrgs.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  // Process multi-board members first, then top single-board members
  const membersToCheck = [
    ...multipleBoards,
    ...allUniqueMembers
      .filter(([, occs]) => occs.length === 1)
      .slice(0, 20), // Top 20 single-board members
  ];

  for (let i = 0; i < membersToCheck.length; i++) {
    const [memberKey, occurrences] = membersToCheck[i];
    const memberName = occurrences[0].memberName; // Use original casing
    const orgNames = occurrences.map((o) => o.orgName);

    console.log(
      `[${i + 1}/${membersToCheck.length}] Checking: "${memberName}" (on ${orgNames.length} boards)`
    );

    // Skip if already in our donor DB
    const existingDonor = await prisma.donor.findFirst({
      where: {
        name: { contains: memberName, mode: "insensitive" },
        type: "INDIVIDUAL",
      },
    });

    if (existingDonor) {
      console.log(`  Already in DB: ${existingDonor.name}`);

      // Still store org cross-references
      await storeOrgCrossReferences(memberName, occurrences);
      continue;
    }

    try {
      const check = await runDonorProfileCheck(memberName, orgNames);

      if (check.isDonorProfile && check.confidence) {
        console.log(
          `  ✓ DONOR PROFILE (${check.confidence}): ${check.reasoning}`
        );

        // Create donor record
        await prisma.donor.create({
          data: {
            name: memberName,
            type: "INDIVIDUAL",
            description: `Board member of: ${orgNames.join(", ")}. ${check.reasoning}`,
            donorConfidence: check.confidence,
            country: "Israel",
            causes: [],
            targetPopulations: [],
            geographicFocus: ["Israel"],
            activeRegions: ["Israel"],
            dataSources: [
              {
                url: "board-member-xref",
                title: `Discovered via board membership on ${orgNames.length} organizations`,
                fetchedAt: new Date().toISOString(),
              },
            ],
            researchStatus: "NEEDS_UPDATE",
            dataQualityScore: 0.2, // Low — needs deep research
          },
        });
        donorsCreated++;
      } else {
        console.log(`  - Not a donor profile: ${check.reasoning}`);
        notDonorProfile++;
      }

      // Store org cross-references regardless
      await storeOrgCrossReferences(memberName, occurrences);
    } catch (err) {
      checkErrors++;
      console.error(
        `  Error: ${err instanceof Error ? err.message : err}`
      );
    }

    // Rate limit
    if (i < membersToCheck.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CHECKS_MS));
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Foundations scraped:     ${foundationsScraped}`);
  console.log(`Unique board members:   ${memberOrgs.size}`);
  console.log(`Multi-board members:    ${multipleBoards.length}`);
  console.log(`Donor profiles found:   ${donorsCreated}`);
  console.log(`Not donor profile:      ${notDonorProfile}`);
  console.log(`Errors:                 ${scrapeErrors + checkErrors}`);

  await prisma.$disconnect();
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Run a donor profile background check using Gemini.
 * Determines if a board member has the profile of a philanthropic donor.
 */
async function runDonorProfileCheck(
  memberName: string,
  orgNames: string[]
): Promise<DonorProfileCheck> {
  const prompt = `Analyze whether "${memberName}" has the profile of a philanthropic donor based on their role as a board member of these Israeli organizations: ${orgNames.join(", ")}.

Return ONLY valid JSON:
{
  "isDonorProfile": true/false,
  "confidence": "LIKELY" | "SUSPECTED" | null,
  "reasoning": "1-2 sentences explaining why they are or aren't a likely donor",
  "wealthSignals": ["list of wealth indicators: business ownership, real estate, tech exits, etc."],
  "philanthropySignals": ["list of giving signals: other donations, charity involvement, public statements about philanthropy"],
  "otherOrgs": ["list of other organizations they might be associated with"]
}

Rules:
- Being on a nonprofit board is a MODERATE signal (many board members are donors, but not all)
- Being on MULTIPLE nonprofit boards is a STRONG signal
- Look for wealth signals: business background, tech industry, real estate, finance
- Look for philanthropy signals: public donations, charity events, fundraising roles
- If the person is clearly a paid professional (lawyer, accountant, consultant) and NOT wealthy, return isDonorProfile: false
- If uncertain, lean toward "SUSPECTED" rather than false — we'll research further
- Consider the types of organizations: sitting on boards of major foundations/hospitals suggests wealth`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.2, maxTokens: 500 }
  );

  try {
    const jsonStr = result
      .replace(/```json?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return { name: memberName, ...JSON.parse(jsonStr) };
  } catch {
    return {
      name: memberName,
      isDonorProfile: false,
      confidence: null,
      reasoning: "Failed to analyze",
      wealthSignals: [],
      philanthropySignals: [],
      otherOrgs: [],
    };
  }
}

/**
 * Store org cross-references: for each board member,
 * the orgs they sit on become similar-org candidates for each other.
 */
async function storeOrgCrossReferences(
  _memberName: string,
  occurrences: BoardMemberOccurrence[]
): Promise<void> {
  if (occurrences.length < 2) return;

  const orgNames = occurrences.map((o) => o.orgName);

  // For each pair of orgs sharing this board member, add each to the other's similarOrgs
  for (const occ of occurrences) {
    const otherOrgNames = orgNames.filter((n) => n !== occ.orgName);

    try {
      const org = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: { equals: occ.orgName, mode: "insensitive" } },
            {
              israeliRegistrationNumber: occ.orgRegNumber || undefined,
            },
          ],
        },
        select: { id: true, similarOrgs: true },
      });

      if (org) {
        const existingOrgs = org.similarOrgs as { name: string }[];
        const existing = new Set(
          existingOrgs.map((o) => o.name.toLowerCase())
        );
        const newNames = otherOrgNames.filter(
          (n) => !existing.has(n.toLowerCase())
        );

        if (newNames.length > 0) {
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              similarOrgs: [...existingOrgs, ...newNames.map((n) => ({ name: n }))],
            },
          });
        }
      } else {
        // Create the org if it doesn't exist
        await prisma.organization.create({
          data: {
            name: occ.orgName,
            israeliRegistrationNumber: occ.orgRegNumber ?? null,
            country: "Israel",
            geographicFocus: ["Israel"],
            causes: [],
            similarOrgs: otherOrgNames.map((n) => ({ name: n })),
            existingDonors: [],
          },
        });
      }
    } catch {
      // Unique constraint or other issue — non-critical
    }
  }
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
