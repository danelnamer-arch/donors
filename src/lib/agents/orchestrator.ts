/**
 * Research Orchestrator v2 — Coordinates all research agents.
 * Manages the full pipeline: discover → research → extract → verify → store.
 *
 * v2 enhancements:
 * - Gemini for structured data extraction (richer than OpenAI alone)
 * - Website verification via multi-strategy agent
 * - Grant geography analysis → activeRegions
 * - Computes totalGivingUsd, avgGrantSizeUsd, grantCount, givingYearRange
 * - Stores headquartersCountry/City separately from activeRegions
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";
import { extractDonorProfile, analyzeGrantGeography } from "@/lib/gemini";
import { discoverDonorsBySearch, searchForDonorInfo } from "./search-agent";
import { crawlDonorWebsite } from "./crawl-agent";
import { deepDiscoverDonors, deepResearchDonor, deepEnrichDonor } from "./deep-research-agent";
import { validateDonorCandidate } from "./validator-agent";
import { findAndVerifyWebsite } from "./website-verifier";
import type { DonorCandidate } from "./types";

/**
 * Run a full donor discovery pipeline for a given cause/region.
 * This is what runs when a new org signs up or we want to expand the DB.
 */
export async function runDiscoveryPipeline(params: {
  cause: string;
  targetPopulation?: string;
  region?: string;
}): Promise<{
  discovered: number;
  validated: number;
  stored: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let discovered = 0;
  let validated = 0;
  let stored = 0;

  // Step 1: Discover donors via Tavily search + Perplexity deep research
  const [searchResult, deepResult] = await Promise.all([
    discoverDonorsBySearch(params),
    deepDiscoverDonors(params),
  ]);

  // Collect all candidate names from both sources
  const candidateNames = new Set<string>();

  if (searchResult.success && searchResult.data) {
    for (const c of searchResult.data.candidates) {
      candidateNames.add(c.name);
    }
  }

  if (deepResult.success && deepResult.data) {
    for (const d of deepResult.data.parsedDonors) {
      if (d.name) candidateNames.add(d.name);
    }
  }

  discovered = candidateNames.size;

  // Step 2: For each candidate, check if already in DB
  const deepParsedMap = new Map<string, Partial<DonorCandidate>>();
  if (deepResult.success && deepResult.data) {
    for (const d of deepResult.data.parsedDonors) {
      if (d.name) deepParsedMap.set(d.name, d);
    }
  }

  for (const name of candidateNames) {
    try {
      // Skip if already in database
      const existing = await prisma.donor.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) continue;

      // Step 3: Research the donor in more detail
      let donorData: Partial<DonorCandidate> = deepParsedMap.get(name) ?? {};

      // If we don't have deep research data, fetch it
      if (!donorData.description) {
        const research = await deepResearchDonor(name);
        if (research.success && research.data) {
          donorData = { ...donorData, ...research.data };
        }
      }

      // Step 4: Use Gemini to extract structured data from research text
      if (donorData.description && process.env.GEMINI_API_KEY) {
        try {
          const rawText = [
            donorData.description,
            donorData.causes?.join(", "),
            donorData.geographicFocus?.join(", "),
          ].filter(Boolean).join("\n");

          const geminiProfile = await extractDonorProfile(rawText, name);

          // Merge Gemini-extracted data (fills gaps, doesn't overwrite existing)
          donorData = {
            ...donorData,
            headquartersCountry: donorData.headquartersCountry ?? geminiProfile.headquartersCountry ?? undefined,
            headquartersCity: donorData.headquartersCity ?? geminiProfile.headquartersCity ?? undefined,
            activeRegions: mergeArrays(donorData.activeRegions, geminiProfile.activeRegions),
            causes: mergeArrays(donorData.causes, geminiProfile.causes),
            targetPopulations: mergeArrays(donorData.targetPopulations, geminiProfile.targetPopulations),
            geographicFocus: mergeArrays(donorData.geographicFocus, geminiProfile.geographicFocus),
            totalGivingUsd: donorData.totalGivingUsd ?? geminiProfile.totalGivingUsd ?? undefined,
            avgGrantSizeUsd: donorData.avgGrantSizeUsd ?? geminiProfile.avgGrantSizeUsd ?? undefined,
            contactEmail: donorData.contactEmail ?? geminiProfile.email ?? undefined,
            contactPhone: donorData.contactPhone ?? geminiProfile.phone ?? undefined,
            website: donorData.website ?? geminiProfile.website ?? undefined,
            // Merge Gemini grants with existing
            grants: deduplicateGrants([...(donorData.grants ?? []), ...geminiProfile.grants.map(g => ({
              recipientName: g.recipientName,
              amount: g.amount ?? undefined,
              year: g.year ?? undefined,
              purpose: g.purpose ?? undefined,
            }))]),
          };
        } catch (err) {
          console.error(`[orchestrator] Gemini extraction failed for ${name}:`, err);
        }
      }

      // Step 5: If they have a website, crawl it
      if (donorData.website) {
        const crawlResult = await crawlDonorWebsite(donorData.website, name);
        if (crawlResult.success && crawlResult.data) {
          donorData = {
            ...donorData,
            ...crawlResult.data,
            description: donorData.description && donorData.description.length > (crawlResult.data.description?.length ?? 0)
              ? donorData.description
              : crawlResult.data.description ?? donorData.description,
            causes: mergeArrays(donorData.causes, crawlResult.data.causes),
            targetPopulations: mergeArrays(donorData.targetPopulations, crawlResult.data.targetPopulations),
            geographicFocus: mergeArrays(donorData.geographicFocus, crawlResult.data.geographicFocus),
            grants: deduplicateGrants([...(donorData.grants ?? []), ...(crawlResult.data.grants ?? [])]),
            dataSources: [...(donorData.dataSources ?? []), ...(crawlResult.data.dataSources ?? [])],
          };
        }
      }

      // Step 6: Verify website
      try {
        const verification = await findAndVerifyWebsite(name, {
          claimedUrl: donorData.website,
          ein: undefined,
          irsWebsite: undefined,
        });
        donorData.websiteVerified = verification.verified;
        donorData.websiteSource = verification.source;
        if (verification.verified && verification.url) {
          donorData.website = verification.url;
        }
      } catch (err) {
        console.error(`[orchestrator] Website verification failed for ${name}:`, err);
      }

      // Step 7: Analyze grant geography → activeRegions
      if ((donorData.grants?.length ?? 0) > 0 && process.env.GEMINI_API_KEY) {
        try {
          const grantGeo = await analyzeGrantGeography(
            name,
            donorData.grants!.map(g => ({
              recipientName: g.recipientName,
              purpose: g.purpose ?? null,
            }))
          );
          donorData.activeRegions = mergeArrays(donorData.activeRegions, grantGeo);
        } catch (err) {
          console.error(`[orchestrator] Grant geography analysis failed for ${name}:`, err);
        }
      }

      // Step 8: Compute giving statistics
      computeGivingStats(donorData);

      // Step 9: Validate
      const validation = await validateDonorCandidate(donorData);
      if (!validation.success || !validation.data?.isValid) {
        errors.push(`Validation failed for ${name}: ${validation.error ?? "not verifiable"}`);
        continue;
      }
      validated++;

      // Step 10: Store in database
      await storeDonor(donorData, validation.data.dataQualityScore);
      stored++;
    } catch (error) {
      errors.push(
        `Error processing ${name}: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }

  return { discovered, validated, stored, errors };
}

/**
 * Run enrichment for a specific donor (paid feature).
 * v2: Uses Gemini extraction, website verification, grant geography.
 */
export async function runEnrichmentPipeline(donorId: string): Promise<{
  success: boolean;
  enrichedData?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      include: { grants: true, publications: true },
    });

    if (!donor) {
      return { success: false, error: "Donor not found" };
    }

    // Run deep enrichment via Perplexity + web search in parallel
    const [enrichResult, searchResult] = await Promise.all([
      deepEnrichDonor(donor.name, {
        website: donor.website ?? undefined,
        causes: donor.causes,
        description: donor.description ?? undefined,
      }),
      searchForDonorInfo(donor.name),
    ]);

    // Crawl website if available
    let crawlData: Partial<DonorCandidate> | null = null;
    if (donor.website) {
      const crawlResult = await crawlDonorWebsite(donor.website, donor.name);
      if (crawlResult.success) {
        crawlData = crawlResult.data ?? null;
      }
    }

    if (!enrichResult.success || !enrichResult.data) {
      return { success: false, error: enrichResult.error ?? "Enrichment failed" };
    }

    // Merge all data into the donor record
    const profile = enrichResult.data.profile;
    const newGrants = profile.grants ?? [];
    const newPublications = profile.publications ?? [];
    const newSources = [
      ...(profile.dataSources ?? []),
      ...(searchResult.sources ?? []).map((s) => ({
        ...s,
        fetchedAt: new Date().toISOString(),
      })),
    ];

    // Use Gemini to extract structured data from the enrichment report
    let geminiProfile: Awaited<ReturnType<typeof extractDonorProfile>> | null = null;
    if (enrichResult.data.enrichedReport && process.env.GEMINI_API_KEY) {
      try {
        geminiProfile = await extractDonorProfile(enrichResult.data.enrichedReport, donor.name);
      } catch (err) {
        console.error("[orchestrator] Gemini extraction failed during enrichment:", err);
      }
    }

    // Verify website
    let websiteVerified = donor.websiteVerified;
    let websiteSource = donor.websiteSource;
    let verifiedUrl = donor.website;
    try {
      const verification = await findAndVerifyWebsite(donor.name, {
        claimedUrl: donor.website,
        ein: donor.ein,
        irsWebsite: (donor.irsData as { website?: string })?.website ?? null,
      });
      websiteVerified = verification.verified;
      websiteSource = verification.source;
      if (verification.verified && verification.url) {
        verifiedUrl = verification.url;
      }
    } catch (err) {
      console.error("[orchestrator] Website verification failed during enrichment:", err);
    }

    // Analyze grant geography
    const allGrants = [
      ...donor.grants.map(g => ({ recipientName: g.recipientName, purpose: g.purpose })),
      ...newGrants.map(g => ({ recipientName: g.recipientName, purpose: g.purpose ?? null })),
    ];
    let activeRegions = donor.activeRegions;
    if (allGrants.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const grantGeo = await analyzeGrantGeography(donor.name, allGrants);
        activeRegions = [...new Set([...activeRegions, ...grantGeo])];
      } catch (err) {
        console.error("[orchestrator] Grant geography analysis failed:", err);
      }
    }

    // Compute giving stats from all grants
    const allGrantAmounts = [
      ...donor.grants.map(g => g.amount).filter((a): a is number => a !== null),
      ...newGrants.map(g => g.amount).filter((a): a is number | undefined => a != null) as number[],
    ];
    const totalGivingUsd = allGrantAmounts.length > 0
      ? allGrantAmounts.reduce((sum, a) => sum + a, 0)
      : (geminiProfile?.totalGivingUsd ?? donor.totalGivingUsd);
    const avgGrantSizeUsd = allGrantAmounts.length > 0
      ? totalGivingUsd! / allGrantAmounts.length
      : (geminiProfile?.avgGrantSizeUsd ?? donor.avgGrantSizeUsd);
    const grantCount = donor.grants.length + newGrants.length;

    const allYears = [
      ...donor.grants.map(g => g.year).filter((y): y is number => y !== null),
      ...newGrants.map(g => g.year).filter((y): y is number | undefined => y != null) as number[],
    ];
    const givingYearRange = allYears.length > 0
      ? `${Math.min(...allYears)}-${Math.max(...allYears)}`
      : donor.givingYearRange;

    // Update donor with enriched data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.donor.update({
        where: { id: donorId },
        data: {
          description: profile.description ?? donor.description,
          email: profile.contactEmail ?? donor.email,
          phone: profile.contactPhone ?? donor.phone,
          socialLinks: (profile.socialLinks ?? donor.socialLinks) as Record<string, string> | undefined,
          website: verifiedUrl ?? donor.website,
          websiteVerified,
          websiteSource,
          headquartersCountry: geminiProfile?.headquartersCountry ?? donor.headquartersCountry,
          headquartersCity: geminiProfile?.headquartersCity ?? donor.headquartersCity,
          activeRegions,
          causes: profile.causes?.length
            ? [...new Set([...donor.causes, ...profile.causes])]
            : donor.causes,
          targetPopulations: profile.targetPopulations?.length
            ? [...new Set([...donor.targetPopulations, ...profile.targetPopulations])]
            : donor.targetPopulations,
          geographicFocus: profile.geographicFocus?.length
            ? [...new Set([...donor.geographicFocus, ...profile.geographicFocus])]
            : donor.geographicFocus,
          totalGivingUsd,
          avgGrantSizeUsd,
          grantCount,
          givingYearRange,
          dataSources: [...(donor.dataSources as { url: string; title: string; fetchedAt: string }[]), ...newSources],
          lastResearchedAt: new Date(),
          researchStatus: "COMPLETED",
          dataQualityScore: Math.min(1, donor.dataQualityScore + 0.3),
        },
      });

      // Add new grants (deduplicate by recipient + year)
      for (const grant of newGrants) {
        const exists = await tx.donorGrant.findFirst({
          where: {
            donorId,
            recipientName: grant.recipientName,
            year: grant.year,
          },
        });
        if (!exists) {
          await tx.donorGrant.create({
            data: {
              donorId,
              recipientName: grant.recipientName,
              amount: grant.amount,
              year: grant.year,
              purpose: grant.purpose,
              sourceUrl: grant.sourceUrl,
            },
          });
        }
      }

      // Add new publications (deduplicate by URL)
      for (const pub of newPublications) {
        const exists = await tx.donorPublication.findFirst({
          where: { donorId, url: pub.url },
        });
        if (!exists) {
          await tx.donorPublication.create({
            data: {
              donorId,
              title: pub.title,
              type: pub.type as "ARTICLE" | "SOCIAL_MEDIA" | "PODCAST" | "PRESS_RELEASE" | "BLOG_POST" | "VIDEO" | "OTHER",
              url: pub.url,
              summary: pub.summary,
              publishedAt: pub.publishedAt ? new Date(pub.publishedAt) : null,
            },
          });
        }
      }
    });

    // Update embedding with enriched description
    const enrichedDonor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (enrichedDonor) {
      const embeddingText = buildEmbeddingText(enrichedDonor);
      const embedding = await generateEmbedding(embeddingText);
      await prisma.$executeRawUnsafe(
        `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
        JSON.stringify(embedding),
        donorId
      );
    }

    return {
      success: true,
      enrichedData: {
        report: enrichResult.data.enrichedReport,
        newGrantsAdded: newGrants.length,
        newPublicationsAdded: newPublications.length,
        sourcesUsed: newSources.length,
        crawledPages: crawlData ? 1 : 0,
        websiteVerified,
        activeRegions,
        totalGivingUsd,
        grantCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Enrichment failed",
    };
  }
}

