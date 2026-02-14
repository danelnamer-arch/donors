/**
 * Extract metadata and description from YouTube videos.
 * Uses the free oEmbed API first, falls back to Firecrawl scraping.
 */

import { scrapePage } from "@/lib/firecrawl";

/**
 * Parse a YouTube video ID from various URL formats.
 */
function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract metadata and description from a YouTube video.
 * Returns concatenated text suitable for Gemini extraction.
 */
export async function extractYouTubeInfo(url: string): Promise<string> {
  const parts: string[] = [];

  // Try oEmbed API first (free, no auth needed)
  const videoId = parseYouTubeId(url);
  if (videoId) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.title) parts.push(`Title: ${data.title}`);
        if (data.author_name) parts.push(`Channel: ${data.author_name}`);
      }
    } catch {
      // oEmbed failed, continue to Firecrawl
    }
  }

  // Scrape the page for description and other content
  try {
    const scraped = await scrapePage(url);
    if (scraped.description) parts.push(`Description: ${scraped.description}`);
    if (scraped.content) {
      // Take a reasonable chunk of page content (video descriptions, about section)
      parts.push(scraped.content.slice(0, 5000));
    }
  } catch {
    // Firecrawl failed — return what we have from oEmbed
  }

  if (parts.length === 0) {
    throw new Error(`Could not extract info from YouTube URL: ${url}`);
  }

  return parts.join("\n\n");
}
