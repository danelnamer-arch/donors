import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/apply-changes
 * Apply human-approved changes to a donor.
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

  // Separate regular field updates from grant additions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldUpdates: Record<string, any> = {};
  const newGrants: { recipientName: string; amount: number | null; year: number | null; purpose: string | null }[] = [];
  const newPubs: { title: string; url: string; type: string; summary: string | null }[] = [];

  const allowedFields = new Set([
    "name", "type", "description", "website", "websiteVerified", "websiteSource",
    "email", "phone", "country", "city", "headquartersCountry", "headquartersCity",
    "activeRegions", "location", "causes", "targetPopulations", "geographicFocus",
    "totalGivingUsd", "avgGrantSizeUsd", "grantCount", "givingYearRange",
    "dataQualityScore", "researchStatus",
  ]);

  for (const change of changes) {
    if (change.field === "grants" && Array.isArray(change.value)) {
      newGrants.push(...change.value);
    } else if (change.field === "publications" && Array.isArray(change.value)) {
      newPubs.push(...change.value);
    } else if (allowedFields.has(change.field)) {
      fieldUpdates[change.field] = change.value;
    }
  }

  let fieldsUpdated = 0;
  let grantsAdded = 0;

  // Apply field updates
  if (Object.keys(fieldUpdates).length > 0) {
    await prisma.donor.update({
      where: { id: donorId },
      data: fieldUpdates,
    });
    fieldsUpdated = Object.keys(fieldUpdates).length;
  }

  // Add new grants
  for (const grant of newGrants) {
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
          amount: grant.amount,
          year: grant.year,
          purpose: grant.purpose,
          currency: "USD",
        },
      });
      grantsAdded++;
    }
  }

  // Add new publications
  let pubsAdded = 0;
  for (const pub of newPubs) {
    const exists = await prisma.donorPublication.findFirst({
      where: { donorId, url: pub.url },
    });
    if (!exists) {
      await prisma.donorPublication.create({
        data: {
          donorId,
          title: pub.title,
          type: pub.type as "ARTICLE" | "SOCIAL_MEDIA" | "PODCAST" | "PRESS_RELEASE" | "BLOG_POST" | "VIDEO" | "OTHER",
          url: pub.url,
          summary: pub.summary,
        },
      });
      pubsAdded++;
    }
  }

  return NextResponse.json({
    success: true,
    donorId,
    fieldsUpdated,
    grantsAdded,
    pubsAdded,
  });
}
