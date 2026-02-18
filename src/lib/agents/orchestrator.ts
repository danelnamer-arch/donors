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
import { generateEmbedding, extractDonorProfileOpenAI, analyzeGrantGeographyOpenAI } from "@/lib/openai";
import { extractDonorProfile as extractDonorProfileGemini, analyzeGrantGeography as analyzeGrantGeographyGemini } from "@/lib/gemini";
import { discoverDonorsBySearch, searchForDonorInfo } from "./search-agent";
import { crawlDonorWebsite } from "./crawl-agent";
import { deepDiscoverDonors, deepResearchDonor, deepEnrichDonor } from "./deep-research-agent";
import { validateDonorCandidate } from "./validator-agent";
import { findAndVerifyWebsite } from "./website-verifier";
import { normalizeGrantAmount, normalizeTotalGiving } from "@/lib/utils/normalize-amount";
import { validateDonorCreate, validateGrant } from "@/lib/validation/validate-and-normalize";
import { computeQualityScore } from "@/lib/validation/compute-quality-score";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import type { DonorCandidate } from "./types";

// ─── Provider Selection Layer ────────────────────────────────────
// Configurable via EXTRACTION_PROVIDER env var (default: "openai")
// This avoids Gemini 429 rate limits while keeping Gemini as fallback.

const extractionProvider = process.env.EXTRACTION_PROVIDER?.toLowerCase() ?? "openai";

/**
 * Extract structured donor profile — routes to OpenAI or Gemini.
 * Exported for use in marathon-runner.ts.
 */
export async function extractProfile(rawText: string, donorName: string) {
  if (extractionProvider === "gemini" && process.env.GEMINI_API_KEY) {
    return extractDonorProfileGemini(rawText, donorName);
  }
  return extractDonorProfileOpenAI(rawText, donorName);
}

/**
 * Analyze grant geography — routes to OpenAI or Gemini.
 * Exported for use in marathon-runner.ts.
 */
export async function analyzeGeo(
  donorName: string,
  grants: { recipientName: string; purpose: string | null }[]
) {
  if (extractionProvider === "gemini" && process.env.GEMINI_API_KEY) {
    return analyzeGrantGeographyGemini(donorName, grants);
  }
  return analyzeGrantGeographyOpenAI(donorName, grants);
}

/**
 * Run a full donor discovery pipeline for a given cause/region.
 * This is what runs when a new org signs up or we want to expand the DB.
 */
