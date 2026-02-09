/**
 * Search Agent — Uses Tavily to discover donors via web search.
 * Fast, structured search for initial donor discovery.
 */

import { searchDonors, searchFoundationsByCause, searchDonorDetails, searchDonorPublications } from "@/lib/tavily";
import type { AgentResult, DonorCandidate } from "./types";

interface SearchDiscoveryResult {
  candidates: {
    name: string;
    url: string;
    snippet: string;
    relevanceScore: number;
  }[];
}

/**
 * Discover potential donors for a given cause and region.
 */
export async function discoverDonorsBySearch(params: {
  cause: string;
  targetPopulation?: string;
  region?: string;
  maxResults?: number;
}): Promise<AgentResult<SearchDiscoveryResult>> {
  try {
    const { cause, targetPopulation, region, maxResults = 20 } = params;

    // Run multiple targeted searches in parallel
    const queries = [
      searchFoundationsByCause(cause, region ?? "Israel", { maxResults: Math.ceil(maxResults / 2) }),
    ];

    if (targetPopulation) {
      queries.push(
        searchDonors(
          `${targetPopulation} foundation donor funding ${region ?? "Israel"} nonprofit`,
          { maxResults: Math.ceil(maxResults / 2) }
        )
      );
    }

    if (region) {
      queries.push(
        searchDonors(
          `philanthropy grant maker ${cause} ${region}`,
          { maxResults: Math.ceil(maxResults / 3) }
        )
      );
    }

    const results = await Promise.all(queries);
    const allResults = results.flat();

    // Deduplicate by URL
    const seen = new Set<string>();
    const candidates = allResults
      .filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      })
      .map((r) => ({
        name: r.title,
        url: r.url,
        snippet: r.content,
        relevanceScore: r.score,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return {
      success: true,
      data: { candidates },
      sources: candidates.map((c) => ({ url: c.url, title: c.name })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      sources: [],
    };
  }
}

/**
 * Search for detailed information about a specific donor.
 */
export async function searchForDonorInfo(donorName: string): Promise<
  AgentResult<{
    details: { title: string; url: string; content: string }[];
    publications: { title: string; url: string; content: string }[];
  }>
> {
  try {
    const [detailResults, pubResults] = await Promise.all([
      searchDonorDetails(donorName),
      searchDonorPublications(donorName),
    ]);

    return {
      success: true,
      data: {
        details: detailResults.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
        publications: pubResults.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      },
      sources: [...detailResults, ...pubResults].map((r) => ({
        url: r.url,
        title: r.title,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      sources: [],
    };
  }
}
