/**
 * Firecrawl API client for web crawling and scraping.
 * Returns clean, structured content from web pages.
 */

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogUrl?: string;
      sourceURL?: string;
    };
    links?: string[];
  };
  error?: string;
}

interface FirecrawlCrawlResponse {
  success: boolean;
  id?: string;
  url?: string;
}

interface FirecrawlCrawlStatusResponse {
  success: boolean;
  status: "scraping" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  }[];
}

function getHeaders(): Record<string, string> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";

/**
 * Scrape a single page and return clean markdown content.
 */
export async function scrapePage(url: string): Promise<{
  content: string;
  title: string;
  description: string;
  links: string[];
  sourceUrl: string;
}> {
  const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl scrape error (${response.status}): ${error}`);
  }

  const result: FirecrawlScrapeResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(`Firecrawl scrape failed: ${result.error ?? "Unknown error"}`);
  }

  return {
    content: result.data.markdown ?? "",
    title: result.data.metadata?.title ?? result.data.metadata?.ogTitle ?? "",
    description: result.data.metadata?.description ?? result.data.metadata?.ogDescription ?? "",
    links: result.data.links ?? [],
    sourceUrl: result.data.metadata?.sourceURL ?? url,
  };
}

/**
 * Scrape a social media page with enhanced settings for JS-rendered content.
 * Uses longer wait times and retry logic for dynamic pages (LinkedIn, Facebook, etc.)
 */
export async function scrapeSocialPage(url: string): Promise<{
  content: string;
  title: string;
  description: string;
  links: string[];
  sourceUrl: string;
}> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          waitFor: 3000,
          timeout: 30000,
          removeBase64Images: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firecrawl social scrape error (${response.status}): ${error}`);
      }

      const result: FirecrawlScrapeResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(`Firecrawl social scrape failed: ${result.error ?? "Unknown error"}`);
      }

      const content = result.data.markdown ?? "";

      // If we got very little content, retry (social pages sometimes need extra time)
      if (content.length < 100 && attempt < maxRetries) {
        lastError = new Error("Content too short, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      return {
        content,
        title: result.data.metadata?.title ?? result.data.metadata?.ogTitle ?? "",
        description: result.data.metadata?.description ?? result.data.metadata?.ogDescription ?? "",
        links: result.data.links ?? [],
        sourceUrl: result.data.metadata?.sourceURL ?? url,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError ?? new Error("Social page scrape failed after retries");
}

/**
 * Start crawling a website. Returns a job ID to check status.
 */
export async function startCrawl(
  url: string,
  options?: {
    maxPages?: number;
    includePaths?: string[];
    excludePaths?: string[];
  }
): Promise<string> {
  const response = await fetch(`${FIRECRAWL_BASE_URL}/crawl`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      url,
      limit: options?.maxPages ?? 20,
      includePaths: options?.includePaths,
      excludePaths: options?.excludePaths,
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl crawl error (${response.status}): ${error}`);
  }

  const result: FirecrawlCrawlResponse = await response.json();

  if (!result.success || !result.id) {
    throw new Error("Firecrawl crawl failed to start");
  }

  return result.id;
}

/**
 * Check the status of a crawl job.
 */
export async function getCrawlStatus(jobId: string): Promise<{
  status: string;
  total: number;
  completed: number;
  pages: {
    content: string;
    title: string;
    sourceUrl: string;
  }[];
}> {
  const response = await fetch(`${FIRECRAWL_BASE_URL}/crawl/${jobId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl status error (${response.status}): ${error}`);
  }

  const result: FirecrawlCrawlStatusResponse = await response.json();

  return {
    status: result.status,
    total: result.total,
    completed: result.completed,
    pages: (result.data ?? []).map((page) => ({
      content: page.markdown ?? "",
      title: page.metadata?.title ?? "",
      sourceUrl: page.metadata?.sourceURL ?? "",
    })),
  };
}

/**
 * Scrape a foundation/donor website and extract relevant information.
 * Crawls key pages (about, grants, programs) to build a donor profile.
 */
export async function scrapeFoundationWebsite(url: string): Promise<{
  pages: { content: string; title: string; sourceUrl: string }[];
  jobId: string;
}> {
  const jobId = await startCrawl(url, {
    maxPages: 15,
    includePaths: [
      "*about*",
      "*mission*",
      "*grants*",
      "*program*",
      "*focus*",
      "*funding*",
      "*apply*",
      "*guidelines*",
      "*annual-report*",
      "*team*",
      "*board*",
      "*contact*",
    ],
    excludePaths: [
      "*login*",
      "*careers*",
      "*press*",
      "*blog*",
    ],
  });

  // Poll for completion (max 60 seconds)
  let status = await getCrawlStatus(jobId);
  let attempts = 0;
  while (status.status === "scraping" && attempts < 12) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await getCrawlStatus(jobId);
    attempts++;
  }

  return {
    pages: status.pages,
    jobId,
  };
}
