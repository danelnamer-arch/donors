/**
 * Validator Agent — Cross-references donor data across sources.
 * Ensures no hallucinated data enters the database.
 * Every fact must have a source URL.
 */

import { searchDonors } from "@/lib/tavily";
import { openai } from "@/lib/openai";
import type { AgentResult, DonorCandidate } from "./types";

interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  validatedFields: {
    field: string;
    value: string;
    verified: boolean;
    source?: string;
    issue?: string;
  }[];
  dataQualityScore: number; // 0-1
  warnings: string[];
}

/**
 * Validate a donor candidate by cross-referencing key facts.
 */
export async function validateDonorCandidate(
  candidate: Partial<DonorCandidate>
): Promise<AgentResult<ValidationResult>> {
  try {
    if (!candidate.name) {
      return {
        success: false,
        error: "Donor candidate must have a name",
        sources: [],
      };
    }

    // Search for the donor to cross-reference
    const searchResults = await searchDonors(
      `"${candidate.name}" foundation donor philanthropy`,
      { maxResults: 5 }
    );

    // Verify key facts using OpenAI
    const validation = await crossReferenceData(candidate, searchResults);

    return {
      success: true,
      data: validation,
      sources: searchResults.map((r) => ({ url: r.url, title: r.title })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed",
      sources: [],
    };
  }
}

async function crossReferenceData(
  candidate: Partial<DonorCandidate>,
  searchResults: { title: string; url: string; content: string }[]
): Promise<ValidationResult> {
  const searchContext = searchResults
    .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content}`)
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a fact-checking specialist for philanthropy data. Cross-reference the donor profile against search results. For each key field, determine if it's verified by the search results. Be strict — if a fact isn't confirmed by any source, mark it as unverified. Return valid JSON.`,
      },
      {
        role: "user",
        content: `Donor Profile to Validate:
Name: ${candidate.name}
Type: ${candidate.type ?? "unknown"}
Description: ${candidate.description ?? "none"}
Causes: ${candidate.causes?.join(", ") ?? "none"}
Website: ${candidate.website ?? "none"}
Country: ${candidate.country ?? "unknown"}
Grants: ${JSON.stringify(candidate.grants?.slice(0, 5) ?? [])}

Search Results for Cross-Reference:
${searchContext.slice(0, 10000)}

Return JSON:
{
  "isValid": boolean (true if the donor clearly exists and core info is correct),
  "confidence": number (0-1, how confident are we in the data),
  "validatedFields": [
    {
      "field": "name",
      "value": "the value we have",
      "verified": boolean,
      "source": "URL that confirms this or null",
      "issue": "description of problem or null"
    }
  ],
  "dataQualityScore": number (0-1, overall data completeness and accuracy),
  "warnings": ["any concerns about this data"]
}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
    temperature: 0,
  });

  const result = JSON.parse(
    response.choices[0].message.content ?? "{}"
  );

  return {
    isValid: result.isValid ?? false,
    confidence: result.confidence ?? 0,
    validatedFields: result.validatedFields ?? [],
    dataQualityScore: result.dataQualityScore ?? 0,
    warnings: result.warnings ?? [],
  };
}

/**
 * Quick validation — just check if a donor name is real.
 * Faster than full validation, used for bulk filtering.
 */
export async function quickValidateDonorName(
  name: string
): Promise<{ exists: boolean; url?: string }> {
  try {
    const results = await searchDonors(`"${name}" foundation`, {
      maxResults: 3,
    });

    // Check if any result clearly references this donor
    const match = results.find(
      (r) =>
        r.title.toLowerCase().includes(name.toLowerCase()) ||
        r.content.toLowerCase().includes(name.toLowerCase())
    );

    return {
      exists: !!match,
      url: match?.url,
    };
  } catch {
    return { exists: false };
  }
}
