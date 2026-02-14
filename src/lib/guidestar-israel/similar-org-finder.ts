/**
 * Similar Org Discovery Pipeline
 *
 * Given an organization's profile, automatically find 15-30 similar Israeli orgs
 * through multiple signals:
 *
 * Signal 1: Perplexity search (fastest, no scraping)
 * Signal 2: GuideStar IL category peers (requires scraping)
 * Signal 3: Shared board members (novel, requires GuideStar data)
 *
 * Discovered orgs get appended to Organization.similarOrgNames[] and stored
 * in the Organization DB for future use.
 */

import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";
import { searchGuidestarOrgs } from "./scraper";

// ─── Interfaces ──────────────────────────────────────────────

interface SimilarOrgResult {
  name: string;
  source: "perplexity" | "guidestar-category" | "board-overlap" | "media";
  registrationNumber?: string;
  confidence: number; // 0-1
}

interface DiscoverySummary {
  totalFound: number;
  bySource: Record<string, number>;
  newNames: string[];
  existingNames: string[];
}

// ─── Signal 1: Perplexity Search ─────────────────────────────

/**
 * Discover similar orgs via Perplexity AI search.
 * Fastest signal — no scraping required.
 * Uses org name + mission + causes for comprehensive matching.
 */
export async function discoverSimilarOrgsViaPerplexity(
  orgName: string,
  orgMission: string | null,
  orgCauses: string[],
  orgGeoFocus: string[]
): Promise<SimilarOrgResult[]> {
  // Dynamic import to avoid circular dependencies
  const { discoverDonors } = await import("@/lib/perplexity");

  const missionContext = orgMission
    ? `Their mission: "${orgMission.slice(0, 500)}".`
    : "";
  const causesContext = orgCauses.length > 0
    ? `They work on: ${orgCauses.join(", ")}.`
    : "";
  const geoContext = orgGeoFocus.length > 0
    ? `Geographic focus: ${orgGeoFocus.join(", ")}.`
    : "";

  // Use Perplexity's general search with a custom prompt
  const query = `Find 15-20 Israeli nonprofit organizations (amutot/עמותות) that are similar to "${orgName}". ${missionContext} ${causesContext} ${geoContext}

For each similar organization, provide:
- Organization name (in English, with Hebrew name in parentheses if known)
- Brief description of what they do
- Why they are similar to ${orgName}

Focus on organizations that:
1. Work on the same or overlapping cause areas
2. Serve similar populations in Israel
3. Have similar missions or approaches
4. Operate in similar regions of Israel
5. Have similar organizational size/scope

Only include REAL, verifiable Israeli organizations. Check guidestar.org.il for verification.`;

  // We use the callGemini approach for more control over the prompt
  const result = await callGemini(
    [
      {
        role: "user",
        parts: [{ text: query }],
      },
    ],
    { temperature: 0.3, maxTokens: 3000 }
  );

  // Also try Perplexity for web-grounded results
  let perplexityResults: string[] = [];
  try {
    const ppxResult = await discoverDonors({
      cause: `Israeli nonprofits similar to "${orgName}" ${orgCauses.slice(0, 3).join(", ")}`,
      region: "Israel",
    });
    // Parse org names from Perplexity response
    perplexityResults = await extractOrgNamesFromText(ppxResult.content);
  } catch (err) {
    console.warn("[similar-org] Perplexity search failed:", err instanceof Error ? err.message : err);
  }

  // Parse Gemini response for org names
  const geminiNames = await extractOrgNamesFromText(result);

  // Combine and deduplicate
  const allNames = [...new Set([...geminiNames, ...perplexityResults])];

  return allNames
    .filter((name) => name.toLowerCase() !== orgName.toLowerCase())
    .map((name) => ({
      name,
      source: "perplexity" as const,
      confidence: 0.7,
    }));
}

/**
 * Extract organization names from free-text AI response.
 * Uses Gemini to parse names from unstructured text.
 */
async function extractOrgNamesFromText(text: string): Promise<string[]> {
  if (!text || text.length < 50) return [];

  const prompt = `Extract ONLY the names of Israeli nonprofit organizations from this text. Return a JSON array of organization names in English. If a Hebrew name is given, include the English version.

Return ONLY a valid JSON array, e.g.: ["Org Name 1", "Org Name 2"]

Text:
${text.slice(0, 5000)}`;

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
    return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === "string" && n.length > 2) : [];
  } catch {
    return [];
  }
}

// ─── Signal 2: GuideStar IL Category Peers ───────────────────

/**
 * Find similar orgs by searching GuideStar Israel for the same categories.
 * Requires the org's registration number to look up their categories first.
 */
