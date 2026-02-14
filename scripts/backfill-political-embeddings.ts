/**
 * Backfill Political Stance & Embeddings
 *
 * Generates politicalStance text and politicalEmbedding vectors for existing
 * donors and organizations that lack them.
 *
 * For donors:
 *   1. Donors with politicalAffiliation != UNKNOWN but no politicalStance
 *   2. Uses GPT-4o-mini to generate a nuanced political stance from existing data
 *   3. Generates and stores the embedding
 *
 * For organizations:
 *   1. Orgs with rawProfileText or mission but no politicalStance
 *   2. Uses GPT-4o-mini to infer political stance from available text
 *   3. Generates and stores the embedding
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-political-embeddings.ts [--dry-run] [--donors-only] [--orgs-only] [--limit N]
 */

import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DONORS_ONLY = args.includes("--donors-only");
const ORGS_ONLY = args.includes("--orgs-only");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000;

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function generatePoliticalStance(
  name: string,
  description: string | null,
  causes: string[],
  politicalAffiliation: string,
  type: "donor" | "org",
  rawProfileText?: string | null
): Promise<string | null> {
  const context = [
    `Name: ${name}`,
    description && `Description: ${description.slice(0, 1000)}`,
    causes.length > 0 && `Causes/Focus areas: ${causes.join(", ")}`,
    politicalAffiliation !== "UNKNOWN" && `Known political affiliation: ${politicalAffiliation}`,
    rawProfileText && `Profile text: ${rawProfileText.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const entityType = type === "donor" ? "donor/foundation" : "nonprofit organization";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a political analyst specializing in philanthropy and nonprofits. Given information about a ${entityType}, describe their political/ideological positioning in 1-3 concise sentences. Be specific and nuanced — avoid simple left/right labels. For Israeli-connected entities: note positions on settlements, security, peace process, religious-secular divide, economic policy if discernible. If you cannot determine any political stance from the information, return exactly "null".`,
      },
      {
        role: "user",
        content: `Describe the political/ideological positioning of this ${entityType}:\n\n${context}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  const result = response.choices[0]?.message?.content?.trim();
  if (!result || result.toLowerCase() === "null" || result.toLowerCase().includes("cannot determine")) {
    return null;
  }
  return result;
}

async function backfillDonors() {
  console.log("\n=== Backfilling Donor Political Stances ===\n");

  // Find donors that have some political signal but no politicalStance
  const where = {
    politicalStance: null,
    OR: [
      { politicalAffiliation: { not: "UNKNOWN" as const } },
      { description: { not: null } },
    ],
  };

  const totalCount = await prisma.donor.count({ where });
  const effectiveLimit = LIMIT > 0 ? Math.min(LIMIT, totalCount) : totalCount;
  console.log(`Found ${totalCount} donors to process (limit: ${effectiveLimit || "all"})`);

  if (DRY_RUN) {
    const sample = await prisma.donor.findMany({
      where,
      select: { name: true, politicalAffiliation: true, type: true },
      take: 10,
    });
    console.log("\nSample donors to process:");
    for (const d of sample) {
      console.log(`  - ${d.name} (${d.type}, ${d.politicalAffiliation})`);
    }
    return { processed: 0, updated: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  while (processed < effectiveLimit) {
    const batchSize = Math.min(BATCH_SIZE, effectiveLimit - processed);
    const donors = await prisma.donor.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        causes: true,
        politicalAffiliation: true,
      },
      take: batchSize,
      skip: offset,
      orderBy: { dataQualityScore: "desc" },
    });

    if (donors.length === 0) break;

    for (const donor of donors) {
      try {
        const stance = await generatePoliticalStance(
          donor.name,
          donor.description,
          donor.causes,
          donor.politicalAffiliation,
          "donor"
        );

        if (!stance) {
          skipped++;
          processed++;
          continue;
        }

        // Update politicalStance
        await prisma.donor.update({
          where: { id: donor.id },
          data: { politicalStance: stance },
        });

        // Generate and store embedding
        const embedding = await generateEmbedding(stance);
        await prisma.$executeRawUnsafe(
          `UPDATE "Donor" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
          JSON.stringify(embedding),
          donor.id
        );

        updated++;
        processed++;

        if (processed % 10 === 0) {
          console.log(`  [${processed}/${effectiveLimit}] Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
        }
      } catch (err) {
        errors++;
        processed++;
        console.error(`  Error processing donor "${donor.name}":`, err instanceof Error ? err.message : err);
      }
    }

    offset += donors.length;

    // Rate limiting
    if (processed < effectiveLimit) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\nDonor backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  return { processed, updated, skipped, errors };
}

async function backfillOrgs() {
  console.log("\n=== Backfilling Organization Political Stances ===\n");

  const where = {
    politicalStance: null,
    OR: [
      { rawProfileText: { not: null } },
      { mission: { not: null } },
    ],
  };

  const totalCount = await prisma.organization.count({ where });
  console.log(`Found ${totalCount} organizations to process`);

  if (DRY_RUN) {
    const sample = await prisma.organization.findMany({
      where,
      select: { name: true, politicalAffiliation: true },
      take: 10,
    });
    console.log("\nSample orgs to process:");
    for (const o of sample) {
      console.log(`  - ${o.name} (${o.politicalAffiliation})`);
    }
    return { processed: 0, updated: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const orgs = await prisma.organization.findMany({
    where,
    select: {
      id: true,
      name: true,
      mission: true,
      causes: true,
      politicalAffiliation: true,
      rawProfileText: true,
    },
  });

  for (const org of orgs) {
    try {
      const stance = await generatePoliticalStance(
        org.name,
        org.mission,
        org.causes,
        org.politicalAffiliation,
        "org",
        org.rawProfileText
      );

      if (!stance) {
        skipped++;
        processed++;
        continue;
      }

      // Update politicalStance
      await prisma.organization.update({
        where: { id: org.id },
        data: { politicalStance: stance },
      });

      // Generate and store embedding
      const embedding = await generateEmbedding(stance);
      await prisma.$executeRawUnsafe(
        `UPDATE "Organization" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
        JSON.stringify(embedding),
        org.id
      );

      updated++;
      processed++;

      if (processed % 5 === 0) {
        console.log(`  [${processed}/${orgs.length}] Updated: ${updated}, Skipped: ${skipped}`);
      }
    } catch (err) {
      errors++;
      processed++;
      console.error(`  Error processing org "${org.name}":`, err instanceof Error ? err.message : err);
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nOrg backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  return { processed, updated, skipped, errors };
}

async function main() {
  console.log("=== Political Stance & Embedding Backfill ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} donors`);
  console.log();

  const results: { donors?: Awaited<ReturnType<typeof backfillDonors>>; orgs?: Awaited<ReturnType<typeof backfillOrgs>> } = {};

  if (!ORGS_ONLY) {
    results.donors = await backfillDonors();
  }

  if (!DONORS_ONLY) {
    results.orgs = await backfillOrgs();
  }

  console.log("\n=== Summary ===");
  if (results.donors) {
    console.log(`Donors: ${results.donors.updated} updated, ${results.donors.skipped} skipped, ${results.donors.errors} errors`);
  }
  if (results.orgs) {
    console.log(`Orgs: ${results.orgs.updated} updated, ${results.orgs.skipped} skipped, ${results.orgs.errors} errors`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
