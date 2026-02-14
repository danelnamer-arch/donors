/**
 * One-time script: Normalize causes on existing donors + regenerate embeddings.
 *
 * 1. Runs normalizeCauses() on all existing donor cause arrays
 * 2. Regenerates embeddings for donors whose causes changed
 * 3. Clears stale org embeddings so they regenerate on next match
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/normalize-existing-data.ts
 *   npx tsx --env-file=.env scripts/normalize-existing-data.ts --dry-run
 *   npx tsx --env-file=.env scripts/normalize-existing-data.ts --embeddings-only
 */

import "tsconfig-paths/register";

import { prisma } from "@/lib/prisma";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import { generateEmbedding } from "@/lib/openai";

const isDryRun = process.argv.includes("--dry-run");
const embeddingsOnly = process.argv.includes("--embeddings-only");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function normalizeDonorCauses() {
  console.log("\n🔄 Phase 1: Normalizing donor causes...\n");

  const donors = await prisma.donor.findMany({
    select: { id: true, name: true, causes: true },
  });

  console.log(`  Found ${donors.length} donors to process`);

  let updated = 0;
  let unchanged = 0;
  const changedDonorIds: string[] = [];

  for (const donor of donors) {
    const original = donor.causes;
    const normalized = normalizeCauses(original);

    // Check if causes actually changed
    const changed =
      original.length !== normalized.length ||
      original.some((c: string, i: number) => c !== normalized[i]);

    if (changed) {
      if (isDryRun) {
        console.log(`  [DRY RUN] ${donor.name}:`);
        console.log(`    Before: ${original.join(", ")}`);
        console.log(`    After:  ${normalized.join(", ")}`);
      } else {
        await prisma.donor.update({
          where: { id: donor.id },
          data: { causes: normalized },
        });
      }
      changedDonorIds.push(donor.id);
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\n  ✅ Normalized: ${updated} donors, ${unchanged} already correct`);
  return changedDonorIds;
}

async function regenerateEmbeddings(donorIds: string[]) {
  console.log(`\n🔄 Phase 2: Regenerating embeddings for ${donorIds.length} changed donors...\n`);

  if (donorIds.length === 0) {
    console.log("  No donors need embedding updates.");
    return;
  }

  let success = 0;
  let errors = 0;

  for (let i = 0; i < donorIds.length; i++) {
    const donor = await prisma.donor.findUnique({
      where: { id: donorIds[i] },
      select: {
        id: true,
        name: true,
        description: true,
        causes: true,
        geographicFocus: true,
        targetPopulations: true,
      },
    });

    if (!donor) continue;

    const embeddingText = [
      donor.description || donor.name,
      donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
      donor.geographicFocus.length ? `Geographic focus: ${donor.geographicFocus.join(", ")}` : null,
      donor.targetPopulations.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
    ].filter(Boolean).join(". ");

    if (!embeddingText) continue;

    try {
      if (isDryRun) {
        console.log(`  [DRY RUN] Would regenerate embedding for: ${donor.name}`);
      } else {
        const embedding = await generateEmbedding(embeddingText);
        await prisma.$executeRawUnsafe(
          `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
          JSON.stringify(embedding),
          donor.id
        );
        console.log(`  [${i + 1}/${donorIds.length}] ✓ ${donor.name}`);
      }
      success++;

      // Rate limit: ~60 embeddings per minute with text-embedding-3-small
      if (!isDryRun && i % 50 === 49) {
        console.log("  ⏳ Rate limit pause...");
        await sleep(5000);
      }
    } catch (err) {
      console.error(`  [${i + 1}/${donorIds.length}] ✗ ${donor.name}:`, err);
      errors++;
      await sleep(2000);
    }
  }

  console.log(`\n  ✅ Embeddings: ${success} updated, ${errors} errors`);
}

async function clearOrgEmbeddings() {
  console.log("\n🔄 Phase 3: Clearing stale organization embeddings...\n");

  if (isDryRun) {
    const count = await prisma.organization.count({
      where: { NOT: { mission: null } },
    });
    console.log(`  [DRY RUN] Would clear embeddings for ${count} organizations`);
    return;
  }

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Organization" SET "missionEmbedding" = NULL WHERE "missionEmbedding" IS NOT NULL`
  );
  console.log(`  ✅ Cleared embeddings for ${result} organizations (will regenerate on next match)`);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Normalize Existing Data Script");
  console.log(`  Mode: ${isDryRun ? "DRY RUN" : embeddingsOnly ? "EMBEDDINGS ONLY" : "LIVE"}`);
  console.log("═══════════════════════════════════════════");

  try {
    let changedDonorIds: string[] = [];

    if (!embeddingsOnly) {
      changedDonorIds = await normalizeDonorCauses();
    } else {
      // For embeddings-only, regenerate all donors that have embeddings
      const donors = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Donor" WHERE "missionEmbedding" IS NOT NULL`
      );
      changedDonorIds = donors.map((d: { id: string }) => d.id);
      console.log(`\n  Found ${changedDonorIds.length} donors with existing embeddings to refresh`);
    }

    await regenerateEmbeddings(changedDonorIds);
    await clearOrgEmbeddings();

    console.log("\n═══════════════════════════════════════════");
    console.log("  ✅ Done! Matches will use updated data on next generation.");
    console.log("═══════════════════════════════════════════\n");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
