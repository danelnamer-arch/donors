/**
 * Seed Israeli NGO Organizations for Design-Partner Testing
 *
 * Creates 3 representative Israeli NGOs so design partners see
 * populated dashboards with real-looking data.
 *
 * Also generates matches for each seeded NGO so the swipe deck
 * is populated immediately.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/seed-israeli-ngos.ts
 *   npx tsx --env-file=.env scripts/seed-israeli-ngos.ts --matches-only  # Skip seeding, just regenerate matches
 */

// Register tsconfig paths so @/ imports resolve outside of Next.js
import "tsconfig-paths/register";

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";
import { generateMatches, storeMatches } from "@/lib/matching/engine";

const args = process.argv.slice(2);
const matchesOnly = args.includes("--matches-only");

// ═══════════════════════════════════════════════════════════════
// SEED DATA: 3 Representative Israeli NGOs
// ═══════════════════════════════════════════════════════════════

interface SeedNGO {
  name: string;
  mission: string;
  website: string;
  country: string;
  location: string;
  size: "SOLO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  annualBudgetRange: string;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  existingDonorNames: string[];
  similarOrgNames: string[];
}

const SEED_NGOS: SeedNGO[] = [
  {
    name: "Leket Israel",
    mission:
      "Leket Israel is the leading food rescue organization in Israel, rescuing surplus nutritious food from farms, manufacturers, and caterers and delivering it to those in need through a network of nonprofit partners. The organization fights food waste while addressing food insecurity across Israel, serving over 200,000 people weekly.",
    website: "https://www.leket.org",
    country: "Israel",
    location: "Ra'anana, Israel",
    size: "LARGE",
    annualBudgetRange: "$20M-$50M",
    causes: [
      "Food Security",
      "Poverty Alleviation",
      "Agriculture",
      "Community Development",
      "Social Services",
    ],
    targetPopulations: [
      "Low-income families",
      "Children",
      "Elderly",
      "Holocaust survivors",
      "Single-parent families",
    ],
    geographicFocus: ["Israel"],
    existingDonorNames: [],
    similarOrgNames: [
      "City Harvest",
      "Feeding America",
      "Table to Table",
      "Latet",
    ],
  },
  {
    name: "ELEM - Youth in Distress in Israel",
    mission:
      "ELEM works with youth in distress across Israel, reaching out to marginalized young people aged 12-26 who are living on the streets, exploited, or at risk. Through street outreach, drop-in centers, and digital platforms, ELEM provides a safety net for youth who fall through the cracks of existing social services.",
    website: "https://www.elem.org.il",
    country: "Israel",
    location: "Tel Aviv, Israel",
    size: "MEDIUM",
    annualBudgetRange: "$5M-$10M",
    causes: [
      "Youth Development",
      "Social Services",
      "Mental Health",
      "Education",
      "Human Rights",
    ],
    targetPopulations: [
      "At-risk youth",
      "Homeless youth",
      "Immigrant youth",
      "Arab youth",
      "Ethiopian-Israeli youth",
    ],
    geographicFocus: ["Israel"],
    existingDonorNames: [],
    similarOrgNames: [
      "Covenant House",
      "Boys Town Jerusalem",
      "Youth Futures Israel",
    ],
  },
  {
    name: "The Public Committee Against Torture in Israel (PCATI)",
    mission:
      "PCATI is a human rights organization that works to eradicate the use of torture and other forms of cruel, inhuman, or degrading treatment in Israel. It provides legal representation to torture victims, advocates for policy reform, and conducts public education campaigns on human rights and the rule of law.",
    website: "https://www.stoptorture.org.il",
    country: "Israel",
    location: "Jerusalem, Israel",
    size: "SMALL",
    annualBudgetRange: "$1M-$3M",
    causes: [
      "Human Rights",
      "Civil Liberties",
      "Legal Aid",
      "Democracy & Governance",
      "Peace & Conflict Resolution",
    ],
    targetPopulations: [
      "Torture victims",
      "Palestinian detainees",
      "Asylum seekers",
      "Prisoners",
    ],
    geographicFocus: ["Israel", "Palestine"],
    existingDonorNames: [],
    similarOrgNames: [
      "B'Tselem",
      "HaMoked",
      "Amnesty International",
      "Human Rights Watch",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// SEED LOGIC
// ═══════════════════════════════════════════════════════════════

async function seedNGOs(): Promise<string[]> {
  const orgIds: string[] = [];

  for (const ngo of SEED_NGOS) {
    // Check if already exists
    const existing = await prisma.organization.findFirst({
      where: { name: { equals: ngo.name, mode: "insensitive" } },
    });

    if (existing) {
      console.log(`  ✓ Already exists: ${ngo.name} (${existing.id})`);
      orgIds.push(existing.id);
      continue;
    }

    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: ngo.name,
        mission: ngo.mission,
        website: ngo.website,
        country: ngo.country,
        location: ngo.location,
        size: ngo.size,
        annualBudgetRange: ngo.annualBudgetRange,
        causes: ngo.causes,
        targetPopulations: ngo.targetPopulations,
        geographicFocus: ngo.geographicFocus,
        existingDonorNames: ngo.existingDonorNames,
        similarOrgNames: ngo.similarOrgNames,
      },
    });

    // Generate and store mission embedding
    const embeddingText = [
      ngo.name,
      ngo.mission,
      `Causes: ${ngo.causes.join(", ")}`,
      `Target populations: ${ngo.targetPopulations.join(", ")}`,
      `Geographic focus: ${ngo.geographicFocus.join(", ")}`,
    ].join(". ");

    try {
      const embedding = await generateEmbedding(embeddingText);
      await prisma.$executeRawUnsafe(
        `UPDATE "Organization" SET "missionEmbedding" = $1::vector WHERE id = $2`,
        JSON.stringify(embedding),
        org.id
      );
      console.log(`  ✓ Created: ${ngo.name} (${org.id}) + embedding`);
    } catch (err) {
      console.warn(`  ✓ Created: ${ngo.name} (${org.id}) [embedding failed: ${err}]`);
    }

    orgIds.push(org.id);
  }

  return orgIds;
}

