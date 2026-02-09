/**
 * Crawl Agent — Uses Firecrawl to scrape foundation/donor websites.
 * Extracts structured donor information from web pages.
 */

import { scrapePage, scrapeFoundationWebsite } from "@/lib/firecrawl";
import { openai } from "@/lib/openai";
import type { AgentResult, DonorCandidate } from "./types";

/**
 * Crawl a donor's website and extract structured profile information.
 */
export async function crawlDonorWebsite(
  url: string,
  donorName: string
): Promise<AgentResult<Partial<DonorCandidate>>> {
  try {
    // First try a quick single-page scrape of the main page
    const mainPage = await scrapePage(url);

    // Then crawl deeper pages (about, grants, programs)
    const crawlResult = await scrapeFoundationWebsite(url);

    // Combine all page content
    const allContent = [
      `# Main Page: ${mainPage.title}\n${mainPage.content}`,
      ...crawlResult.pages.map(
        (p) => `# ${p.title}\n${p.content}`
      ),
    ].join("\n\n---\n\n");

    // Use OpenAI to extract structured data from the crawled content
    const extracted = await extractDonorProfile(donorName, allContent);

    const sources = [
      { url, title: mainPage.title, fetchedAt: new Date().toISOString() },
      ...crawlResult.pages.map((p) => ({
        url: p.sourceUrl,
        title: p.title,
        fetchedAt: new Date().toISOString(),
      })),
    ];

    return {
      success: true,
      data: {
        ...extracted,
        website: url,
        dataSources: sources,
      },
      sources: sources.map((s) => ({ url: s.url, title: s.title })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Crawl failed",
      sources: [],
    };
  }
}

/**
 * Use OpenAI to extract structured donor data from raw website content.
 */
async function extractDonorProfile(
  donorName: string,
  rawContent: string
): Promise<Partial<DonorCandidate>> {
  // Truncate content if too long (GPT-4o-mini context limit)
  const content = rawContent.slice(0, 30000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a data extraction specialist. Extract structured donor/foundation information from website content. Return valid JSON only. Be precise — only include information explicitly stated in the content. Do not infer or make up data.`,
      },
      {
        role: "user",
        content: `Extract donor profile information for "${donorName}" from this website content:

${content}

Return JSON with these fields (omit fields where data is not found):
{
  "name": "string",
  "type": "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER",
  "description": "string (2-3 sentence summary)",
  "causes": ["string array of cause areas"],
  "targetPopulations": ["string array of populations they serve"],
  "geographicFocus": ["string array of regions/countries"],
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "grants": [{"recipientName": "string", "amount": number_or_null, "year": number_or_null, "purpose": "string_or_null"}],
  "publications": []
}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
    temperature: 0,
  });

  const parsed = JSON.parse(
    response.choices[0].message.content ?? "{}"
  );

  return {
    name: parsed.name ?? donorName,
    type: parsed.type ?? "FOUNDATION",
    description: parsed.description,
    causes: parsed.causes ?? [],
    targetPopulations: parsed.targetPopulations ?? [],
    geographicFocus: parsed.geographicFocus ?? [],
    contactEmail: parsed.contactEmail,
    contactPhone: parsed.contactPhone,
    grants: (parsed.grants ?? []).map(
      (g: { recipientName: string; amount?: number; year?: number; purpose?: string }) => ({
        recipientName: g.recipientName,
        amount: g.amount,
        year: g.year,
        purpose: g.purpose,
      })
    ),
    publications: parsed.publications ?? [],
  };
}
