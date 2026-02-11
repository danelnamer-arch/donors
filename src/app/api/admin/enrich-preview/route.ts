import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractDonorProfile, analyzeGrantGeography } from "@/lib/gemini";
import { findAndVerifyWebsite } from "@/lib/agents/website-verifier";
import { deepResearchDonor, deepEnrichDonor } from "@/lib/agents/deep-research-agent";
import { searchForDonorInfo } from "@/lib/agents/search-agent";
import { crawlDonorWebsite } from "@/lib/agents/crawl-agent";

export interface ProposedChange {
  field: string;
  label: string;
  currentValue: unknown;
  proposedValue: unknown;
  source: string;
  confidence: number; // 0-1
}

/**
 * POST /api/admin/enrich-preview
 * Runs enrichment for a donor but does NOT save — returns proposed changes for human approval.
 *
 * Body: { donorId: string, scope: "full" | "website" | "geography" | "giving" | "description" | "causes" }
 */
export async function POST(req: NextRequest) {
  const { donorId, scope = "full" } = await req.json();

  if (!donorId) {
    return NextResponse.json({ error: "donorId required" }, { status: 400 });
  }

  const donor = await prisma.donor.findUnique({
    where: { id: donorId },
    include: { grants: true },
  });

  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  const proposals: ProposedChange[] = [];

  try {
    // Website verification
    if (scope === "full" || scope === "website") {
      try {
        const verification = await findAndVerifyWebsite(donor.name, {
          claimedUrl: donor.website,
          ein: donor.ein,
          irsWebsite: (donor.irsData as { website?: string })?.website ?? null,
        });

        if (verification.url && verification.url !== donor.website) {
          proposals.push({
            field: "website",
            label: "Website URL",
            currentValue: donor.website,
            proposedValue: verification.url,
            source: `Website verifier (${verification.source})`,
            confidence: verification.confidence,
          });
        }

        if (verification.verified !== donor.websiteVerified) {
          proposals.push({
            field: "websiteVerified",
            label: "Website Verified",
            currentValue: donor.websiteVerified,
            proposedValue: verification.verified,
            source: `Website verifier (${verification.source})`,
            confidence: verification.confidence,
          });
        }

        if (verification.source && verification.source !== donor.websiteSource) {
          proposals.push({
            field: "websiteSource",
            label: "Verification Source",
            currentValue: donor.websiteSource,
            proposedValue: verification.source,
            source: "Website verifier",
            confidence: verification.confidence,
          });
        }
      } catch (err) {
        console.error("[enrich-preview] Website verification error:", err);
      }
    }

    // Deep research + Gemini extraction
    if (scope === "full" || scope === "description" || scope === "causes" || scope === "giving") {
      let rawText = "";

      // Try to get research from multiple sources
      try {
        const [researchResult, searchResult] = await Promise.all([
          deepResearchDonor(donor.name),
          searchForDonorInfo(donor.name),
        ]);

        if (researchResult.success && researchResult.data?.description) {
          rawText += researchResult.data.description + "\n";
        }

        if (searchResult.success && searchResult.data) {
          // Combine search results into text for Gemini
          for (const item of (searchResult.data.details ?? [])) {
            if (item.content) rawText += item.content + "\n";
          }
        }
      } catch (err) {
        console.error("[enrich-preview] Research error:", err);
      }

      // Also try crawling the website for more data
      if (donor.website) {
        try {
          const crawlResult = await crawlDonorWebsite(donor.website, donor.name);
          if (crawlResult.success && crawlResult.data?.description) {
            rawText += crawlResult.data.description + "\n";
          }
        } catch (err) {
          console.error("[enrich-preview] Crawl error:", err);
        }
      }

      // Use Gemini to extract structured data
      if (rawText.length > 50 && process.env.GEMINI_API_KEY) {
        try {
          const profile = await extractDonorProfile(rawText, donor.name);

          if (scope === "full" || scope === "description") {
            if (profile.description && profile.description !== donor.description) {
              proposals.push({
                field: "description",
                label: "Description",
                currentValue: donor.description,
                proposedValue: profile.description,
                source: "Gemini extraction from Perplexity + Tavily research",
                confidence: 0.75,
              });
            }

            if (profile.email && profile.email !== donor.email) {
              proposals.push({
                field: "email",
                label: "Email",
                currentValue: donor.email,
                proposedValue: profile.email,
                source: "Gemini extraction",
                confidence: 0.6,
              });
            }

            if (profile.phone && profile.phone !== donor.phone) {
              proposals.push({
                field: "phone",
                label: "Phone",
                currentValue: donor.phone,
                proposedValue: profile.phone,
                source: "Gemini extraction",
                confidence: 0.6,
              });
            }
          }

          if (scope === "full" || scope === "causes") {
            const newCauses = profile.causes.filter(c => !donor.causes.some(dc => dc.toLowerCase() === c.toLowerCase()));
            if (newCauses.length > 0) {
              proposals.push({
                field: "causes",
                label: "Causes",
                currentValue: donor.causes,
                proposedValue: [...donor.causes, ...newCauses],
                source: "Gemini extraction",
                confidence: 0.7,
              });
            }

            const newPops = profile.targetPopulations.filter(p => !donor.targetPopulations.some(dp => dp.toLowerCase() === p.toLowerCase()));
            if (newPops.length > 0) {
              proposals.push({
                field: "targetPopulations",
                label: "Target Populations",
                currentValue: donor.targetPopulations,
                proposedValue: [...donor.targetPopulations, ...newPops],
                source: "Gemini extraction",
                confidence: 0.7,
              });
            }
          }

          if (scope === "full" || scope === "giving") {
            if (profile.totalGivingUsd && profile.totalGivingUsd !== donor.totalGivingUsd) {
              proposals.push({
                field: "totalGivingUsd",
                label: "Total Giving (USD)",
                currentValue: donor.totalGivingUsd,
                proposedValue: profile.totalGivingUsd,
                source: "Gemini extraction",
                confidence: 0.6,
              });
            }

            if (profile.avgGrantSizeUsd && profile.avgGrantSizeUsd !== donor.avgGrantSizeUsd) {
              proposals.push({
                field: "avgGrantSizeUsd",
                label: "Avg Grant Size (USD)",
                currentValue: donor.avgGrantSizeUsd,
                proposedValue: profile.avgGrantSizeUsd,
                source: "Gemini extraction",
                confidence: 0.6,
              });
            }

            // Propose new grants
            if (profile.grants.length > 0) {
              const existingKeys = new Set(
                donor.grants.map(g => `${g.recipientName.toLowerCase()}|${g.year ?? "?"}`)
              );
              const newGrants = profile.grants.filter(
                g => !existingKeys.has(`${g.recipientName.toLowerCase()}|${g.year ?? "?"}`)
              );
              if (newGrants.length > 0) {
                proposals.push({
                  field: "grants",
                  label: "New Grants",
                  currentValue: `${donor.grants.length} existing grants`,
                  proposedValue: newGrants,
                  source: "Gemini extraction from research data",
                  confidence: 0.65,
                });
              }
            }
          }

          if (scope === "full" || scope === "geography") {
            if (profile.headquartersCountry && profile.headquartersCountry !== donor.headquartersCountry) {
              proposals.push({
                field: "headquartersCountry",
                label: "HQ Country",
                currentValue: donor.headquartersCountry,
                proposedValue: profile.headquartersCountry,
                source: "Gemini extraction",
                confidence: 0.7,
              });
            }

            if (profile.headquartersCity && profile.headquartersCity !== donor.headquartersCity) {
              proposals.push({
                field: "headquartersCity",
                label: "HQ City",
                currentValue: donor.headquartersCity,
                proposedValue: profile.headquartersCity,
                source: "Gemini extraction",
                confidence: 0.7,
              });
            }

            const newGeoFocus = profile.geographicFocus.filter(
              g => !donor.geographicFocus.some(dg => dg.toLowerCase() === g.toLowerCase())
            );
            if (newGeoFocus.length > 0) {
              proposals.push({
                field: "geographicFocus",
                label: "Geographic Focus",
                currentValue: donor.geographicFocus,
                proposedValue: [...donor.geographicFocus, ...newGeoFocus],
                source: "Gemini extraction",
                confidence: 0.7,
              });
            }
          }
        } catch (err) {
          console.error("[enrich-preview] Gemini extraction error:", err);
        }
      }
    }

    // Grant geography analysis
    if ((scope === "full" || scope === "geography") && donor.grants.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const grantGeo = await analyzeGrantGeography(
          donor.name,
          donor.grants.map(g => ({ recipientName: g.recipientName, purpose: g.purpose }))
        );
        const newRegions = grantGeo.filter(
          r => !(donor.activeRegions ?? []).some(ar => ar.toLowerCase() === r.toLowerCase())
        );
        if (newRegions.length > 0) {
          proposals.push({
            field: "activeRegions",
            label: "Active Regions",
            currentValue: donor.activeRegions,
            proposedValue: [...(donor.activeRegions ?? []), ...newRegions],
            source: "Gemini grant geography analysis",
            confidence: 0.75,
          });
        }
      } catch (err) {
        console.error("[enrich-preview] Grant geography error:", err);
      }
    }

    return NextResponse.json({
      donorId: donor.id,
      donorName: donor.name,
      scope,
      proposals,
      proposalCount: proposals.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment preview failed" },
      { status: 500 }
    );
  }
}
