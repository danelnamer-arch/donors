import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/donors/[id] — Full donor details for admin editing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const donor = await prisma.donor.findUnique({
    where: { id },
    include: {
      grants: { orderBy: { year: "desc" } },
      publications: { orderBy: { publishedAt: "desc" } },
      _count: { select: { matches: true, pipelineEntries: true } },
    },
  });

  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  return NextResponse.json(donor);
}

/**
 * PATCH /api/admin/donors/[id] — Update donor fields.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await req.json();

  // Only allow updating safe fields
  const allowedFields = [
    "name", "type", "description", "website", "websiteVerified", "websiteSource",
    "email", "phone", "country", "city", "headquartersCountry", "headquartersCity",
    "activeRegions", "location", "politicalAffiliation", "causes", "targetPopulations",
    "geographicFocus", "totalGivingUsd", "avgGrantSizeUsd", "grantCount",
    "givingYearRange", "dataQualityScore", "researchStatus", "ein",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  for (const key of allowedFields) {
    if (key in data) {
      updateData[key] = data[key];
    }
  }

  const donor = await prisma.donor.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(donor);
}

/**
 * DELETE /api/admin/donors/[id] — Delete a single donor.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Delete related records first
  await prisma.$transaction([
    prisma.donorGrant.deleteMany({ where: { donorId: id } }),
    prisma.donorPublication.deleteMany({ where: { donorId: id } }),
    prisma.match.deleteMany({ where: { donorId: id } }),
    prisma.pipelineEntry.deleteMany({ where: { donorId: id } }),
    prisma.swipeFeedback.deleteMany({ where: { donorId: id } }),
    prisma.donor.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