export async function discoverCategoryPeers(
  orgCauses: string[],
  orgName: string
): Promise<SimilarOrgResult[]> {
  const results: SimilarOrgResult[] = [];

  // Search GuideStar for each cause
  for (const cause of orgCauses.slice(0, 3)) {
    try {
      const searchResults = await searchGuidestarOrgs(cause);

      for (const result of searchResults) {
        if (result.name.toLowerCase() !== orgName.toLowerCase()) {
          results.push({
            name: result.name,
            source: "guidestar-category",
            registrationNumber: result.regNumber,
            confidence: 0.6,
          });
        }
      }

      // Rate limit between searches
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (err) {
      console.warn(`[similar-org] GuideStar search failed for "${cause}":`, err instanceof Error ? err.message : err);
    }
  }

  return deduplicateResults(results);
}

// ─── Signal 3: Board Member Overlap ──────────────────────────

/**
 * Find similar orgs by searching for shared board members.
 * If two orgs share a board member, they're very likely in the same sector.
 *
 * Requires board member names from a GuideStar scrape.
 */
export async function discoverBoardOverlapOrgs(
  boardMembers: string[],
  orgName: string
): Promise<SimilarOrgResult[]> {
  if (boardMembers.length === 0) return [];

  const results: SimilarOrgResult[] = [];

  // Search GuideStar for each board member (top 5 to limit API calls)
  for (const member of boardMembers.slice(0, 5)) {
    try {
      const searchResults = await searchGuidestarOrgs(member);

      for (const result of searchResults) {
        if (result.name.toLowerCase() !== orgName.toLowerCase()) {
          results.push({
            name: result.name,
            source: "board-overlap",
            registrationNumber: result.regNumber,
            confidence: 0.8, // Board overlap is a strong signal
          });
        }
      }

      // Rate limit between searches
      await new Promise((resolve) => setTimeout(resolve, 15000));
    } catch (err) {
      console.warn(`[similar-org] Board member search failed for "${member}":`, err instanceof Error ? err.message : err);
    }
  }

  return deduplicateResults(results);
}

// ─── Combined Discovery ──────────────────────────────────────

/**
 * Run all discovery signals and combine results.
 * Updates the Organization's similarOrgNames in the database.
 *
 * @param orgId — Organization ID to discover similar orgs for
 * @param options — Which signals to use
 * @returns Discovery summary
 */
export async function discoverAndStoreSimilarOrgs(
  orgId: string,
  options?: {
    usePerplexity?: boolean;
    useGuidestarCategories?: boolean;
    useBoardOverlap?: boolean;
    boardMembers?: string[];
    maxResults?: number;
  }
): Promise<DiscoverySummary> {
  const usePerplexity = options?.usePerplexity ?? true;
  const useGuidestar = options?.useGuidestarCategories ?? false; // Off by default (slower)
  const useBoardOverlap = options?.useBoardOverlap ?? false; // Off by default (slower)
  const maxResults = options?.maxResults ?? 30;

  // Load org from DB
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      mission: true,
      causes: true,
      geographicFocus: true,
      similarOrgNames: true,
    },
  });

  if (!org) throw new Error(`Organization ${orgId} not found`);

  const allResults: SimilarOrgResult[] = [];

  // Signal 1: Perplexity
  if (usePerplexity) {
    console.log(`[similar-org] Running Perplexity discovery for "${org.name}"...`);
    const ppxResults = await discoverSimilarOrgsViaPerplexity(
      org.name,
      org.mission,
      org.causes,
      org.geographicFocus
    );
    allResults.push(...ppxResults);
    console.log(`[similar-org] Perplexity found ${ppxResults.length} similar orgs`);
  }

  // Signal 2: GuideStar categories
  if (useGuidestar && org.causes.length > 0) {
    console.log(`[similar-org] Running GuideStar category search for "${org.name}"...`);
    const gsResults = await discoverCategoryPeers(org.causes, org.name);
    allResults.push(...gsResults);
    console.log(`[similar-org] GuideStar categories found ${gsResults.length} similar orgs`);
  }

  // Signal 3: Board overlap
  if (useBoardOverlap && options?.boardMembers && options.boardMembers.length > 0) {
    console.log(`[similar-org] Running board member overlap for "${org.name}"...`);
    const boardResults = await discoverBoardOverlapOrgs(options.boardMembers, org.name);
    allResults.push(...boardResults);
    console.log(`[similar-org] Board overlap found ${boardResults.length} similar orgs`);
  }

  // Deduplicate and rank by confidence
  const deduped = deduplicateResults(allResults);
  const ranked = deduped
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);

  // Merge with existing similarOrgNames (don't replace user-provided names)
  const existingNames = new Set(org.similarOrgNames.map((n) => n.toLowerCase()));
  const newNames = ranked
    .map((r) => r.name)
    .filter((name) => !existingNames.has(name.toLowerCase()));

  const updatedNames = [...org.similarOrgNames, ...newNames];

  // Update the organization
  if (newNames.length > 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { similarOrgNames: updatedNames },
    });
    console.log(
      `[similar-org] Updated "${org.name}": added ${newNames.length} new similar orgs (total: ${updatedNames.length})`
    );
  } else {
    console.log(`[similar-org] No new similar orgs found for "${org.name}"`);
  }

  // Build summary
  const bySource: Record<string, number> = {};
  for (const r of ranked) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }

  return {
    totalFound: ranked.length,
    bySource,
    newNames,
    existingNames: org.similarOrgNames,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function deduplicateResults(results: SimilarOrgResult[]): SimilarOrgResult[] {
  const seen = new Map<string, SimilarOrgResult>();

  for (const result of results) {
    const key = result.name.toLowerCase().trim();
    const existing = seen.get(key);

    if (!existing || result.confidence > existing.confidence) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}
