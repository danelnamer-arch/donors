/**
 * Research Orchestrator — Coordinates all research agents.
 * Manages the full pipeline: discover → research → crawl → validate → store.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";
import { discoverDonorsBySearch, searchForDonorInfo } from "./search-agent";
import { crawlDonorWebsite } from "./crawl-agent";
import { deepDiscoverDonors, deepResearchDonor, deepEnrichDonor } from "./deep-research-agent";
import { validateDonorCandidate } from "./validator-agent";
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

      // Step 4: If they have a website, crawl it
      if (donorData.website) {
        const crawlResult = await crawlDonorWebsite(donorData.website, name);
        if (crawlResult.success && crawlResult.data) {
          // Merge crawled data (prefer crawled data for contact info, use existing for everything else)
          donorData = {
            ...donorData,
            ...crawlResult.data,
            // Keep the richer description
            description: donorData.description && donorData.description.length > (crawlResult.data.description?.length ?? 0)
              ? donorData.description
              : crawlResult.data.description ?? donorData.description,
            // Merge arrays
            causes: [...new Set([...(donorData.causes ?? []), ...(crawlResult.data.causes ?? [])])],
            targetPopulations: [...new Set([...(donorData.targetPopulations ?? []), ...(crawlResult.data.targetPopulations ?? [])])],
            geographicFocus: [...new Set([...(donorData.geographicFocus ?? []), ...(crawlResult.data.geographicFocus ?? [])])],
            // Merge grants
            grants: [...(donorData.grants ?? []), ...(crawlResult.data.grants ?? [])],
            // Merge sources
            dataSources: [...(donorData.dataSources ?? []), ...(crawlResult.data.dataSources ?? [])],
          };
        }
      }

      // Step 5: Validate
      const validation = await validateDonorCandidate(donorData);
      if (!validation.success || !validation.data?.isValid) {
        errors.push(`Validation failed for ${name}: ${validation.error ?? "not verifiable"}`);
        continue;
      }
      validated++;

      // Step 6: Store in database
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

    // Run deep enrichment via Perplexity + web search + crawling in parallel
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

    // Update donor with enriched data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Update donor fields
      await tx.donor.update({
        where: { id: donorId },
        data: {
          description: profile.description ?? donor.description,
          email: profile.contactEmail ?? donor.email,
          phone: profile.contactPhone ?? donor.phone,
          socialLinks: (profile.socialLinks ?? donor.socialLinks) as Record<string, string> | undefined,
          causes: profile.causes?.length
            ? [...new Set([...donor.causes, ...profile.causes])]
            : donor.causes,
          targetPopulations: profile.targetPopulations?.length
            ? [...new Set([...donor.targetPopulations, ...profile.targetPopulations])]
            : donor.targetPopulations,
          geographicFocus: profile.geographicFocus?.length
            ? [...new Set([...donor.geographicFocus, ...profile.geographicFocus])]
            : donor.geographicFocus,
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
      email: candidate.contactEmail,
      phone: candidate.contactPhone,
      socialLinks: candidate.socialLinks ?? undefined,
      country: candidate.country,
      city: candidate.city,
      politicalAffiliation: (candidate.politicalAffiliation as "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "NONPARTISAN" | "UNKNOWN") ?? "UNKNOWN",
      causes: candidate.causes ?? [],
      targetPopulations: candidate.targetPopulations ?? [],
      geographicFocus: candidate.geographicFocus ?? [],
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
 * Build text for embedding generation from donor data.
 */
function buildEmbeddingText(donor: {
  name: string;
  description?: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
}): string {
  return [
    donor.name,
    donor.description,
    donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
    donor.geographicFocus.length ? `Geography: ${donor.geographicFocus.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}
