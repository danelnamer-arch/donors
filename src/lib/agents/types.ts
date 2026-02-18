/**
 * Shared types for the research agent system.
 */

export interface DonorCandidate {
  name: string;
  type: "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER";
  description: string;
  website?: string;
  websiteVerified?: boolean;
  websiteSource?: string;
  country?: string;
  city?: string;
  headquartersCountry?: string;
  headquartersCity?: string;
  activeRegions?: string[];
  causes: string[];
  targetAudience?: string;
  geographicFocus: string[];
  politicalAffiliation?: string;
  politicalStance?: string;
  israeliRegistrationNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: Record<string, string>;
  totalGivingUsd?: number;
  avgGrantSizeUsd?: number;
  givingYearRange?: string;
  grants: {
    recipientName: string;
    recipientEin?: string;
    recipientIsraeliRegNumber?: string;
    amount?: number;
    currency?: string;
    year?: number;
    purpose?: string;
    sourceUrl?: string;
  }[];
  publications: {
    title: string;
    type: "ARTICLE" | "SOCIAL_MEDIA" | "PODCAST" | "PRESS_RELEASE" | "BLOG_POST" | "VIDEO" | "OTHER";
    url: string;
    summary?: string;
    publishedAt?: string;
  }[];
  dataSources: {
    url: string;
    title: string;
    fetchedAt: string;
  }[];
  donorConfidence?: "CONFIRMED" | "LIKELY" | "SUSPECTED";
  dataQualityScore: number; // 0-1
}

export interface ResearchContext {
  query?: string;
  cause?: string;
  targetPopulation?: string;
  region?: string;
  donorName?: string;
  donorWebsite?: string;
  existingInfo?: Partial<DonorCandidate>;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  sources: { url: string; title: string }[];
}