export async function runDiscoveryPipeline(params: {
  cause: string;
  targetPopulation?: string;
  region?: string;
  /** Hint for discovery to focus on individual donors vs foundations */
  donorTypeHint?: "INDIVIDUAL" | "FOUNDATION";
  /** Optional pre-check: skip candidate if this returns true (for marathon dedup) */
  shouldSkip?: (name: string) => boolean;
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

  // Pre-load existing donor names for the region to reduce Perplexity duplicates
  let existingNames: string[] = [];
  try {
    const regionFilter = params.region ? { geographicFocus: { has: params.region } } : {};
    const existingDonors = await prisma.donor.findMany({
      where: regionFilter,
      select: { name: true },
      orderBy: { dataQualityScore: "desc" },
      take: 50,
    });
    existingNames = existingDonors.map((d) => d.name);
  } catch {
    // Non-critical — continue without exclusion list
  }

  // Step 1: Discover donors via Tavily search + Perplexity deep research
  const [searchResult, deepResult] = await Promise.all([
    discoverDonorsBySearch(params),
    deepDiscoverDonors({
      cause: params.cause,
      targetPopulation: params.targetPopulation,
      region: params.region,
      donorTypeHint: params.donorTypeHint,
      existingDonorNames: existingNames,
    }),
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
      // Fast pre-check via marathon dedup (avoids DB query if already known)
      if (params.shouldSkip?.(name)) continue;

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

      // Skip-extraction guard: if candidate has no description AND no website,
      // skip Steps 4-7 entirely (saves 3 API calls + crawl + search per empty candidate)
      if (!donorData.description && !donorData.website) {
        console.log(`[orchestrator] Skipping empty candidate: ${name} (no description or website)`);
        continue;
      }

      // Step 4: Extract structured data (OpenAI or Gemini via provider config)
      if (donorData.description) {
        try {
          const rawText = [
            donorData.description,
            donorData.causes?.join(", "),
            donorData.geographicFocus?.join(", "),
          ].filter(Boolean).join("\n");

          const geminiProfile = await extractProfile(rawText, name);

          // Merge Gemini-extracted data (fills gaps, doesn't overwrite existing)
          donorData = {
            ...donorData,
            headquartersCountry: donorData.headquartersCountry ?? geminiProfile.headquartersCountry ?? undefined,
            headquartersCity: donorData.headquartersCity ?? geminiProfile.headquartersCity ?? undefined,
            activeRegions: mergeArrays(donorData.activeRegions, geminiProfile.activeRegions),
            causes: mergeArrays(donorData.causes, geminiProfile.causes),
            targetAudience: donorData.targetAudience ?? geminiProfile.targetPopulations?.join(", ") ?? undefined,
            geographicFocus: mergeArrays(donorData.geographicFocus, geminiProfile.geographicFocus),
            totalGivingUsd: normalizeTotalGiving(donorData.totalGivingUsd ?? geminiProfile.totalGivingUsd) ?? undefined,
            avgGrantSizeUsd: normalizeGrantAmount(donorData.avgGrantSizeUsd ?? geminiProfile.avgGrantSizeUsd) ?? undefined,
            contactEmail: donorData.contactEmail ?? geminiProfile.email ?? undefined,
            contactPhone: donorData.contactPhone ?? geminiProfile.phone ?? undefined,
            website: donorData.website ?? geminiProfile.website ?? undefined,
            // Merge Gemini grants with existing, normalizing amounts
            grants: deduplicateGrants([...(donorData.grants ?? []), ...geminiProfile.grants.map(g => ({
              recipientName: g.recipientName,
              amount: normalizeGrantAmount(g.amount),
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
            targetAudience: donorData.targetAudience ?? crawlResult.data.targetAudience,
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
      if ((donorData.grants?.length ?? 0) > 0) {
        try {
          const grantGeo = await analyzeGeo(
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

    // Merge all data into the donor record, normalizing grant amounts
    const profile = enrichResult.data.profile;
    const newGrants = (profile.grants ?? []).map(g => ({
      ...g,
      amount: normalizeGrantAmount(g.amount),
    }));
    const newPublications = profile.publications ?? [];
    const newSources = [
      ...(profile.dataSources ?? []),
      ...(searchResult.sources ?? []).map((s) => ({
        ...s,
        fetchedAt: new Date().toISOString(),
      })),
    ];

    // Extract structured data from the enrichment report (OpenAI or Gemini)
    let geminiProfile: Awaited<ReturnType<typeof extractProfile>> | null = null;
    if (enrichResult.data.enrichedReport) {
      try {
        geminiProfile = await extractProfile(enrichResult.data.enrichedReport, donor.name);
      } catch (err) {
        console.error("[orchestrator] Extraction failed during enrichment:", err);
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
    if (allGrants.length > 0) {
      try {
        const grantGeo = await analyzeGeo(donor.name, allGrants);
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
      : normalizeTotalGiving(geminiProfile?.totalGivingUsd ?? donor.totalGivingUsd);
    const avgGrantSizeUsd = allGrantAmounts.length > 0
      ? totalGivingUsd! / allGrantAmounts.length
      : normalizeGrantAmount(geminiProfile?.avgGrantSizeUsd ?? donor.avgGrantSizeUsd);
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
            ? normalizeCauses([...new Set([...donor.causes, ...profile.causes])])
            : donor.causes,
          targetPopulations: profile.targetAudience
            ? [profile.targetAudience, ...donor.targetPopulations.filter((t) => t !== profile.targetAudience)]
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
          // Recompute quality score deterministically from enriched state
          dataQualityScore: computeQualityScore({
            name: donor.name,
            description: profile.description ?? donor.description,
            website: verifiedUrl ?? donor.website,
            websiteVerified,
            causes: profile.causes?.length
              ? normalizeCauses([...new Set([...donor.causes, ...profile.causes])])
              : donor.causes,
            targetPopulations: profile.targetAudience
              ? [profile.targetAudience, ...donor.targetPopulations.filter((t) => t !== profile.targetAudience)]
              : donor.targetPopulations,
            geographicFocus: profile.geographicFocus?.length
              ? [...new Set([...donor.geographicFocus, ...profile.geographicFocus])]
              : donor.geographicFocus,
            activeRegions,
            headquartersCountry: geminiProfile?.headquartersCountry ?? donor.headquartersCountry,
            headquartersCity: geminiProfile?.headquartersCity ?? donor.headquartersCity,
            totalGivingUsd: totalGivingUsd ?? undefined,
            avgGrantSizeUsd: avgGrantSizeUsd ?? undefined,
            email: profile.contactEmail ?? donor.email,
            phone: profile.contactPhone ?? donor.phone,
            grantCount,
            dataSources: [...(donor.dataSources as unknown[]), ...newSources],
          }).total,
        },
      });

      // Add new grants (deduplicate by recipient + year, skip entries with null recipient)
      for (const grant of newGrants) {
        if (!grant.recipientName) continue;
        const exists = await tx.donorGrant.findFirst({
          where: {
            donorId,
            recipientName: grant.recipientName,
            year: grant.year ?? undefined,
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

      // Add new publications (deduplicate by URL, skip entries with null URL)
      for (const pub of newPublications) {
        if (!pub.url) continue;
        const exists = await tx.donorPublication.findFirst({
          where: { donorId, url: pub.url },
        });
        if (!exists) {
          await tx.donorPublication.create({
            data: {
              donorId,
              title: pub.title || "Untitled",
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

      // Update political embedding if political stance is available
      if (enrichedDonor.politicalStance) {
        try {
          const polEmb = await generateEmbedding(enrichedDonor.politicalStance);
          await prisma.$executeRawUnsafe(
            `UPDATE "Donor" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
            JSON.stringify(polEmb),
            donorId
          );
        } catch (err) {
          console.warn("[orchestrator] Failed to update political embedding on enrichment:", err);
        }
      }
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
 * v3: Validates through Zod schemas, computes quality score deterministically,
 *     normalizes causes, and validates grants before writing.
 */
async function storeDonor(
  candidate: Partial<DonorCandidate>,
  aiQualityScore: number
): Promise<string> {
  // Validate and normalize through Zod + quality scoring
  const validation = validateDonorCreate(
    {
      name: candidate.name,
      type: candidate.type ?? "FOUNDATION",
      description: candidate.description,
      website: candidate.website,
      websiteVerified: candidate.websiteVerified ?? false,
      websiteSource: candidate.websiteSource,
      email: candidate.contactEmail,
      phone: candidate.contactPhone,
      socialLinks: candidate.socialLinks,
      country: candidate.headquartersCountry ?? candidate.country,
      city: candidate.headquartersCity ?? candidate.city,
      headquartersCountry: candidate.headquartersCountry,
      headquartersCity: candidate.headquartersCity,
      activeRegions: candidate.activeRegions ?? [],
      politicalAffiliation: candidate.politicalAffiliation ?? "UNKNOWN",
      politicalStance: candidate.politicalStance,
      causes: candidate.causes ?? [],
      targetPopulations: candidate.targetAudience ? [candidate.targetAudience] : [],
      geographicFocus: candidate.geographicFocus ?? [],
      totalGivingUsd: candidate.totalGivingUsd,
      avgGrantSizeUsd: candidate.avgGrantSizeUsd,
      grantCount: candidate.grants?.length ?? 0,
      givingYearRange: candidate.givingYearRange,
      donorConfidence: candidate.donorConfidence ?? "CONFIRMED",
      dataSources: candidate.dataSources ?? [],
      researchStatus: "COMPLETED",
    },
    { aiQualityScore }
  );

  if (!validation.success) {
    throw new Error(
      `Donor validation failed: ${validation.errors?.map((e) => `${e.path}: ${e.message}`).join(", ")}`
    );
  }

  const data = validation.data;

  const donor = await prisma.donor.create({
    data: {
      ...data,
      lastResearchedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  // Validate and store grants (skip invalid ones)
  const validGrants = (candidate.grants ?? [])
    .map((g) => validateGrant(g))
    .filter((r) => r.success)
    .map((r) => r.data!);

  if (validGrants.length > 0) {
    await prisma.donorGrant.createMany({
      data: validGrants.map((g) => ({
        donorId: donor.id,
        recipientName: g.recipientName,
        recipientEin: g.recipientEin ?? undefined,
        amount: g.amount ?? undefined,
        currency: g.currency,
        year: g.year ?? undefined,
        purpose: g.purpose ?? undefined,
        sourceUrl: g.sourceUrl ?? undefined,
      })),
    });
  }

  // Store publications (basic validation)
  if (candidate.publications?.length) {
    await prisma.donorPublication.createMany({
      data: candidate.publications
        .filter((p) => p.title && p.url)
        .map((p) => ({
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

  // Generate political embedding if political stance is available
  if (donor.politicalStance) {
    try {
      const polEmb = await generateEmbedding(donor.politicalStance);
      await prisma.$executeRawUnsafe(
        `UPDATE "Donor" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
        JSON.stringify(polEmb),
        donor.id
      );
    } catch (err) {
      console.warn("[orchestrator] Failed to generate political embedding:", err);
    }
  }

  return donor.id;
}

/**
 * Compute giving statistics from grant data.
 */
function computeGivingStats(donorData: Partial<DonorCandidate>): void {
  const grants = donorData.grants ?? [];
  if (grants.length === 0) return;

  const amounts = grants
    .map(g => normalizeGrantAmount(g.amount))
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
    if (!g.recipientName) return false;
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
  targetPopulations?: string[];
  geographicFocus: string[];
  activeRegions?: string[];
}): string {
  return [
    donor.name,
    donor.description,
    donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations?.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
    donor.geographicFocus.length ? `Geography: ${donor.geographicFocus.join(", ")}` : null,
    donor.activeRegions?.length ? `Active regions: ${donor.activeRegions.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}
