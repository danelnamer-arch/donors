import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/donors/:id
 * Get a single donor with their grants and publications.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const donor = await prisma.donor.findUnique({
      where: { id },
      include: {
        grants: {
          orderBy: { year: "desc" },
          take: 50,
        },
        publications: {
          orderBy: { publishedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json(donor);
  } catch (error) {
    console.error("Get donor error:", error);
    return NextResponse.json(
      { error: "Failed to fetch donor" },
      { status: 500 }
    );
  }
}
