/**
 * Reverse Donor Discovery — "Who Funds Our Peers?"
 *
 * The highest-ROI strategy for donor discovery. Architecture:
 *
 * User's Org → [Similar Org Finder] → 15-20 peer orgs
 *                                         │
 *     For each peer org:                  │
 *     ├── GuideStar IL → extract listed donors (>100K NIS, free by law)
 *     ├── Media search → articles mentioning the org + donors/donations
 *     ├── ProPublica "American Friends of [peer]" → IRS 990 donors
 *     ├── Perplexity "major donors of [peer org]"
 *     └── Firecrawl → scrape peer's website /donors /supporters page
 *                                         │
 *                                         ▼
 *               [Aggregate & Dedup Donors]
 *                                         │
 *                                         ▼
 *               [Store as DonorGrant with recipientName = peer org]
 *               [Store peer orgs in Organization DB]
 */

import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";
import { scrapePage } from "@/lib/firecrawl";
import { scrapeGuidestarOrg, searchGuidestarOrgs } from "./scraper";
import type { GuidestarILProfile } from "./extractor";

// ─── Types ──────────────────────────────────────────────────

export interface DiscoveredDonor {
  name: string;
  source:
    | "guidestar-il"
    | "media"
    | "propublica"
    | "perplexity"
    | "website-scrape";
  amountILS?: number;
  amountUSD?: number;
  year?: number;
  recipientOrgName: string;
  recipientRegNumber?: string;
  confidence: "CONFIRMED" | "LIKELY" | "SUSPECTED";
  sourceUrl?: string;
}

export interface ReverseDonorResult {
  totalDonorsFound: number;
  bySource: Record<string, number>;
  donors: DiscoveredDonor[];
  peersProcessed: number;
  errors: string[];
}

// ILS to USD approximate rate (configurable)
const ILS_TO_USD = 0.27;

// ─── Signal A: GuideStar IL Donor Extraction ────────────────

/**
 * Extract publicly listed donors (>100K NIS) from a GuideStar IL org profile.
 * This data is FREE by Israeli law — all amutot must disclose donors above 100K NIS.
 */
export async function findDonorsFromGuidestar(
  orgName: string,
  registrationNumber?: string
): Promise<DiscoveredDonor[]> {
  const donors: DiscoveredDonor[] = [];

  if (!registrationNumber) {
    // Try to find the registration number by searching
    try {
      const searchResults = await searchGuidestarOrgs(orgName);
      if (searchResults.length > 0) {
        registrationNumber = searchResults[0].regNumber;
      }
    } catch (err) {
      console.warn(
        `[reverse-donor] Could not find registration number for "${orgName}":`,
        err instanceof Error ? err.message : err
      );
      return donors;
    }
  }

  if (!registrationNumber) return donors;

  try {
    const profile: GuidestarILProfile = await scrapeGuidestarOrg(
      registrationNumber
    );

    // Extract donors from the profile
    for (const detail of profile.donorDetails) {
      donors.push({
        name: detail.name,
        source: "guidestar-il",
        amountILS: detail.amountILS,
        amountUSD: detail.amountILS
          ? Math.round(detail.amountILS * ILS_TO_USD)
          : undefined,
        year: detail.year,
        recipientOrgName: profile.nameEnglish || profile.name,
        recipientRegNumber: registrationNumber,
        confidence: "CONFIRMED", // GuideStar is official data
        sourceUrl: `https://www.guidestar.org.il/organization/${registrationNumber}`,
      });
    }

    // Also process any top donor names without detailed amounts
    for (const donorName of profile.topDonors) {
      if (!donors.some((d) => d.name.toLowerCase() === donorName.toLowerCase())) {
        donors.push({
          name: donorName,
          source: "guidestar-il",
          recipientOrgName: profile.nameEnglish || profile.name,
          recipientRegNumber: registrationNumber,
          confidence: "CONFIRMED",
          sourceUrl: `https://www.guidestar.org.il/organization/${registrationNumber}`,
        });
      }
    }

    console.log(
      `[reverse-donor] GuideStar found ${donors.length} donors for "${orgName}"`
    );
  } catch (err) {
    console.warn(
      `[reverse-donor] GuideStar scrape failed for "${orgName}":`,
      err instanceof Error ? err.message : err
    );
  }

  return donors;
}

