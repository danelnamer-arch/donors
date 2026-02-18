import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { scrapePage, scrapeSocialPage } from "@/lib/firecrawl";
import {
  extractOrgProfile,
  extractTextFromPdf,
  extractTextFromDocument,
  isSupportedDocumentType,
  extractYouTubeInfo,
} from "@/lib/extraction";
import type { ExtractedOrgProfile } from "@/lib/extraction";

// ─── Vercel route config ────────────────────────────────────────
// The extraction pipeline (scrape + parse + Gemini) takes 15-30s,
// well beyond the default 10s serverless timeout.
export const maxDuration = 60;
export const runtime = "nodejs"; // pdf-parse needs Buffer

// ─── Timeout helper ─────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// ─── Empty profile (fallback when AI extraction fails) ──────────
const EMPTY_PROFILE: ExtractedOrgProfile = {
  name: null,
  mission: null,
  website: null,
  country: null,
  size: null,
  annualBudgetRange: null,
  israeliRegistrationNumber: null,
  causes: [],
  targetAudience: null,
  geographicFocus: [],
  similarOrgs: [],
  existingDonors: [],
  politicalStance: null,
};

interface SourceInput {
  type: "url" | "pdf" | "youtube" | "social" | "text" | "guidestar";
  value: string;
  fileBase64?: string;
  fileMimeType?: string;
}

/**
 * POST /api/onboarding/extract
 *
 * Accepts multiple content sources, gathers raw text from each,
 * and uses Gemini to extract a structured org profile.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sources: SourceInput[] = body.sources;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: "At least one source is required" },
        { status: 400 }
      );
    }

    // Gather raw text from each source (with per-source timeouts)
    const textParts: string[] = [];
    const sourcesUsed: string[] = [];
    const errors: string[] = [];

    for (const source of sources) {
      try {
        switch (source.type) {
          case "url": {
            const scraped = await withTimeout(
              scrapePage(source.value),
              15000,
              `Scraping ${source.value}`
            );
            textParts.push(
              `--- Source: Website (${source.value}) ---\n${scraped.content}`
            );
            sourcesUsed.push(`url:${source.value}`);

            // Try to find and scrape "about" page for more context
            const aboutLink = scraped.links?.find((link: string) =>
              /about|mission|who-we-are|our-work|our-story/i.test(link)
            );
            if (aboutLink) {
              try {
                const aboutPage = await withTimeout(
                  scrapePage(aboutLink),
                  10000,
                  `Scraping about page`
                );
                textParts.push(
                  `--- Source: About Page (${aboutLink}) ---\n${aboutPage.content}`
                );
                sourcesUsed.push(`url:${aboutLink}`);
              } catch {
                // About page scrape failed — not critical
              }
            }
            break;
          }

          case "pdf": {
            if (!source.fileBase64) {
              errors.push("Document source missing fileBase64 data");
              continue;
            }

            let docText: string;
            const mimeType = source.fileMimeType || "application/pdf";

            if (mimeType === "application/pdf") {
              // Standard PDF parsing
              const buffer = Buffer.from(source.fileBase64, "base64");
              docText = await withTimeout(
                extractTextFromPdf(buffer),
                10000,
                "PDF parsing"
              );
            } else if (isSupportedDocumentType(mimeType)) {
              // DOCX, PPTX, DOC, PPT — use Gemini multimodal
              docText = await withTimeout(
                extractTextFromDocument(source.fileBase64, mimeType),
                20000,
                "Document extraction"
              );
            } else {
              errors.push(`Unsupported file type: ${mimeType}`);
              continue;
            }

            const ext = source.value?.split(".").pop()?.toUpperCase() || "Document";
            textParts.push(`--- Source: ${ext} Document ---\n${docText}`);
            sourcesUsed.push(`doc:${source.value || "uploaded"}`);
            break;
          }

          case "youtube": {
            const ytText = await withTimeout(
              extractYouTubeInfo(source.value),
              10000,
              "YouTube extraction"
            );
            textParts.push(
              `--- Source: YouTube (${source.value}) ---\n${ytText}`
            );
            sourcesUsed.push(`youtube:${source.value}`);
            break;
          }

          case "social": {
            const socialScraped = await withTimeout(
              scrapeSocialPage(source.value),
              15000,
              `Scraping social ${source.value}`
            );
            textParts.push(
              `--- Source: Social Media (${source.value}) ---\n${socialScraped.content}`
            );
            sourcesUsed.push(`social:${source.value}`);
            break;
          }

          case "guidestar": {
            const gsResult = await withTimeout(
              (async () => {
                const { scrapeGuidestarOrg } = await import(
                  "@/lib/guidestar-israel/scraper"
                );
                const { profileToText } = await import(
                  "@/lib/guidestar-israel/extractor"
                );
                const gsProfile = await scrapeGuidestarOrg(source.value);
                return profileToText(gsProfile);
              })(),
              15000,
              "GuideStar scraping"
            );
            textParts.push(
              `--- Source: GuideStar Israel (${source.value}) ---\n${gsResult}`
            );
            sourcesUsed.push(`guidestar:${source.value}`);
            break;
          }

          case "text": {
            textParts.push(
              `--- Source: Pasted Text ---\n${source.value}`
            );
            sourcesUsed.push("text:pasted");
            break;
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(`${source.type}:${source.value?.slice(0, 60)} — ${msg}`);
      }
    }

    // If nothing was extracted, return error
    if (textParts.length === 0) {
      return NextResponse.json(
        {
          error: "Could not extract text from any source",
          details: errors,
        },
        { status: 422 }
      );
    }

    // Concatenate and truncate
    const rawProfileText = textParts.join("\n\n").slice(0, 30000);

    // Extract structured profile with timeout + graceful fallback
    let profile: ExtractedOrgProfile;
    try {
      profile = await withTimeout(
        extractOrgProfile(rawProfileText),
        25000,
        "AI profile extraction"
      );
    } catch (extractErr) {
      const msg = extractErr instanceof Error ? extractErr.message : "Unknown error";
      console.error("[extract] AI extraction failed, returning empty profile:", msg);
      errors.push(`AI extraction failed: ${msg} — please fill in manually`);
      profile = EMPTY_PROFILE;
    }

    return NextResponse.json({
      success: true,
      profile,
      rawProfileText,
      sourcesUsed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
