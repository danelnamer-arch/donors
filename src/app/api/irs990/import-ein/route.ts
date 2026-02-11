import { NextRequest, NextResponse } from "next/server";
import { importFoundationByEin } from "@/lib/irs990";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/irs990/import-ein
 * Import a single foundation by EIN from ProPublica.
 *
 * Body: { ein: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { ein } = await request.json();

    if (!ein || typeof ein !== "string") {
      return NextResponse.json({ error: "ein required (9 digit string)" }, { status: 400 });
    }

    const cleaned = ein.replace(/-/g, "");
    if (!/^\d{9}$/.test(cleaned)) {
      return NextResponse.json({ error: "Invalid EIN — must be 9 digits" }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.donor.findUnique({ where: { ein: cleaned } });
    if (existing) {
      return NextResponse.json({
        message: "Already exists",
        donorId: existing.id,
        name: existing.name,
      });
    }

    const donorId = await importFoundationByEin(cleaned);

    if (!donorId) {
      return NextResponse.json({ error: "Could not import — EIN not found on ProPublica or not a 501(c)(3)" }, { status: 404 });
    }

    const donor = await prisma.donor.findUnique({ where: { id: donorId }, select: { name: true } });

    return NextResponse.json({
      donorId,
      name: donor?.name ?? cleaned,
      message: "Imported successfully",
    });
  } catch (error) {
    console.error("EIN import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