// ─── Signal B: Media Mining ─────────────────────────────────

/**
 * Search Israeli news and media for articles about an org that mention donors.
 * Targets: Calcalist, Globes, TheMarker, Ynet, Times of Israel, Jerusalem Post.
 */
export async function searchMediaForDonorClues(
  orgName: string
): Promise<DiscoveredDonor[]> {
  // Dynamic import to avoid circular dependencies
  const { discoverDonors } = await import("@/lib/perplexity");

  const donors: DiscoveredDonor[] = [];

  // Search for news articles mentioning the org + donation-related keywords
  const mediaQueries = [
    `"${orgName}" donation OR donor OR "major gift" OR fundraiser OR gala OR philanthropy Israel`,
    `"${orgName}" תרומה OR תורם OR גאלה OR פילנתרופיה`,
  ];

  for (const query of mediaQueries) {
    try {
      const result = await discoverDonors({
        cause: query,
        region: "Israel",
      });

      // Use Gemini to extract donor names from the media article text
      const extractedDonors = await extractDonorNamesFromMedia(
        result.content,
        orgName
      );

      for (const donor of extractedDonors) {
        if (
          !donors.some(
            (d) => d.name.toLowerCase() === donor.name.toLowerCase()
          )
        ) {
          donors.push({
            ...donor,
            recipientOrgName: orgName,
            source: "media",
            confidence: "LIKELY",
          });
        }
      }

      // Rate limit between queries
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (err) {
      console.warn(
        `[reverse-donor] Media search failed for "${orgName}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `[reverse-donor] Media mining found ${donors.length} donors for "${orgName}"`
  );
  return donors;
}

/**
 * Extract donor names and amounts from media/news text using Gemini.
 */
async function extractDonorNamesFromMedia(
  text: string,
  orgName: string
): Promise<
  { name: string; amountUSD?: number; year?: number; sourceUrl?: string }[]
> {
  if (!text || text.length < 50) return [];

  const prompt = `Extract the names of donors, philanthropists, or funders mentioned in connection with "${orgName}" from the following text.

Return ONLY a valid JSON array:
[
  {"name": "Donor Name", "amountUSD": null, "year": null, "sourceUrl": null}
]

Rules:
- Only extract donors/funders of "${orgName}" specifically
- Include amount in USD if mentioned (convert from ILS at ~0.27 rate if needed)
- Include the year if mentioned
- Exclude the organization's own name
- Exclude government entities unless they are direct funders
- If no donors are found, return an empty array []

Text:
${text.slice(0, 8000)}`;

  try {
    const result = await callGemini(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.1, maxTokens: 1000 }
    );

    const jsonStr = result
      .replace(/```json?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed.filter((d: { name?: unknown }) => typeof d.name === "string" && d.name.length > 2) : [];
  } catch {
    return [];
  }
}

// ─── Signal C: "American Friends Of" ProPublica ─────────────

/**
 * Find "American Friends of [orgName]" entities on ProPublica.
 * These US 501(c)(3)s fundraise in the US and transfer to Israeli parent orgs.
 * Their IRS 990 filings list donors. This bridges IRS data to Israeli orgs.
 */
export async function findAmericanFriendsOf(
  orgName: string
): Promise<DiscoveredDonor[]> {
  const PROPUBLICA_BASE = "https://projects.propublica.org/nonprofits/api/v2";
  const donors: DiscoveredDonor[] = [];

  // Generate search variations
  const searchQueries = [
    `American Friends of ${orgName}`,
    `Friends of ${orgName}`,
    `${orgName} Foundation`,
  ];

  for (const query of searchQueries) {
    try {
      const url = `${PROPUBLICA_BASE}/search.json?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);

      if (!response.ok) continue;

      const data = (await response.json()) as {
        organizations: {
          ein: number;
          name: string;
          city: string;
          state: string;
          income_amount: number;
          ntee_code: string;
        }[];
      };

      if (!data.organizations || data.organizations.length === 0) continue;

      // Filter to likely matches (name contains the search pattern or org name)
      const orgNameLower = orgName.toLowerCase();
      const matches = data.organizations.filter((o) => {
        const n = o.name.toLowerCase();
        return (
          n.includes("friend") ||
          n.includes(orgNameLower) ||
          n.includes(orgNameLower.replace(/\s+/g, ""))
        );
      });

      for (const match of matches.slice(0, 3)) {
        const ein = match.ein.toString().padStart(9, "0");

        donors.push({
          name: match.name,
          source: "propublica",
          amountUSD: match.income_amount > 0 ? match.income_amount : undefined,
          recipientOrgName: orgName,
          confidence: "CONFIRMED",
          sourceUrl: `https://projects.propublica.org/nonprofits/organizations/${ein}`,
        });

        // Try to import this foundation into our DB if not already there
        try {
          const existing = await prisma.donor.findUnique({ where: { ein } });
          if (!existing) {
            const { importFoundationByEin } = await import(
              "@/lib/irs990/importer"
            );
            await importFoundationByEin(ein);
            console.log(
              `[reverse-donor] Imported "American Friends" org: ${match.name} (EIN: ${ein})`
            );
          }
        } catch {
          // Non-critical — continue
        }
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.warn(
        `[reverse-donor] ProPublica search failed for "${query}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `[reverse-donor] ProPublica found ${donors.length} "American Friends" for "${orgName}"`
  );
  return donors;
}

// ─── Signal D: Perplexity Donor Search ──────────────────────

/**
 * Ask Perplexity: "Who are the major donors of [orgName]?"
 */
export async function findDonorsViaPerplexity(
  orgName: string
): Promise<DiscoveredDonor[]> {
  const { discoverDonors } = await import("@/lib/perplexity");
  const donors: DiscoveredDonor[] = [];

  try {
    const result = await discoverDonors({
      cause: `major donors and funders of the Israeli nonprofit "${orgName}". List specific individuals, foundations, or corporations that have donated to or funded "${orgName}".`,
      region: "Israel",
    });

    const extracted = await extractDonorNamesFromMedia(
      result.content,
      orgName
    );

    for (const donor of extracted) {
      donors.push({
        name: donor.name,
        source: "perplexity",
        amountUSD: donor.amountUSD,
        year: donor.year,
        recipientOrgName: orgName,
        confidence: "LIKELY",
        sourceUrl: donor.sourceUrl,
      });
    }

    console.log(
      `[reverse-donor] Perplexity found ${donors.length} donors for "${orgName}"`
    );
  } catch (err) {
    console.warn(
      `[reverse-donor] Perplexity search failed for "${orgName}":`,
      err instanceof Error ? err.message : err
    );
  }

  return donors;
}

// ─── Signal E: Website Donor/Supporter Page Scrape ──────────

/**
 * Scrape the peer org's own website for /donors, /supporters, /partners pages.
 */
export async function findDonorsFromWebsite(
  orgName: string,
  websiteUrl?: string
): Promise<DiscoveredDonor[]> {
  if (!websiteUrl) return [];

  const donors: DiscoveredDonor[] = [];

  // Try common donor page paths
  const donorPaths = [
    "/donors",
    "/supporters",
    "/partners",
    "/funders",
    "/sponsors",
    "/thank-you",
    "/annual-report",
  ];

  for (const path of donorPaths.slice(0, 3)) {
    // Limit to 3 attempts
    try {
      const url = new URL(path, websiteUrl).toString();
      const scraped = await scrapePage(url);

      if (scraped.content && scraped.content.length > 200) {
        const extracted = await extractDonorNamesFromMedia(
          scraped.content,
          orgName
        );

        for (const donor of extracted) {
          if (
            !donors.some(
              (d) => d.name.toLowerCase() === donor.name.toLowerCase()
            )
          ) {
            donors.push({
              name: donor.name,
              source: "website-scrape",
              amountUSD: donor.amountUSD,
              recipientOrgName: orgName,
              confidence: "LIKELY",
              sourceUrl: url,
            });
          }
        }
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch {
      // Page doesn't exist or scrape failed — expected for most paths
    }
  }

  if (donors.length > 0) {
    console.log(
      `[reverse-donor] Website scrape found ${donors.length} donors for "${orgName}"`
    );
  }

  return donors;
}

// ─── Combined Pipeline ──────────────────────────────────────

/**
 * Find all discoverable donors for a single peer org.
 * Combines all signals: GuideStar, media, ProPublica, Perplexity, website.
 */
export async function findDonorsOfOrg(
  orgName: string,
  options?: {
    registrationNumber?: string;
    websiteUrl?: string;
    useGuidestar?: boolean;
    useMedia?: boolean;
    useProPublica?: boolean;
    usePerplexity?: boolean;
    useWebsiteScrape?: boolean;
  }
): Promise<DiscoveredDonor[]> {
  const useGuidestar = options?.useGuidestar ?? true;
  const useMedia = options?.useMedia ?? true;
  const useProPublica = options?.useProPublica ?? true;
  const usePerplexity = options?.usePerplexity ?? true;
  const useWebsiteScrape = options?.useWebsiteScrape ?? false; // Off by default (slow + often 404s)

  const allDonors: DiscoveredDonor[] = [];

  // Run signals in parallel where possible
  const promises: Promise<DiscoveredDonor[]>[] = [];

  if (useGuidestar) {
    promises.push(
      findDonorsFromGuidestar(orgName, options?.registrationNumber)
    );
  }

  if (usePerplexity) {
    promises.push(findDonorsViaPerplexity(orgName));
  }

  if (useProPublica) {
    promises.push(findAmericanFriendsOf(orgName));
  }

  // Run first batch in parallel
  const firstBatch = await Promise.allSettled(promises);
  for (const result of firstBatch) {
    if (result.status === "fulfilled") {
      allDonors.push(...result.value);
    }
  }

  // Sequential signals (media is rate-limited, website can be slow)
  if (useMedia) {
    const mediaDonors = await searchMediaForDonorClues(orgName);
    allDonors.push(...mediaDonors);
  }

  if (useWebsiteScrape && options?.websiteUrl) {
    const websiteDonors = await findDonorsFromWebsite(
      orgName,
      options.websiteUrl
    );
    allDonors.push(...websiteDonors);
  }

  // Deduplicate by name
  return deduplicateDonors(allDonors);
}

/**
 * Full reverse donor discovery pipeline.
 * Given a list of similar/peer organizations, find who funds them.
 *
 * @param similarOrgs — Array of peer org names to investigate
 * @param options — Configuration for which signals to use and limits
 * @returns Aggregated, deduplicated list of discovered donors
 */
export async function reverseDonorDiscovery(
  similarOrgs: string[],
  options?: {
    maxPeers?: number;
    useGuidestar?: boolean;
    useMedia?: boolean;
    useProPublica?: boolean;
    usePerplexity?: boolean;
    delayBetweenPeersMs?: number;
    onProgress?: (peerIdx: number, totalPeers: number, peersProcessed: string, donorsFound: number) => void;
  }
): Promise<ReverseDonorResult> {
  const maxPeers = options?.maxPeers ?? 10;
  const delay = options?.delayBetweenPeersMs ?? 10000;

  const allDonors: DiscoveredDonor[] = [];
  const errors: string[] = [];
  let peersProcessed = 0;

  const peersToProcess = similarOrgs.slice(0, maxPeers);

  console.log(
    `[reverse-donor] Starting discovery for ${peersToProcess.length} peer orgs...`
  );

  for (let i = 0; i < peersToProcess.length; i++) {
    const peerOrg = peersToProcess[i];
    console.log(
      `[reverse-donor] [${i + 1}/${peersToProcess.length}] Investigating: "${peerOrg}"`
    );

    try {
      // Look up the org in our DB for additional context
      const existingOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: { contains: peerOrg, mode: "insensitive" } },
            { similarOrgNames: { has: peerOrg } },
          ],
        },
        select: {
          israeliRegistrationNumber: true,
          website: true,
        },
      });

      const donors = await findDonorsOfOrg(peerOrg, {
        registrationNumber: existingOrg?.israeliRegistrationNumber ?? undefined,
        websiteUrl: existingOrg?.website ?? undefined,
        useGuidestar: options?.useGuidestar,
        useMedia: options?.useMedia,
        useProPublica: options?.useProPublica,
        usePerplexity: options?.usePerplexity,
      });

      allDonors.push(...donors);
      peersProcessed++;

      options?.onProgress?.(
        i,
        peersToProcess.length,
        peerOrg,
        allDonors.length
      );

      console.log(
        `[reverse-donor] Found ${donors.length} donors for "${peerOrg}" (total: ${allDonors.length})`
      );
    } catch (err) {
      const errMsg = `Failed to process "${peerOrg}": ${err instanceof Error ? err.message : err}`;
      errors.push(errMsg);
      console.error(`[reverse-donor] ${errMsg}`);
    }

    // Rate limit between peer orgs
    if (i < peersToProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Deduplicate across all peers
  const deduped = deduplicateDonors(allDonors);

  // Build source breakdown
  const bySource: Record<string, number> = {};
  for (const d of deduped) {
    bySource[d.source] = (bySource[d.source] ?? 0) + 1;
  }

  console.log(
    `[reverse-donor] Discovery complete: ${deduped.length} unique donors from ${peersProcessed} peers`
  );
  console.log(`[reverse-donor] By source:`, bySource);

  return {
    totalDonorsFound: deduped.length,
    bySource,
    donors: deduped,
    peersProcessed,
    errors,
  };
}

// ─── Store & Enrich Results ─────────────────────────────────

/**
 * Store discovered donors as grants in our database.
 * Creates or updates donor records and adds grant entries linking them to recipient orgs.
 * Also stores discovered peer organizations in the Organization table.
 */
export async function storeDiscoveredDonors(
  donors: DiscoveredDonor[],
  sourceOrgId?: string
): Promise<{ donorsStored: number; grantsStored: number; orgsStored: number }> {
  let donorsStored = 0;
  let grantsStored = 0;
  let orgsStored = 0;

  // First, store any new peer organizations we discovered
  const uniqueRecipients = [
    ...new Set(donors.map((d) => d.recipientOrgName)),
  ];
  for (const recipientName of uniqueRecipients) {
    try {
      const existing = await prisma.organization.findFirst({
        where: { name: { equals: recipientName, mode: "insensitive" } },
      });
      if (!existing) {
        const recipientRegNum = donors.find(
          (d) =>
            d.recipientOrgName === recipientName && d.recipientRegNumber
        )?.recipientRegNumber;

        await prisma.organization.create({
          data: {
            name: recipientName,
            israeliRegistrationNumber: recipientRegNum ?? null,
            country: "Israel",
            geographicFocus: ["Israel"],
            causes: [],
            targetPopulations: [],
            similarOrgNames: [],
            existingDonorNames: [],
          },
        });
        orgsStored++;
      }
    } catch {
      // Unique constraint or other issue — continue
    }
  }

  for (const donor of donors) {
    try {
      // Check if donor already exists in our DB
      let existingDonor = await prisma.donor.findFirst({
        where: {
          OR: [
            { name: { equals: donor.name, mode: "insensitive" } },
            // Also check by name similarity (exact match first)
          ],
        },
      });

      if (!existingDonor) {
        // Create a new donor record
        existingDonor = await prisma.donor.create({
          data: {
            name: donor.name,
            type: "OTHER", // Will be refined during research
            donorConfidence: donor.confidence,
            totalGivingUsd: donor.amountUSD ?? null,
            country: "Israel", // Default — will be refined
            causes: [],
            targetPopulations: [],
            geographicFocus: ["Israel"],
            activeRegions: ["Israel"],
            dataSources: [
              {
                url: donor.sourceUrl ?? "reverse-donor-discovery",
                title: `Discovered via ${donor.source} (peer: ${donor.recipientOrgName})`,
                fetchedAt: new Date().toISOString(),
              },
            ],
            researchStatus: "NEEDS_UPDATE",
            dataQualityScore: 0.2, // Low — needs research
          },
        });
        donorsStored++;
      }

      // Create a grant record linking this donor to the recipient org
      const existingGrant = await prisma.donorGrant.findFirst({
        where: {
          donorId: existingDonor.id,
          recipientName: {
            equals: donor.recipientOrgName,
            mode: "insensitive",
          },
          year: donor.year ?? undefined,
        },
      });

      if (!existingGrant) {
        await prisma.donorGrant.create({
          data: {
            donorId: existingDonor.id,
            recipientName: donor.recipientOrgName,
            recipientIsraeliRegNumber: donor.recipientRegNumber ?? null,
            amount: donor.amountUSD ?? donor.amountILS
              ? (donor.amountILS ?? 0) * ILS_TO_USD
              : null,
            currency: donor.amountUSD ? "USD" : donor.amountILS ? "ILS" : "USD",
            year: donor.year ?? null,
            purpose: `Discovered via ${donor.source}`,
            sourceUrl: donor.sourceUrl ?? null,
          },
        });
        grantsStored++;
      }
    } catch (err) {
      console.warn(
        `[reverse-donor] Failed to store donor "${donor.name}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Update the source org's existingDonorNames if provided
  if (sourceOrgId && donors.length > 0) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: sourceOrgId },
        select: { existingDonorNames: true },
      });
      if (org) {
        const existingNames = new Set(
          org.existingDonorNames.map((n) => n.toLowerCase())
        );
        const newNames = donors
          .map((d) => d.name)
          .filter((name) => !existingNames.has(name.toLowerCase()));

        if (newNames.length > 0) {
          await prisma.organization.update({
            where: { id: sourceOrgId },
            data: {
              existingDonorNames: [
                ...org.existingDonorNames,
                ...newNames,
              ],
            },
          });
        }
      }
    } catch {
      // Non-critical
    }
  }

  console.log(
    `[reverse-donor] Stored: ${donorsStored} donors, ${grantsStored} grants, ${orgsStored} peer orgs`
  );

  return { donorsStored, grantsStored, orgsStored };
}

// ─── Helpers ────────────────────────────────────────────────

function deduplicateDonors(donors: DiscoveredDonor[]): DiscoveredDonor[] {
  const seen = new Map<string, DiscoveredDonor>();

  // Priority: CONFIRMED > LIKELY > SUSPECTED
  const confidenceRank: Record<string, number> = {
    CONFIRMED: 3,
    LIKELY: 2,
    SUSPECTED: 1,
  };

  for (const donor of donors) {
    const key = donor.name.toLowerCase().trim();
    const existing = seen.get(key);

    if (
      !existing ||
      (confidenceRank[donor.confidence] ?? 0) > (confidenceRank[existing.confidence] ?? 0)
    ) {
      // Merge amounts if existing had one and new doesn't
      if (existing && !donor.amountUSD && existing.amountUSD) {
        donor.amountUSD = existing.amountUSD;
      }
      if (existing && !donor.amountILS && existing.amountILS) {
        donor.amountILS = existing.amountILS;
      }
      seen.set(key, donor);
    }
  }

  return Array.from(seen.values());
}
