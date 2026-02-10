import { NextRequest, NextResponse } from "next/server";
import { searchDonorsFullText, searchDonorsSemantic } from "@/lib/search";

/**
 * GET /api/donors/search
 * Search donors using full-text or semantic search.
 *
 * Query params:
 *   q        — text search query (optional, returns all if empty)
 *   semantic — "true" to use vector similarity search
 *   type     — filter by donor type (repeatable)
 *   cause    — filter by cause area (repeatable)
 *   country  — filter by country (repeatable)
 *   limit    — max results (default 20)
 *   offset   — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") ?? undefined;
    const semantic = searchParams.get("semantic") === "true";
    const type = searchParams.getAll("type") as ("FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER")[];
    const causes = searchParams.getAll("cause");
    const countries = searchParams.getAll("country");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    if (semantic && query) {
      const results = await searchDonorsSemantic(query, {
        limit,
        type: type.length ? type : undefined,
        causes: causes.length ? causes : undefined,
      });
      return NextResponse.json({ results, total: results.length });
    }

    const results = await searchDonorsFullText({
      query,
      type: type.length ? type : undefined,
      causes: causes.length ? causes : undefined,
      countries: countries.length ? countries : undefined,
      limit,
      offset,
    });

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}
