import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/duplicates — Find potential duplicate donors.
 * Uses name similarity and EIN matching.
 */
export async function GET() {
  const donors = await prisma.donor.findMany({
    select: { id: true, name: true, ein: true, website: true, type: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const duplicateGroups: { reason: string; donors: typeof donors }[] = [];

  // Check for EIN duplicates (exact match — should be unique but might have nulls)
  const einMap = new Map<string, typeof donors>();
  for (const d of donors) {
    if (!d.ein) continue;
    const group = einMap.get(d.ein) ?? [];
    group.push(d);
    einMap.set(d.ein, group);
  }
  for (const [ein, group] of einMap) {
    if (group.length > 1) {
      duplicateGroups.push({ reason: `Same EIN: ${ein}`, donors: group });
    }
  }

  // Check for similar names (normalized comparison)
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/^the\s+/i, "")
      .replace(/\s+(foundation|fund|trust|inc|org|llc|ltd)\.?$/i, "")
      .replace(/[^a-z0-9]/g, "");

  const nameMap = new Map<string, typeof donors>();
  for (const d of donors) {
    const key = normalize(d.name);
    if (!key) continue;
    const group = nameMap.get(key) ?? [];
    group.push(d);
    nameMap.set(key, group);
  }
  for (const [, group] of nameMap) {
    if (group.length > 1) {
      const ids = new Set(group.map(d => d.id));
      // Don't add if already found by EIN
      const alreadyFound = duplicateGroups.some(
        g => g.donors.every(d => ids.has(d.id))
      );
      if (!alreadyFound) {
        duplicateGroups.push({ reason: `Similar name`, donors: group });
      }
    }
  }

  // Check for same website domain
  const domainMap = new Map<string, typeof donors>();
  for (const d of donors) {
    if (!d.website) continue;
    try {
      const domain = new URL(d.website).hostname.replace(/^www\./, "");
      const group = domainMap.get(domain) ?? [];
      group.push(d);
      domainMap.set(domain, group);
    } catch {
      // invalid URL, skip
    }
  }
  for (const [domain, group] of domainMap) {
    if (group.length > 1) {
      const ids = new Set(group.map(d => d.id));
      const alreadyFound = duplicateGroups.some(
        g => g.donors.every(d => ids.has(d.id))
      );
      if (!alreadyFound) {
        duplicateGroups.push({ reason: `Same website domain: ${domain}`, donors: group });
      }
    }
  }

  return NextResponse.json({
    totalDonors: donors.length,
    duplicateGroups: duplicateGroups.length,
    groups: duplicateGroups,
  });
}

/**
 * POST /api/admin/duplicates — Merge duplicate donors.
 * Keeps the primary donor and merges data from the secondary.
 */
export async function POST(req: Request) {
  const { primaryId, mergeIds } = await req.json();

  if (!primaryId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
    return NextResponse.json(
      { error: "primaryId and mergeIds[] required" },
      { status: 400 }
    );
  }

  const primary = await prisma.donor.findUnique({
    where: { id: primaryId },
    include: { grants: true, publications: true },
  });

  if (!primary) {
    return NextResponse.json({ error: "Primary donor not found" }, { status: 404 });
  }

  let grantsMerged = 0;
  let pubsMerged = 0;
  let donorsDeleted = 0;

  for (const mergeId of mergeIds) {
    if (mergeId === primaryId) continue;

    const secondary = await prisma.donor.findUnique({
      where: { id: mergeId },
      include: { grants: true, publications: true },
    });

    if (!secondary) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Move grants to primary (skip duplicates)
      for (const grant of secondary.grants) {
        const exists = await tx.donorGrant.findFirst({
          where: {
            donorId: primaryId,
            recipientName: grant.recipientName,
            year: grant.year,
          },
        });
        if (!exists) {
          await tx.donorGrant.update({
            where: { id: grant.id },
            data: { donorId: primaryId },
          });
          grantsMerged++;
        } else {
          await tx.donorGrant.delete({ where: { id: grant.id } });
        }
      }

      // Move publications to primary (skip duplicates)
      for (const pub of secondary.publications) {
        const exists = await tx.donorPublication.findFirst({
          where: { donorId: primaryId, url: pub.url },
        });
        if (!exists) {
          await tx.donorPublication.update({
            where: { id: pub.id },
            data: { donorId: primaryId },
          });
          pubsMerged++;
        } else {
          await tx.donorPublication.delete({ where: { id: pub.id } });
        }
      }

      // Move pipeline entries
      await tx.pipelineEntry.updateMany({
        where: { donorId: mergeId },
        data: { donorId: primaryId },
      });

      // Delete secondary's remaining related records
      await tx.match.deleteMany({ where: { donorId: mergeId } });
      await tx.swipeFeedback.deleteMany({ where: { donorId: mergeId } });

      // Merge arrays from secondary into primary
      const mergedCauses = [...new Set([...primary.causes, ...secondary.causes])];
      const mergedRegions = [...new Set([
        ...(primary.activeRegions ?? []),
        ...(secondary.activeRegions ?? []),
      ])];
      const mergedGeoFocus = [...new Set([...primary.geographicFocus, ...secondary.geographicFocus])];

      await tx.donor.update({
        where: { id: primaryId },
        data: {
          causes: mergedCauses,
          activeRegions: mergedRegions,
          geographicFocus: mergedGeoFocus,
          description: primary.description || secondary.description,
          website: primary.website || secondary.website,
          email: primary.email || secondary.email,
          ein: primary.ein || secondary.ein,
          totalGivingUsd: primary.totalGivingUsd ?? secondary.totalGivingUsd,
          avgGrantSizeUsd: primary.avgGrantSizeUsd ?? secondary.avgGrantSizeUsd,
        },
      });

      // Delete the secondary donor
      await tx.donor.delete({ where: { id: mergeId } });
      donorsDeleted++;
    });
  }

  return NextResponse.json({
    success: true,
    primaryId,
    grantsMerged,
    pubsMerged,
    donorsDeleted,
  });
}
