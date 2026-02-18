/**
 * Backfill Similar Organizations
 *
 * Enriches existing Organizations with discovered similar org names.
 * Also stores discovered peer orgs in the Organization table.
 *
 * For each org:
 * 1. Runs Perplexity similar org discovery (Signal 1)
 * 2. Optionally runs GuideStar IL category search (Signal 2)
 * 3. Appends discovered orgs to Organization.similarOrgs[]
 * 4. Stores discovered orgs in the Organization DB
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-similar-orgs.ts
 *   npx tsx --env-file=.env scripts/backfill-similar-orgs.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-similar-orgs.ts --limit 5
 *   npx tsx --env-file=.env scripts/backfill-similar-orgs.ts --use-guidestar
 *
 * Expected: ~10-50 orgs to process, ~$2-5 API cost
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import { prisma } from "@/lib/prisma";
import { discoverAndStoreSimilarOrgs } from "@/lib/guidestar-israel/similar-org-finder";

// ─── Parse CLI arguments ─────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const USE_GUIDESTAR = args.includes("--use-guidestar");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const MIN_EXISTING = 5; // Only backfill orgs with fewer than this many similar orgs

const DELAY_BETWEEN_ORGS_MS = 15000; // 15s between orgs to avoid rate limits

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Backfill Similar Organizations ===\n");
  console.log(`Mode:         ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`GuideStar IL: ${USE_GUIDESTAR ? "enabled" : "disabled (use --use-guidestar to enable)"}`);
  if (LIMIT > 0) console.log(`Limit:        ${LIMIT} orgs`);
  console.log(`Threshold:    orgs with < ${MIN_EXISTING} similar orgs\n`);

  // Find orgs that need similar org enrichment
  const allOrgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      mission: true,
      causes: true,
      geographicFocus: true,
      similarOrgs: true,
      israeliRegistrationNumber: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter to those with fewer than MIN_EXISTING similar orgs
  const orgsToProcess = allOrgs.filter(
    (org) => (org.similarOrgs as { name: string }[]).length < MIN_EXISTING
  );

  const effectiveLimit = LIMIT > 0 ? Math.min(LIMIT, orgsToProcess.length) : orgsToProcess.length;

  console.log(`Found ${allOrgs.length} total organizations`);
  console.log(`${orgsToProcess.length} need enrichment (< ${MIN_EXISTING} similar orgs)`);
  console.log(`Will process ${effectiveLimit} orgs\n`);

  if (DRY_RUN) {
    console.log("Sample orgs to process:");
    for (const org of orgsToProcess.slice(0, 10)) {
      console.log(
        `  - ${org.name} (${(org.similarOrgs as { name: string }[]).length} similar orgs, ${org.causes.length} causes, reg: ${org.israeliRegistrationNumber || "N/A"})`
      );
    }
    console.log("\n--- DRY RUN complete ---\n");
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let totalNewNames = 0;

  for (let i = 0; i < effectiveLimit; i++) {
    const org = orgsToProcess[i];
    console.log(
      `\n[${i + 1}/${effectiveLimit}] Processing: "${org.name}" (${(org.similarOrgs as { name: string }[]).length} existing similar orgs)`
    );

    try {
      const result = await discoverAndStoreSimilarOrgs(org.id, {
        usePerplexity: true,
        useGuidestarCategories: USE_GUIDESTAR && !!org.israeliRegistrationNumber,
        useBoardOverlap: false, // Too slow for batch
        maxResults: 20,
      });

      if (result.newNames.length > 0) {
        console.log(
          `  ✓ Found ${result.totalFound} total, ${result.newNames.length} new similar orgs`
        );
        console.log(`    Sources: ${JSON.stringify(result.bySource)}`);
        console.log(`    New: ${result.newNames.slice(0, 5).join(", ")}${result.newNames.length > 5 ? "..." : ""}`);
        enriched++;
        totalNewNames += result.newNames.length;
      } else {
        console.log("  - No new similar orgs found");
        skipped++;
      }

      processed++;
    } catch (err) {
      errors++;
      processed++;
      console.error(
        `  ✗ Error: ${err instanceof Error ? err.message : err}`
      );
    }

    // Rate limiting
    if (i < effectiveLimit - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_ORGS_MS));
    }
  }

  // Also store any new orgs we discovered as Organizations in our DB
  // (The discoverAndStoreSimilarOrgs function only stores names, not full org records)
  // We'll create stub org records for any names that don't exist yet
  console.log("\n--- Storing discovered orgs in Organization DB ---\n");

  let orgsCreated = 0;
  const allOrgNames = new Set(
    (await prisma.organization.findMany({ select: { name: true } })).map(
      (o) => o.name.toLowerCase()
    )
  );

  // Collect all new similar org names across all processed orgs
  const reloadedOrgs = await prisma.organization.findMany({
    where: { id: { in: orgsToProcess.slice(0, effectiveLimit).map((o) => o.id) } },
    select: { similarOrgs: true },
  });

  const allSimilarNames = new Set<string>();
  for (const org of reloadedOrgs) {
    for (const entry of org.similarOrgs as { name: string }[]) {
      if (!allOrgNames.has(entry.name.toLowerCase())) {
        allSimilarNames.add(entry.name);
      }
    }
  }

  for (const name of allSimilarNames) {
    try {
      await prisma.organization.create({
        data: {
          name,
          country: "Israel",
          geographicFocus: ["Israel"],
          causes: [],
          similarOrgs: [],
          existingDonors: [],
        },
      });
      orgsCreated++;
    } catch {
      // Likely duplicate — continue
    }
  }

  console.log(`Created ${orgsCreated} new Organization records from discovered names`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Processed:       ${processed}`);
  console.log(`Enriched:        ${enriched}`);
  console.log(`Skipped:         ${skipped}`);
  console.log(`Errors:          ${errors}`);
  console.log(`New similar orgs: ${totalNewNames}`);
  console.log(`New org records:  ${orgsCreated}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
