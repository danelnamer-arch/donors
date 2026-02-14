/**
 * Pre-Research Deduplication Checker
 *
 * Prevents wasting ~10 API calls per candidate on donors already in the DB.
 * Loads all existing donors into in-memory maps and checks candidates
 * before expensive research begins.
 *
 * Normalization logic reused from src/app/api/admin/duplicates/route.ts.
 */

import { prisma } from "@/lib/prisma";

export interface DedupResult {
  isDuplicate: boolean;
  reason?: string;
  existingDonorId?: string;
  existingDonorName?: string;
}

interface DonorSnapshot {
  id: string;
  name: string;
  ein: string | null;
  israeliRegistrationNumber: string | null;
  website: string | null;
}

/**
 * Normalize a donor name for comparison.
 * Strips common suffixes and prefixes, removes non-alphanumeric chars.
 * Logic from src/app/api/admin/duplicates/route.ts lines 31-35.
 */
export function normalizeDonorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(
      /\s+(foundation|fund|trust|inc|org|llc|ltd|corporation|corp|co|association|assoc|institute|society|charitable|charity|philanthropies|philanthropy)\.?$/i,
      ""
    )
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Extract domain from a URL for comparison.
 */
function extractDomain(url: string): string | null {
  try {
    let cleaned = url.trim();
    if (!cleaned.startsWith("http")) cleaned = `https://${cleaned}`;
    const parsed = new URL(cleaned);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export class DedupChecker {
  private donors: DonorSnapshot[] = [];
  private nameMap = new Map<string, DonorSnapshot>(); // lowercase name -> donor
  private normalizedNameMap = new Map<string, DonorSnapshot>(); // normalized name -> donor
  private einMap = new Map<string, DonorSnapshot>(); // EIN -> donor
  private israeliRegMap = new Map<string, DonorSnapshot>(); // Israeli registration number -> donor
  private domainMap = new Map<string, DonorSnapshot>(); // website domain -> donor
  private loaded = false;

  /**
   * Load all existing donors into in-memory maps.
   * Call this once at startup and after each phase.
   */
  async loadSnapshot(): Promise<void> {
    this.donors = await prisma.donor.findMany({
      select: { id: true, name: true, ein: true, israeliRegistrationNumber: true, website: true },
    });

    this.nameMap.clear();
    this.normalizedNameMap.clear();
    this.einMap.clear();
    this.israeliRegMap.clear();
    this.domainMap.clear();

    for (const d of this.donors) {
      // Exact name (case-insensitive)
      this.nameMap.set(d.name.toLowerCase(), d);

      // Normalized name
      const normalized = normalizeDonorName(d.name);
      if (normalized) {
        this.normalizedNameMap.set(normalized, d);
      }

      // EIN
      if (d.ein) {
        this.einMap.set(d.ein, d);
      }

      // Israeli registration number
      if (d.israeliRegistrationNumber) {
        this.israeliRegMap.set(d.israeliRegistrationNumber, d);
      }

      // Website domain
      if (d.website) {
        const domain = extractDomain(d.website);
        if (domain) {
          this.domainMap.set(domain, d);
        }
      }
    }

    this.loaded = true;
  }

  /**
   * Refresh the snapshot (call after each phase to pick up newly added donors).
   */
  async refreshSnapshot(): Promise<void> {
    return this.loadSnapshot();
  }

  /**
   * Get the total number of donors in the snapshot.
   */
  get donorCount(): number {
    return this.donors.length;
  }

  /**
   * Check if a candidate is a duplicate of an existing donor.
   * Checks in order: EIN, exact name, normalized name, website domain, containment.
   */
  isDuplicate(candidate: {
    name: string;
    ein?: string | null;
    israeliRegistrationNumber?: string | null;
    website?: string | null;
  }): DedupResult {
    if (!this.loaded) {
      throw new Error("DedupChecker not loaded. Call loadSnapshot() first.");
    }

    // Check 1: Exact EIN match
    if (candidate.ein) {
      const match = this.einMap.get(candidate.ein);
      if (match) {
        return {
          isDuplicate: true,
          reason: `Same EIN: ${candidate.ein}`,
          existingDonorId: match.id,
          existingDonorName: match.name,
        };
      }
    }

    // Check 1.5: Exact Israeli registration number match
    if (candidate.israeliRegistrationNumber) {
      const match = this.israeliRegMap.get(candidate.israeliRegistrationNumber);
      if (match) {
        return {
          isDuplicate: true,
          reason: `Same Israeli registration number: ${candidate.israeliRegistrationNumber}`,
          existingDonorId: match.id,
          existingDonorName: match.name,
        };
      }
    }

    // Check 2: Exact name (case-insensitive)
    const lowerName = candidate.name.toLowerCase();
    const exactMatch = this.nameMap.get(lowerName);
    if (exactMatch) {
      return {
        isDuplicate: true,
        reason: `Exact name match`,
        existingDonorId: exactMatch.id,
        existingDonorName: exactMatch.name,
      };
    }

    // Check 3: Normalized name match
    const normalizedName = normalizeDonorName(candidate.name);
    if (normalizedName) {
      const normalizedMatch = this.normalizedNameMap.get(normalizedName);
      if (normalizedMatch) {
        return {
          isDuplicate: true,
          reason: `Normalized name match: "${candidate.name}" ≈ "${normalizedMatch.name}"`,
          existingDonorId: normalizedMatch.id,
          existingDonorName: normalizedMatch.name,
        };
      }
    }

    // Check 4: Website domain match
    if (candidate.website) {
      const domain = extractDomain(candidate.website);
      if (domain) {
        const domainMatch = this.domainMap.get(domain);
        if (domainMatch) {
          return {
            isDuplicate: true,
            reason: `Same website domain: ${domain}`,
            existingDonorId: domainMatch.id,
            existingDonorName: domainMatch.name,
          };
        }
      }
    }

    // Check 5: Containment check — "Ford Foundation" matches "The Ford Foundation"
    if (normalizedName && normalizedName.length >= 4) {
      for (const [existingNormalized, donor] of this.normalizedNameMap) {
        if (existingNormalized.length < 4) continue;
        // Check if one contains the other (but not exact match — already caught above)
        if (
          existingNormalized !== normalizedName &&
          (existingNormalized.includes(normalizedName) ||
            normalizedName.includes(existingNormalized))
        ) {
          return {
            isDuplicate: true,
            reason: `Name containment: "${candidate.name}" ≈ "${donor.name}"`,
            existingDonorId: donor.id,
            existingDonorName: donor.name,
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Quick check by name only (used as shouldSkip callback for runDiscoveryPipeline).
   */
  shouldSkip(name: string): boolean {
    return this.isDuplicate({ name }).isDuplicate;
  }
}
