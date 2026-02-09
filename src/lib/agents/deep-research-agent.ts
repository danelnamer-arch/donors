/**
 * Deep Research Agent — Uses Perplexity for in-depth donor research with citations.
 * This is the brain behind donor discovery and the paid "Enrich" feature.
 */

import { researchDonor, discoverDonors, enrichDonor } from "@/lib/perplexity";
import { openai } from "@/lib/openai";
import type { AgentResult, DonorCandidate } from "./types";

/**
 * Discover new donors for a given cause/region using Perplexity deep research.
 */
export async function deepDiscoverDonors(params: {
  cause: string;
  targetPopulation?: string;
  region?: string;
}): Promise<AgentResult<{ rawContent: string; parsedDonors: Partial<DonorCandidate>[] }>> {
  try {
    const result = await discoverDonors(params);

    // Parse the Perplexity response into structured donor candidates
    const parsedDonors = await parseDiscoveryResults(result.content);

    // Attach citations to sources
    const sources = result.citations.map((c) => ({
      url: c.url,
      title: c.title ?? c.url,
    }));

    return {
      success: true,
      data: {
        rawContent: result.content,
        parsedDonors: parsedDonors.map((d) => ({
          ...d,
          dataSources: sources.map((s) => ({
            ...s,
            fetchedAt: new Date().toISOString(),
          })),
        })),
      },
      sources,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Deep research failed",
      sources: [],
    };
  }
}

/**
 * Research a specific donor in depth using Perplexity.
 */
export async function deepResearchDonor(
  donorName: string
): Promise<AgentResult<Partial<DonorCandidate>>> {
  try {
    const result = await researchDonor(donorName);

    // Parse the research into structured data
    const parsed = await parseDonorResearch(donorName, result.content);

    const sources = result.citations.map((c) => ({
      url: c.url,
      title: c.title ?? c.url,
    }));

    return {
      success: true,
      data: {
        ...parsed,
        dataSources: sources.map((s) => ({
          ...s,
          fetchedAt: new Date().toISOString(),
        })),
      },
      sources,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Research failed",
      sources: [],
    };
  }
}

/**
 * Full enrichment research for a donor (paid feature).
 * Most comprehensive research, uses Perplexity's sonar-pro model.
 */
export async function deepEnrichDonor(
  donorName: string,
  knownInfo: {
    website?: string;
    causes?: string[];
    description?: string;
  }
): Promise<AgentResult<{
  profile: Partial<DonorCandidate>;
  enrichedReport: string;
}>> {
  try {
    const result = await enrichDonor(donorName, knownInfo);

    const parsed = await parseDonorResearch(donorName, result.content);

    const sources = result.citations.map((c) => ({
      url: c.url,
      title: c.title ?? c.url,
    }));

    return {
      success: true,
      data: {
        profile: {
          ...parsed,
          dataSources: sources.map((s) => ({
            ...s,
            fetchedAt: new Date().toISOString(),
          })),
        },
        enrichedReport: result.content,
      },
      sources,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Enrichment failed",
      sources: [],
    };
  }
}

/**
 * Parse Perplexity's discovery response into structured donor candidates.
 */
async function parseDiscoveryResults(
  content: string
): Promise<Partial<DonorCandidate>[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a data extraction specialist. Parse the research text into structured donor profiles. Return a JSON array. Only include donors that are clearly identified with enough detail. Do not invent data.",
      },
      {
        role: "user",
        content: `Parse this research into structured donor profiles:

${content.slice(0, 15000)}

Return JSON array:
[{
  "name": "string",
  "type": "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER",
  "description": "string (2-3 sentences)",
  "website": "string or null",
  "causes": ["string"],
  "targetPopulations": ["string"],
  "geographicFocus": ["string"],
  "grants": [{"recipientName": "string", "amount": number_or_null, "year": number_or_null, "purpose": "string_or_null"}]
}]`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0,
  });

  const parsed = JSON.parse(
    response.choices[0].message.content ?? '{"donors": []}'
  );

  // Handle both { donors: [...] } and direct array formats
  const donors = Array.isArray(parsed) ? parsed : parsed.donors ?? [];
  return donors;
}

/**
 * Parse Perplexity's donor research into a structured profile.
 */
async function parseDonorResearch(
  donorName: string,
  content: string
): Promise<Partial<DonorCandidate>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a data extraction specialist. Parse the research text into a structured donor profile. Return valid JSON only. Only include information explicitly mentioned in the research.",
      },
      {
        role: "user",
        content: `Parse this research about "${donorName}" into a structured profile:

${content.slice(0, 15000)}

Return JSON:
{
  "name": "string",
  "type": "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER",
  "description": "string (2-3 sentence summary)",
  "website": "string or null",
  "country": "string or null",
  "city": "string or null",
  "causes": ["string"],
  "targetPopulations": ["string"],
  "geographicFocus": ["string"],
  "politicalAffiliation": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "NONPARTISAN" | "UNKNOWN",
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "socialLinks": {"linkedin": "url", "twitter": "url"},
  "grants": [{"recipientName": "string", "amount": number_or_null, "year": number_or_null, "purpose": "string_or_null"}],
  "publications": [{"title": "string", "type": "ARTICLE" | "PODCAST" | "SOCIAL_MEDIA" | "PRESS_RELEASE" | "BLOG_POST" | "VIDEO" | "OTHER", "url": "string", "summary": "string"}]
}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
    temperature: 0,
  });

  return JSON.parse(
    response.choices[0].message.content ?? "{}"
  );
}
