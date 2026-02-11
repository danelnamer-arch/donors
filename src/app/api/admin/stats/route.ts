import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/stats — Database overview statistics.
 */
export async function GET() {
  const [
    totalDonors,
    byType,
    byStatus,
    totalGrants,
    totalPublications,
    totalMatches,
    verifiedWebsites,
    withActiveRegions,
    withGivingData,
    recentDonors,
  ] = await Promise.all([
    prisma.donor.count(),
    prisma.donor.groupBy({ by: ["type"], _count: true }),
    prisma.donor.groupBy({ by: ["researchStatus"], _count: true }),
    prisma.donorGrant.count(),
    prisma.donorPublication.count(),
    prisma.match.count(),
    prisma.donor.count({ where: { websiteVerified: true } }),
    prisma.donor.count({ where: { activeRegions: { isEmpty: false } } }),
    prisma.donor.count({ where: { totalGivingUsd: { not: null } } }),
    prisma.donor.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, createdAt: true, researchStatus: true },
    }),
  ]);

  return NextResponse.json({
    totalDonors,
    totalGrants,
    totalPublications,
    totalMatches,
    verifiedWebsites,
    withActiveRegions,
    withGivingData,
    byType: Object.fromEntries(byType.map(r => [r.type, r._count])),
    byStatus: Object.fromEntries(byStatus.map(r => [r.researchStatus, r._count])),
    recentDonors,
  });
}
