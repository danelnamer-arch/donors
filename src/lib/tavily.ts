import { tavily } from "@tavily/core";

const globalForTavily = globalThis as unknown as {
  tavilyClient: ReturnType<typeof tavily> | undefined;
};

function getTavilyClient() {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
}

export const tavilyClient =
  globalForTavily.tavilyClient ?? getTavilyClient();

if (process.env.NODE_ENV !== "production") {
  globalForTavily.tavilyClient = tavilyClient;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/**
 * Search the web for donor-related information.
 * Returns structured results with source URLs.
 */
export async function searchDonors(query: string, options?: {
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}): Promise<TavilySearchResult[]> {
  const response = await tavilyClient.search(query, {
    maxResults: options?.maxResults ?? 10,
    searchDepth: "advanced",
    includeDomains: options?.includeDomains,
    excludeDomains: options?.excludeDomains,
  });

  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}

/**
 * Search specifically for foundations/donors that support a given cause in a region.
 */
export async function searchFoundationsByCause(
  cause: string,
  region: string,
  options?: { maxResults?: number }
): Promise<TavilySearchResult[]> {
  const query = `${cause} donor grant funding ${region} philanthropy`;
  return searchDonors(query, { maxResults: options?.maxResults ?? 10 });
}

/**
 * Search for a specific donor/foundation to get more details.
 */
export async function searchDonorDetails(
  donorName: string
): Promise<TavilySearchResult[]> {
  const query = `"${donorName}" foundation grants donations philanthropy`;
  return searchDonors(query, { maxResults: 10 });
}

/**
 * Search for publications, articles, and social media related to a donor.
 */
export async function searchDonorPublications(
  donorName: string
): Promise<TavilySearchResult[]> {
  const query = `"${donorName}" interview article podcast blog philanthropy`;
  return searchDonors(query, { maxResults: 10 });
}
