import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateDonorUpdate, validateGrant, validatePublication } from "@/lib/validation/validate-and-normalize";
import { computeQualityScore } from "@/lib/validation/compute-quality-score";

/**
 * POST /api/admin/apply-changes
 * Apply human-approved changes to a donor.
 * All values validated through Zod schemas before writing.
 *
 * Body: { donorId: string, changes: { field: string, value: unknown }[] }
 */
export async function POST(req: NextRequest) {
  const { donorId, changes } = await req.json();

  if (!donorId || !Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "donorId and changes[] required" }, { status: 400 });
  }

  const donor = await prisma.donor.findUnique({ where: { id: donorId } });
  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  // Separate regular field updates from grant/publication additions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldUpdates: Record<string, any> = {};
  const rawGrants: unknown[] = [];
  const rawPubs: unknown[] = [];

  for (const change of changes) {
    if (change.field === "grants" && Array.isArray(change.value)) {
      rawGrants.push(...change.value);
    } else if (change.field === "publications" && Array.isArray(change.value)) {
      rawPubs.push(...change.value);
    } else {
      fieldUpdates[change.field] = change.value;
    }
  }

  let fieldsUpdated = 0;
  let grantsAdded = 0;
  let grantsSkipped = 0;

  // Validate and apply field updates
  if (Object.keys(fieldUpdates).length > 0) {
    const validation = validateDonorUpdate(fieldUpdates);
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }
    const validatedData = validation.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.donor.update({
      where: { id: donorId },
      data: validatedData as any,
    });
    fieldsUpdated = Object.keys(validatedData).length;
  }

  // Validate and add new grants (skip invalid ones)
  for (const rawGrant of rawGrants) {
    const grantValidation = validateGrant(rawGrant);
    if (!grantValidation.success || !grantValidation.data) {
      grantsSkipped++;
      continue;
    }
    const grant = grantValidation.data;
    const exists = await prisma.donorGrant.findFirst({
      where: {
        donorId,
        recipientName: grant.recipientName,
        year: grant.year,
      },
    });
    if (!exists) {
      await prisma.donorGrant.create({
        data: {
          donorId,
          recipientName: grant.recipientName,
          amount: grant.amount ?? null,
          year: grant.year ?? null,
          purpose: grant.purpose ?? null,
          currency: grant.currency,
        },
      });
      grantsAdded++;
    }
  }

  // Validate and add new publications (skip invalid ones)
  let pubsAdded = 0;
  let pubsSkipped = 0;
  for (const rawPub of rawPubs) {
    const pubValidation = validatePublication(rawPub);
    if (!pubValidation.success || !pubValidation.data) {
      pubsSkipped++;
      continue;
    }
    const pub = pubValidation.data;
    const exists = await prisma.donorPublication.findFirst({
      where: { donorId, url: pub.url },
    });
    if (!exists) {
      await prisma.donorPublication.create({
        data: {
          donorId,
          title: pub.title,
          type: pub.type,
          url: pub.url,
          summary: pub.summary ?? null,
        },
      });
      pubsAdded++;
    }
  }

  // Recompute quality score after all changes
  const updatedDonor = await prisma.donor.findUnique({
    where: { id: donorId },
    include: { grants: { select: { id: true } } },
  });
  if (updatedDonor) {
    const newScore = computeQualityScore({
      name: updatedDonor.name,
      description: updatedDonor.description,
      website: updatedDonor.website,
      websiteVerified: updatedDonor.websiteVerified,
      causes: updatedDonor.causes,
      targetPopulations: updatedDonor.targetPopulations,
      geographicFocus: updatedDonor.geographicFocus,
      activeRegions: updatedDonor.activeRegions,
      headquartersCountry: updatedDonor.headquartersCountry,
      headquartersCity: updatedDonor.headquartersCity,
      totalGivingUsd: updatedDonor.totalGivingUsd,
      avgGrantSizeUsd: updatedDonor.avgGrantSizeUsd,
      email: updatedDonor.email,
      phone: updatedDonor.phone,
      grantCount: updatedDonor.grants.length,
      dataSources: (updatedDonor.dataSources ?? []) as unknown[],
    }).total;

    await prisma.donor.update({
      where: { id: donorId },
      data: { dataQualityScore: newScore },
    });
  }

  return NextResponse.json({
    success: true,
    donorId,
    fieldsUpdated,
    grantsAdded,
    grantsSkipped,
    pubsAdded,
    pubsSkipped,
  });
}
