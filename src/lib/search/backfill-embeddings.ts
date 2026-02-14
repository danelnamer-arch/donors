/**
 * Embedding Backfill Script
 *
 * Regenerates embeddings for donors that are missing them
 * or have low-quality embedding text (e.g. IRS 990 imports).
 *
 * Run: npx tsx src/lib/search/backfill-embeddings.ts
 *
 * Cost estimate: ~$0.01 per donor (OpenAI text-embedding-3-small)
 *   300 donors → ~$3
 */

import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import OpenAI from "openai";

// Use pg adapter (required by this Prisma setup)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const openai = new OpenAI();

const BATCH_SIZE = 10;
const DELAY_MS = 500;

/**
 * Build rich embedding text from donor data.
 */
function buildEmbeddingText(donor: {
  name: string;
  description: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  activeRegions: string[];
  country: string | null;
  city: string | null;
}): string {
  return [
    donor.name,
    donor.description,
    donor.causes.length ? `Focus areas: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations.length ? `Serving: ${donor.targetPopulations.join(", ")}` : null,
    donor.geographicFocus.length ? `Geographic focus: ${donor.geographicFocus.join(", ")}` : null,
    donor.activeRegions?.length ? `Active in: ${donor.activeRegions.join(", ")}` : null,
    donor.country && donor.city ? `Located in ${donor.city}, ${donor.country}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Generate embedding using OpenAI.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Backfill embeddings for all donors that need them.
 */
async function backfillEmbeddings() {
  console.log("Embedding Backfill Script");
  console.log("========================\n");

  // Find donors needing embeddings
  const donorsNeedingEmbeddings = await prisma.$queryRawUnsafe<{ id: string }[]>(`
    SELECT id FROM "Donor"
    WHERE "missionEmbedding" IS NULL
    ORDER BY "dataQualityScore" DESC
  `);

  // Also find donors with potentially low-quality embeddings (low data quality, IRS imports)
  const donorsLowQuality = await prisma.$queryRawUnsafe<{ id: string }[]>(`
    SELECT id FROM "Donor"
    WHERE "missionEmbedding" IS NOT NULL
      AND "dataQualityScore" < 0.5
      AND "researchStatus" = 'NEEDS_UPDATE'
    ORDER BY "dataQualityScore" DESC
  `);

  const allIds = [
    ...donorsNeedingEmbeddings.map(d => d.id),
    ...donorsLowQuality.map(d => d.id),
  ];
  const uniqueIds = [...new Set(allIds)];

  console.log(`Found ${donorsNeedingEmbeddings.length} donors without embeddings`);
  console.log(`Found ${donorsLowQuality.length} donors with low-quality embeddings`);
  console.log(`Total to process: ${uniqueIds.length}\n`);

  if (uniqueIds.length === 0) {
    console.log("Nothing to backfill!");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batchIds = uniqueIds.slice(i, i + BATCH_SIZE);

    const donors = await prisma.donor.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        name: true,
        description: true,
        causes: true,
        targetPopulations: true,
        geographicFocus: true,
        activeRegions: true,
        country: true,
        city: true,
      },
    });

    for (const donor of donors) {
      try {
        const text = buildEmbeddingText(donor);
        const embedding = await generateEmbedding(text);

        await prisma.$executeRawUnsafe(
          `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
          JSON.stringify(embedding),
          donor.id
        );

        succeeded++;
        process.stdout.write(`  [${processed + 1}/${uniqueIds.length}] ${donor.name} ✓\n`);
      } catch (err) {
        failed++;
        console.error(`  [${processed + 1}/${uniqueIds.length}] ${donor.name} ✗ ${err instanceof Error ? err.message : "failed"}`);
      }
      processed++;
    }

    // Rate limiting between batches
    if (i + BATCH_SIZE < uniqueIds.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);

  await prisma.$disconnect();
}

// Run directly if executed as a script
backfillEmbeddings().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});

export { backfillEmbeddings, buildEmbeddingText };
