import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";

/**
 * POST /api/onboarding
 * Create an organization and link the current user to it.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      orgName,
      mission,
      website,
      country,
      size,
      causes,
      targetPopulations,
      geographicFocus,
      similarOrgNames,
      existingDonorNames,
    } = body;

    if (!orgName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Create the organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        mission: mission || null,
        website: website || null,
        country: country || null,
        size: size || null,
        causes: causes || [],
        targetPopulations: targetPopulations || [],
        geographicFocus: geographicFocus || [],
        similarOrgNames: similarOrgNames || [],
        existingDonorNames: existingDonorNames || [],
      },
    });

    // Link user to organization
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    });

    // Generate mission embedding in background (don't block the response)
    if (mission) {
      generateEmbedding(
        [
          mission,
          causes?.length ? `Causes: ${causes.join(", ")}` : "",
          targetPopulations?.length
            ? `Populations: ${targetPopulations.join(", ")}`
            : "",
          geographicFocus?.length
            ? `Geographic focus: ${geographicFocus.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join(". ")
      )
        .then(async (embedding) => {
          await prisma.$executeRawUnsafe(
            `UPDATE "Organization" SET "missionEmbedding" = $1::vector WHERE id = $2`,
            JSON.stringify(embedding),
            org.id
          );
        })
        .catch((err) => {
          console.error("Failed to generate org embedding:", err);
        });
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Onboarding failed" },
      { status: 500 }
    );
  }
}
