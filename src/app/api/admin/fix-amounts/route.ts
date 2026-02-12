/**
 * One-time admin endpoint to fix grant amounts that were stored in wrong units.
 * Normalizes amounts < 1000 to whole US dollars using heuristic rules.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeGrantAmount } from "@/lib/utils/normalize-amount";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check admin status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Find all grants with suspiciously small amounts (< 1000)
    const badGrants = await prisma.donorGrant.findMany({
      where: {
        amount: { not: null, lt: 1000 },
      },
      select: { id: true, donorId: true, amount: true, recipientName: true },
    });

    if (badGrants.length === 0) {
      return NextResponse.json({ message: "No grants need fixing", fixed: 0 });
    }

    // Fix each grant
    let fixedCount = 0;
    const affectedDonorIds = new Set<string>();

    for (const grant of badGrants) {
      if (grant.amount === null) continue;
      const normalized = normalizeGrantAmount(grant.amount);
      if (normalized && normalized !== grant.amount) {
        await prisma.donorGrant.update({
          where: { id: grant.id },
          data: { amount: normalized },
        });
        affectedDonorIds.add(grant.donorId);
        fixedCount++;
      }
    }

    // Recalculate giving stats for affected donors
    for (const donorId of affectedDonorIds) {
      const grants = await prisma.donorGrant.findMany({
        where: { donorId },
        select: { amount: true },
      });

      const amounts = grants
        .map((g) => g.amount)
        .filter((a): a is number => a !== null && a > 0);

      const totalGivingUsd = amounts.length > 0
        ? amounts.reduce((sum, a) => sum + a, 0)
        : null;
      const avgGrantSizeUsd = amounts.length > 0 && totalGivingUsd
        ? totalGivingUsd / amounts.length
        : null;

      await prisma.donor.update({
        where: { id: donorId },
        data: {
          totalGivingUsd,
          avgGrantSizeUsd,
          grantCount: grants.length,
        },
      });
    }

    return NextResponse.json({
      message: `Fixed ${fixedCount} grants across ${affectedDonorIds.size} donors`,
      fixed: fixedCount,
      donorsAffected: affectedDonorIds.size,
    });
  } catch (error) {
    console.error("[fix-amounts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix amounts" },
      { status: 500 }
    );
  }
}
