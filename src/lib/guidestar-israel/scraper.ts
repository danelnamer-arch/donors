/**
 * GuideStar Israel — Web Scraper
 *
 * Scrapes organization profiles from guidestar.org.il using Firecrawl.
 * GuideStar Israel is a Salesforce-based, JS-rendered site with Hebrew content.
 * Firecrawl handles JS rendering and returns clean markdown.
 *
 * Key data available:
 * - Organization profile (name, mission, categories, board members)
 * - Financial reports (annual budget, revenue)
 * - Donors above 100K NIS (legally required to be public)
 * - Verbal reports with additional mission/activity details
 *
 * GuideStar Israel is a government transparency project (Ministry of Justice + JDC + Yad Hanadiv).
 * All data is free to access. Rate-limit conservatively to avoid blocks.
 */

import { scrapePage } from "@/lib/firecrawl";
import {
  extractGuidestarProfile,
  type GuidestarILProfile,
} from "./extractor";

// ─── Constants ───────────────────────────────────────────────

const GUIDESTAR_IL_BASE = "https://www.guidestar.org.il";
const DEFAULT_DELAY_MS = 15000; // 15s between requests — conservative for government site

// ─── Single Organization Scrape ──────────────────────────────

/**
 * Scrape a single organization from GuideStar Israel by registration number.
 * Uses Firecrawl for JS rendering, then Gemini for extraction + Hebrew→English translation.
 *
 * @param registrationNumber — Israeli association number (mispar amuta), e.g., "580123456"
 * @returns Structured organization profile with translated fields
 */
export async function scrapeGuidestarOrg(
  registrationNumber: string
): Promise<GuidestarILProfile> {
  const url = `${GUIDESTAR_IL_BASE}/organization/${registrationNumber}`;

  console.log(`[guidestar-il] Scraping: ${url}`);

  const scraped = await scrapePage(url);

  if (!scraped.content || scraped.content.length < 100) {
    throw new Error(
      `[guidestar-il] Empty or minimal content from ${url} (${scraped.content.length} chars)`
    );
  }

  console.log(
    `[guidestar-il] Scraped ${scraped.content.length} chars from ${url}, extracting...`
  );

  const profile = await extractGuidestarProfile(
    scraped.content,
    registrationNumber
  );

  // Try to get more data from the verbal/financial report page if available
  const reportLinks = scraped.links?.filter(
    (link: string) =>
      link.includes("verbal") ||
      link.includes("financial") ||
      link.includes("report") ||
      link.includes("miluli") ||
      link.includes("kaspi")
  );

  if (reportLinks && reportLinks.length > 0) {
    for (const reportLink of reportLinks.slice(0, 2)) {
      try {
        const reportScraped = await scrapePage(reportLink);
        if (reportScraped.content && reportScraped.content.length > 200) {
          // Extract additional data from report page (especially donors)
          const reportProfile = await extractGuidestarProfile(
            reportScraped.content,
            registrationNumber
          );

          // Merge: take new donors and board members not already found
          for (const donor of reportProfile.topDonors) {
            if (!profile.topDonors.includes(donor)) {
              profile.topDonors.push(donor);
            }
          }
          for (const detail of reportProfile.donorDetails) {
            if (
              !profile.donorDetails.some(
                (d) => d.name.toLowerCase() === detail.name.toLowerCase()
              )
            ) {
              profile.donorDetails.push(detail);
            }
          }
          for (const member of reportProfile.boardMembers) {
            if (!profile.boardMembers.includes(member)) {
              profile.boardMembers.push(member);
            }
          }

          // Take mission if main page didn't have it
          if (!profile.missionEnglish && reportProfile.missionEnglish) {
            profile.mission = reportProfile.mission;
            profile.missionEnglish = reportProfile.missionEnglish;
          }
        }
      } catch (err) {
        console.warn(
          `[guidestar-il] Failed to scrape report page ${reportLink}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log(
    `[guidestar-il] Extracted: ${profile.nameEnglish || profile.name} — ` +
      `${profile.boardMembers.length} board members, ${profile.topDonors.length} donors, ` +
      `${profile.normalizedCauses.length} causes`
  );

  return profile;
}

/**
 * Search GuideStar Israel for organizations matching a query.
 * Returns registration numbers and names for further scraping.
 *
 * @param query — Search term (can be Hebrew or English)
 * @returns Array of { regNumber, name } for matching orgs
 */
export async function searchGuidestarOrgs(
  query: string
): Promise<{ regNumber: string; name: string; snippet: string }[]> {
  const url = `${GUIDESTAR_IL_BASE}/search-malkars?searchText=${encodeURIComponent(query)}`;

  console.log(`[guidestar-il] Searching: ${url}`);

  const scraped = await scrapePage(url);

  if (!scraped.content || scraped.content.length < 100) {
    console.warn(`[guidestar-il] Empty search results for "${query}"`);
    return [];
  }

  // Use Gemini to parse search results from the scraped markdown
  const { callGemini } = await import("@/lib/gemini");

  const prompt = `Extract organization search results from this GuideStar Israel search page.

Return ONLY valid JSON — an array of objects:
[
  {"regNumber": "580123456", "name": "Organization name in Hebrew or English", "snippet": "Brief description if available"}
]

Rules:
- Extract the registration number (mispar amuta) — usually a 7-9 digit number
- Extract the organization name
- Include a brief description/snippet if available
- Maximum 30 results
- If the page is in Hebrew, still extract the data (names can stay in Hebrew)

Page content:
${scraped.content.slice(0, 15000)}`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.1 }
  );

  try {
    const jsonStr = result
      .replace(/```json?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error("[guidestar-il] Failed to parse search results");
    return [];
  }
}

/**
 * Test whether Firecrawl can access GuideStar Israel.
 * Run this before building the full scraping pipeline.
 *
 * @returns true if Firecrawl can successfully scrape a GuideStar IL page
 */
export async function testGuidestarAccess(): Promise<{
  success: boolean;
  contentLength: number;
  error?: string;
}> {
  try {
    // Use a well-known org registration number for testing
    const testUrl = `${GUIDESTAR_IL_BASE}/organization/580046632`;
    const scraped = await scrapePage(testUrl);

    return {
      success: scraped.content.length > 200,
      contentLength: scraped.content.length,
    };
  } catch (err) {
    return {
      success: false,
      contentLength: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Batch scrape multiple GuideStar Israel orgs with rate limiting.
 *
 * @param registrationNumbers — Array of registration numbers to scrape
 * @param options — Configuration for delay and callbacks
 * @returns Array of results (profile or error for each)
 */
export async function batchScrapeGuidestarOrgs(
  registrationNumbers: string[],
  options?: {
    delayMs?: number;
    onProgress?: (idx: number, total: number, profile: GuidestarILProfile | null) => void;
    onError?: (idx: number, regNumber: string, error: string) => void;
  }
): Promise<{ regNumber: string; profile: GuidestarILProfile | null; error?: string }[]> {
  const delay = options?.delayMs ?? DEFAULT_DELAY_MS;
  const results: { regNumber: string; profile: GuidestarILProfile | null; error?: string }[] = [];

  for (let i = 0; i < registrationNumbers.length; i++) {
    const regNumber = registrationNumbers[i];

    try {
      const profile = await scrapeGuidestarOrg(regNumber);
      results.push({ regNumber, profile });
      options?.onProgress?.(i, registrationNumbers.length, profile);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ regNumber, profile: null, error: errorMsg });
      options?.onError?.(i, regNumber, errorMsg);
    }

    // Rate limiting between requests
    if (i < registrationNumbers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}
