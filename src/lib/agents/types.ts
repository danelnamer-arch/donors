/**
 * Shared types for the research agent system.
 */

export interface DonorCandidate {
  name: string;
  type: "FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER";
  description: string;
  website?: string;
  country?: string;
  city?: string;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  politicalAffiliation?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: Record<string, string>;
  grants: {
    recipientName: string;
    recipientEin?: string;
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
