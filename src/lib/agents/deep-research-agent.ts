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
  donorTypeHint?: "INDIVIDUAL" | "FOUNDATION";
  /** Names already in DB — passed to Perplexity to reduce duplicates */
  existingDonorNames?: string[];
}): Promise<AgentResult<{ rawContent: string; parsedDonors: Partial<DonorCandidate>[] }>> {
  try {
    const result = await discoverDonors({
      ...params,
      excludeNames: params.existingDonorNames,
    });

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
  donorName: string,
  options?: { isIsraeli?: boolean }
): Promise<AgentResult<Partial<DonorCandidate>>> {
  try {
    const result = await researchDonor(donorName);

    // For Israeli donors, run a supplementary search with Hebrew context
    // and Israeli media sources for broader coverage
    let supplementaryContent = "";
    if (options?.isIsraeli) {
      try {
        const hebrewResult = await discoverDonors({
          cause: `"${donorName}" donation OR philanthropy OR תרומה OR פילנתרופיה site:calcalist.co.il OR site:globes.co.il OR site:themarker.com OR site:guidestar.org.il`,
          region: "Israel",
        });
        supplementaryContent = hebrewResult.content;
      } catch {
        // Non-critical — continue with primary results
      }
    }

    const combinedContent = supplementaryContent
      ? `${result.content}\n\n--- Additional Israeli sources ---\n${supplementaryContent}`
      : result.content;

    // Parse the research into structured data
    const parsed = await parseDonorResearch(donorName, combinedContent);

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
          "You are a data extraction specialist. Parse the research text into structured donor profiles. Return a JSON array. Only include donors that are clearly identified with enough detail. Do not invent data.\n\nIMPORTANT: Classify each donor's type carefully:\n- INDIVIDUAL: A person who gives philanthropically (billionaire, HNW individual, tech entrepreneur, family patriarch/matriarch). Use this even if they have a personal foundation named after them.\n- FOUNDATION: A registered nonprofit/foundation entity (private foundation, family foundation, community foundation).\n- CORPORATE: A company or corporate giving program (CSR, corporate foundation).\n- GOVERNMENT: A government agency, fund, or quasi-governmental body.\n- OTHER: Federations, international orgs, or entities that don't fit above.\n\nDo NOT default everything to FOUNDATION. Many philanthropists are INDIVIDUAL donors.",
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
  "targetAudience": "string describing target populations/audience, or null",
  "geographicFocus": ["string"],
  "politicalStance": "1-3 sentence description of political/ideological positioning, or null if unknown. For Israeli donors: note positions on settlements, security, peace process, religious-secular divide.",
  "grants": [{"recipientName": "string", "amount": number_in_whole_USD_dollars_or_null (e.g. 5000000 for $5 million, 250000 for $250K — NEVER use shorthand like 5.0 for $5M or 250 for $250K), "year": number_or_null, "purpose": "string_or_null"}]
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
  "targetAudience": "string describing target populations/audience, or null",
  "geographicFocus": ["string"],
  "politicalAffiliation": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "NONPARTISAN" | "UNKNOWN",
  "politicalStance": "Describe the donor's political/ideological positioning in 1-3 sentences. Include: political leanings, ideological causes they champion, controversial positions, religious/secular orientation, nationalist/internationalist stance, and specific policy positions. For Israeli donors: note positions on settlements, security, peace process, religious-secular divide, economic policy. Be specific and nuanced — avoid simple left/right labels. Return null if unknown.",
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "socialLinks": {"linkedin": "url", "twitter": "url"},
  "grants": [{"recipientName": "string", "amount": number_in_whole_USD_dollars_or_null (e.g. 5000000 for $5 million, 250000 for $250K — NEVER use shorthand like 5.0 for $5M or 250 for $250K), "year": number_or_null, "purpose": "string_or_null"}],
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
