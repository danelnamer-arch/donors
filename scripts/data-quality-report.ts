/**
 * Data Quality Report
 * Analyzes the donor database for completeness and quality.
 */

import "tsconfig-paths/register";
import { prisma } from "@/lib/prisma";

async function main() {
  const total = await prisma.donor.count();

  // Missing fields
  const noDesc = await prisma.donor.count({ where: { description: null } });
  const noWebsite = await prisma.donor.count({ where: { website: null } });
  const noCauses = await prisma.donor.count({ where: { causes: { isEmpty: true } } });
  const noGeoFocus = await prisma.donor.count({ where: { geographicFocus: { isEmpty: true } } });
  const noTargetPop = await prisma.donor.count({ where: { targetPopulations: { isEmpty: true } } });
  const noGiving = await prisma.donor.count({ where: { totalGivingUsd: null } });
  const noEmail = await prisma.donor.count({ where: { email: null } });
  const noPhone = await prisma.donor.count({ where: { phone: null } });
  const noHqCountry = await prisma.donor.count({ where: { headquartersCountry: null } });

  // Quality score distribution
  const avgQuality = await prisma.donor.aggregate({ _avg: { dataQualityScore: true } });
  const lowQuality = await prisma.donor.count({ where: { dataQualityScore: { lt: 0.4 } } });
  const medQuality = await prisma.donor.count({ where: { dataQualityScore: { gte: 0.4, lt: 0.7 } } });
  const highQuality = await prisma.donor.count({ where: { dataQualityScore: { gte: 0.7 } } });

  // By type
  const byType = await prisma.donor.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } });

  // Research status
  const byStatus = await prisma.donor.groupBy({
    by: ["researchStatus"],
    _count: true,
    orderBy: { _count: { researchStatus: "desc" } },
  });

  // Grants
  const totalGrants = await prisma.donorGrant.count();
  const donorsWithGrants = await prisma.donor.count({ where: { grantCount: { gt: 0 } } });

  // Website verified
  const verified = await prisma.donor.count({ where: { websiteVerified: true } });
  const hasWebsite = await prisma.donor.count({ where: { NOT: { website: null } } });

  // EIN coverage
  const hasEin = await prisma.donor.count({ where: { NOT: { ein: null } } });

  // Donors missing description but have other data (Gemini enrichment candidates)
  const noDescButHasData = await prisma.donor.count({
    where: {
      description: null,
      NOT: { causes: { isEmpty: true } },
    },
  });

  // Donors with very low quality scores
  const veryLow = await prisma.donor.count({ where: { dataQualityScore: { lt: 0.2 } } });

  // Top causes
  const allDonors = await prisma.donor.findMany({ select: { causes: true } });
  const causeCounts: Record<string, number> = {};
  for (const d of allDonors) {
    for (const c of d.causes) {
      causeCounts[c] = (causeCounts[c] || 0) + 1;
    }
  }
  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Giving distribution
  const givingBuckets = await prisma.$queryRaw<{ bucket: string; count: number }[]>`
    SELECT bucket, count FROM (
      SELECT
        CASE
          WHEN "totalGivingUsd" IS NULL THEN 'Unknown'
          WHEN "totalGivingUsd" < 1000000 THEN 'Under $1M'
          WHEN "totalGivingUsd" < 10000000 THEN '$1M-$10M'
          WHEN "totalGivingUsd" < 100000000 THEN '$10M-$100M'
          WHEN "totalGivingUsd" < 1000000000 THEN '$100M-$1B'
          ELSE 'Over $1B'
        END as bucket,
        COUNT(*)::int as count,
        CASE
          WHEN "totalGivingUsd" IS NULL THEN 6
          WHEN "totalGivingUsd" < 1000000 THEN 5
          WHEN "totalGivingUsd" < 10000000 THEN 4
          WHEN "totalGivingUsd" < 100000000 THEN 3
          WHEN "totalGivingUsd" < 1000000000 THEN 2
          ELSE 1
        END as sort_order
      FROM "Donor"
      GROUP BY bucket, sort_order
    ) sub
    ORDER BY sort_order
  `;

  console.log("\n═══════════════════════════════════════════════");
  console.log("        DONOR DATABASE — DATA QUALITY REPORT");
  console.log("═══════════════════════════════════════════════");
  console.log(`\n  Total donors: ${total}`);

  console.log(`\n── FIELD COVERAGE ──────────────────────────────`);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  console.log(`  Description:     ${total - noDesc}/${total} (${pct(total - noDesc)})`);
  console.log(`  Website:         ${hasWebsite}/${total} (${pct(hasWebsite)}) — ${verified} verified`);
  console.log(`  Email:           ${total - noEmail}/${total} (${pct(total - noEmail)})`);
  console.log(`  Phone:           ${total - noPhone}/${total} (${pct(total - noPhone)})`);
  console.log(`  HQ Country:      ${total - noHqCountry}/${total} (${pct(total - noHqCountry)})`);
  console.log(`  EIN:             ${hasEin}/${total} (${pct(hasEin)})`);
  console.log(`  Causes:          ${total - noCauses}/${total} (${pct(total - noCauses)})`);
  console.log(`  Geo Focus:       ${total - noGeoFocus}/${total} (${pct(total - noGeoFocus)})`);
  console.log(`  Target Pops:     ${total - noTargetPop}/${total} (${pct(total - noTargetPop)})`);
  console.log(`  Total Giving:    ${total - noGiving}/${total} (${pct(total - noGiving)})`);
  console.log(`  Has Grants:      ${donorsWithGrants}/${total} (${pct(donorsWithGrants)}) — ${totalGrants} grant records`);

  console.log(`\n── QUALITY SCORE DISTRIBUTION ──────────────────`);
  console.log(`  Very Low (<0.2): ${veryLow} (${pct(veryLow)})`);
  console.log(`  Low (0.2-0.4):   ${lowQuality - veryLow} (${pct(lowQuality - veryLow)})`);
  console.log(`  Medium (0.4-0.7): ${medQuality} (${pct(medQuality)})`);
  console.log(`  High (≥0.7):     ${highQuality} (${pct(highQuality)})`);
  console.log(`  Average score:   ${(avgQuality._avg.dataQualityScore ?? 0).toFixed(3)}`);

  console.log(`\n── BY TYPE ─────────────────────────────────────`);
  for (const t of byType) console.log(`  ${t.type.padEnd(14)} ${t._count}`);

  console.log(`\n── RESEARCH STATUS ─────────────────────────────`);
  for (const s of byStatus) console.log(`  ${s.researchStatus.padEnd(14)} ${s._count}`);

  console.log(`\n── GIVING SIZE DISTRIBUTION ────────────────────`);
  for (const b of givingBuckets) console.log(`  ${String(b.bucket).padEnd(14)} ${b.count}`);

  console.log(`\n── TOP 15 CAUSES ──────────────────────────────`);
  for (const [cause, count] of topCauses) console.log(`  ${String(count).padStart(4)}  ${cause}`);

  console.log(`\n── ENRICHMENT CANDIDATES ───────────────────────`);
  console.log(`  No description:           ${noDesc}`);
  console.log(`  No desc but has causes:   ${noDescButHasData} (can enrich from existing data)`);
  console.log(`  Quality < 0.4:            ${lowQuality} (enrichment targets)`);

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
