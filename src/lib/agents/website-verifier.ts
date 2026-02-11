/**
 * Website Verification Agent
 * Verifies that a URL actually belongs to the claimed donor/foundation.
 * Cross-references using Tavily search and Gemini verification.
 */

import { searchDonors } from "@/lib/tavily";
import { verifyWebsite } from "@/lib/gemini";
import { scrapePage } from "@/lib/firecrawl";

interface VerificationResult {
  verified: boolean;
  url: string | null;
  source: string; // "irs990" | "tavily" | "crawl" | "gemini"
  confidence: number;
  reason: string;
}

/**
 * Find and verify the correct website for a donor.
 * Uses multiple strategies: IRS data, web search, crawl + AI verification.
 */
export async function findAndVerifyWebsite(
  donorName: string,
  options?: {
    claimedUrl?: string | null;
    ein?: string | null;
    irsWebsite?: string | null;
  }
): Promise<VerificationResult> {
  const strategies: VerificationResult[] = [];

  // Strategy 1: IRS 990 website (most authoritative for US foundations)
  if (options?.irsWebsite) {
    const normalized = normalizeUrl(options.irsWebsite);
    if (normalized) {
      strategies.push({
        verified: true,
        url: normalized,
        source: "irs990",
        confidence: 0.95,
        reason: "Website from IRS 990 filing",
      });
    }
  }

  // Strategy 2: Verify claimed URL by crawling it
  if (options?.claimedUrl) {
    const claimed = normalizeUrl(options.claimedUrl);
    if (claimed) {
      try {
        const page = await scrapePage(claimed);
        if (page?.content) {
          const verification = await verifyWebsite(donorName, claimed, page.content);
          if (verification.verified && verification.confidence >= 0.7) {
            strategies.push({
              verified: true,
              url: claimed,
              source: "crawl",
              confidence: verification.confidence,
              reason: verification.reason,
            });
          }
        }
      } catch {
        // Claimed URL failed to load — don't trust it
      }
    }
  }

  // Strategy 3: Search for the correct website
  try {
    const results = await searchDonors(
      `"${donorName}" official website foundation`,
      { maxResults: 5 }
    );

    for (const result of results) {
      // Look for results that seem like the donor's own site
      const urlLower = result.url.toLowerCase();
      const nameParts = donorName.toLowerCase().split(/\s+/);
      const nameInUrl = nameParts.some(
        (part) => part.length > 3 && urlLower.includes(part)
      );

      if (nameInUrl && !isDirectoryUrl(result.url)) {
        // Looks like it could be the donor's site
        const existingMatch = strategies.find(
          (s) => s.url && sameDomain(s.url, result.url)
        );

        if (existingMatch) {
          // Boosts confidence if found in search too
          existingMatch.confidence = Math.min(1, existingMatch.confidence + 0.1);
        } else {
          strategies.push({
            verified: true,
            url: result.url,
            source: "tavily",
            confidence: 0.7,
            reason: `Found via web search: ${result.title}`,
          });
        }
        break; // Take the first good match
      }
    }
  } catch {
    // Search failed — continue with what we have
  }

  // Return highest confidence result
  strategies.sort((a, b) => b.confidence - a.confidence);

  if (strategies.length > 0) {
    return strategies[0];
  }

  return {
    verified: false,
    url: options?.claimedUrl || null,
    source: "none",
    confidence: 0,
    reason: "Could not verify website",
  };
}

/** Normalize a URL to a standard format. */
function normalizeUrl(url: string): string | null {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith("http")) {
      normalized = "https://" + normalized;
    }
    const parsed = new URL(normalized);
    return parsed.href;
  } catch {
    return null;
  }
}

/** Check if two URLs share the same domain. */
function sameDomain(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

/** Check if a URL is a directory/aggregator rather than the donor's own site. */
function isDirectoryUrl(url: string): boolean {
  const directories = [
    "guidestar", "candid", "charitynavigator", "propublica",
    "wikipedia", "linkedin", "facebook", "twitter", "instagram",
    "crunchbase", "bloomberg", "reuters", "nytimes", "washingtonpost",
    "irs.gov", "nonprofitexplorer",
  ];
  const hostname = new URL(url).hostname.toLowerCase();
  return directories.some((d) => hostname.includes(d));
}