// ═══════════════════════════════════════════════════════════════
// MATCH GENERATION
// ═══════════════════════════════════════════════════════════════

async function generateMatchesForNGOs(orgIds: string[]): Promise<void> {
  for (let i = 0; i < orgIds.length; i++) {
    const orgId = orgIds[i];
    const ngoName = SEED_NGOS[i]?.name ?? orgId;

    // Check if matches already exist
    const existingCount = await prisma.match.count({
      where: { organizationId: orgId },
    });

    if (existingCount > 0) {
      console.log(`  ℹ ${ngoName} already has ${existingCount} matches — regenerating (deleting old ones)`);
      await prisma.match.deleteMany({ where: { organizationId: orgId } });
    }

    console.log(`  Generating matches for ${ngoName}...`);

    try {
      const matches = await generateMatches(orgId, { limit: 20 });
      await storeMatches(orgId, matches);
      console.log(`  ✓ Generated ${matches.length} matches for ${ngoName}`);

      // Log top 5 matches
      for (const match of matches.slice(0, 5)) {
        const donor = await prisma.donor.findUnique({
          where: { id: match.donorId },
          select: { name: true, type: true },
        });
        console.log(`    • ${donor?.name} (${donor?.type}) — score: ${match.score.toFixed(2)}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to generate matches for ${ngoName}: ${err}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║      FUNDERRA — SEED ISRAELI NGOs + MATCHES            ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  let orgIds: string[];

  if (matchesOnly) {
    console.log("Mode: Matches only (skipping NGO creation)\n");
    console.log("Finding existing NGOs...");
    orgIds = [];
    for (const ngo of SEED_NGOS) {
      const existing = await prisma.organization.findFirst({
        where: { name: { equals: ngo.name, mode: "insensitive" } },
      });
      if (existing) {
        orgIds.push(existing.id);
        console.log(`  Found: ${ngo.name} (${existing.id})`);
      } else {
        console.warn(`  ⚠ Not found: ${ngo.name} — run without --matches-only first`);
      }
    }
  } else {
    console.log("Step 1: Seeding Israeli NGO organizations\n");
    orgIds = await seedNGOs();
  }

  if (orgIds.length === 0) {
    console.error("\nNo organizations to generate matches for. Exiting.");
    process.exit(1);
  }

  console.log(`\nStep 2: Generating matches for ${orgIds.length} NGOs\n`);
  await generateMatchesForNGOs(orgIds);

  // Summary
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    SEEDING COMPLETE                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  for (let i = 0; i < orgIds.length; i++) {
    const orgId = orgIds[i];
    const ngoName = SEED_NGOS[i]?.name ?? orgId;
    const matchCount = await prisma.match.count({ where: { organizationId: orgId } });
    console.log(`  ${ngoName}: ${matchCount} matches`);
  }

  const totalDonors = await prisma.donor.count();
  console.log(`\nTotal donors in DB: ${totalDonors}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeeding failed:", err);
  process.exit(1);
});
