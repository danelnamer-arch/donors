export interface PipelineEntry {
  id: string;
  stage: string;
  enrichmentStatus: string;
  enrichedData: Record<string, unknown> | null;
  updatedAt: string;
  matchScore: number | null;
  donor: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    country: string | null;
    city: string | null;
    causes: string[];
    geographicFocus: string[];
    totalGivingUsd: number | null;
    avgGrantSizeUsd: number | null;
    grantCount: number;
    givingYearRange: string | null;
    dataQualityScore: number;
    researchStatus: string;
  };
}

export const STAGES = [
  { key: "DISCOVERED", label: "Discovered", color: "bg-zinc-400", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "RESEARCHING", label: "Researching", color: "bg-blue-500", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "OUTREACH", label: "Outreach", color: "bg-amber-500", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { key: "IN_CONVERSATION", label: "In Conversation", color: "bg-purple-500", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "APPLIED", label: "Applied", color: "bg-indigo-500", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

export const STAGE_BORDER_COLORS: Record<string, string> = {
  DISCOVERED: "border-l-zinc-400",
  RESEARCHING: "border-l-blue-500",
  OUTREACH: "border-l-amber-500",
  IN_CONVERSATION: "border-l-purple-500",
  APPLIED: "border-l-indigo-500",
};