/**
 * Store a validated donor candidate in the database.
 * v2: Saves all new enrichment fields.
 */
async function storeDonor(
  candidate: Partial<DonorCandidate>,
  qualityScore: number
): Promise<string> {
  const donor = await prisma.donor.create({
    data: {
      name: candidate.name!,
      type: (candidate.type as "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER") ?? "FOUNDATION",
      description: candidate.description,
      website: candidate.website,
      websiteVerified: candidate.websiteVerified ?? false,
      websiteSource: candidate.websiteSource,
      email: candidate.contactEmail,
      phone: candidate.contactPhone,
      socialLinks: candidate.socialLinks ?? undefined,
      country: candidate.headquartersCountry ?? candidate.country,
      city: candidate.headquartersCity ?? candidate.city,
      headquartersCountry: candidate.headquartersCountry,
      headquartersCity: candidate.headquartersCity,
      activeRegions: candidate.activeRegions ?? [],
      politicalAffiliation: (candidate.politicalAffiliation as "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "NONPARTISAN" | "UNKNOWN") ?? "UNKNOWN",
      causes: candidate.causes ?? [],
      targetPopulations: candidate.targetPopulations ?? [],
      geographicFocus: candidate.geographicFocus ?? [],
      totalGivingUsd: candidate.totalGivingUsd,
      avgGrantSizeUsd: candidate.avgGrantSizeUsd,
      grantCount: candidate.grants?.length ?? 0,
      givingYearRange: candidate.givingYearRange,
      dataSources: candidate.dataSources ?? [],
      dataQualityScore: qualityScore,
      researchStatus: "COMPLETED",
      lastResearchedAt: new Date(),
    },
  });

  // Store grants
  if (candidate.grants?.length) {
    await prisma.donorGrant.createMany({
      data: candidate.grants.map((g) => ({
        donorId: donor.id,
        recipientName: g.recipientName,
        recipientEin: g.recipientEin,
        amount: g.amount,
        currency: g.currency ?? "USD",
        year: g.year,
        purpose: g.purpose,
        sourceUrl: g.sourceUrl,
      })),
    });
  }

  // Store publications
  if (candidate.publications?.length) {
    await prisma.donorPublication.createMany({
      data: candidate.publications.map((p) => ({
        donorId: donor.id,
        title: p.title,
        type: p.type as "ARTICLE" | "SOCIAL_MEDIA" | "PODCAST" | "PRESS_RELEASE" | "BLOG_POST" | "VIDEO" | "OTHER",
        url: p.url,
        summary: p.summary,
        publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
      })),
    });
  }

  // Generate and store embedding
  const embeddingText = buildEmbeddingText(donor);
  const embedding = await generateEmbedding(embeddingText);
  await prisma.$executeRawUnsafe(
    `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
    JSON.stringify(embedding),
    donor.id
  );

  return donor.id;
}

/**
 * Compute giving statistics from grant data.
 */
function computeGivingStats(donorData: Partial<DonorCandidate>): void {
  const grants = donorData.grants ?? [];
  if (grants.length === 0) return;

  const amounts = grants
    .map(g => g.amount)
    .filter((a): a is number => a != null && a > 0);

  if (amounts.length > 0) {
    donorData.totalGivingUsd = donorData.totalGivingUsd ?? amounts.reduce((s, a) => s + a, 0);
    donorData.avgGrantSizeUsd = donorData.avgGrantSizeUsd ?? (donorData.totalGivingUsd! / amounts.length);
  }

  const years = grants
    .map(g => g.year)
    .filter((y): y is number => y != null);

  if (years.length > 0) {
    donorData.givingYearRange = donorData.givingYearRange ?? `${Math.min(...years)}-${Math.max(...years)}`;
  }
}

/**
 * Merge two string arrays, deduplicating case-insensitively.
 */
function mergeArrays(a?: string[], b?: string[]): string[] {
  const combined = [...(a ?? []), ...(b ?? [])];
  const seen = new Set<string>();
  return combined.filter(item => {
    const lower = item.toLowerCase().trim();
    if (seen.has(lower) || !lower) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Deduplicate grants by recipientName + year.
 */
function deduplicateGrants(
  grants: DonorCandidate["grants"]
): DonorCandidate["grants"] {
  const seen = new Set<string>();
  return grants.filter(g => {
    const key = `${g.recipientName.toLowerCase()}|${g.year ?? "?"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build text for embedding generation from donor data.
 */
function buildEmbeddingText(donor: {
  name: string;
  description?: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  activeRegions?: string[];
}): string {
  return [
    donor.name,
    donor.description,
    donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
    donor.geographicFocus.length ? `Geography: ${donor.geographicFocus.join(", ")}` : null,
    donor.activeRegions?.length ? `Active regions: ${donor.activeRegions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}
