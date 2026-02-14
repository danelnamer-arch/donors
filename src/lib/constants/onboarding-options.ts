/**
 * Shared onboarding option lists.
 *
 * Imported by:
 *  - src/app/onboarding/page.tsx  (UI pills)
 *  - src/lib/extraction/org-profile-extractor.ts  (Gemini prompt)
 *
 * Keep these in sync with the canonical cause taxonomy in
 * src/lib/utils/normalize-causes.ts.
 */

export const CAUSE_OPTIONS = [
  "Education", "Health", "Environment", "Arts & Culture",
  "Human Rights", "Poverty Alleviation", "Youth Development",
  "Women & Girls", "International Development", "Technology & STEM",
  "Disability & Accessibility", "Veterans & Military", "Elderly & Aging",
  "Faith & Religion", "Community Development", "Animal Welfare",
  "Disaster Relief", "Criminal Justice", "Housing & Homelessness",
  "Food & Agriculture", "Science & Research", "Democracy & Governance",
  "Immigration & Refugees", "LGBTQ Rights", "Mental Health",
  "Philanthropy & Grantmaking",
] as const;

export const POPULATION_OPTIONS = [
  "Children", "Youth", "Elderly", "Women", "Refugees",
  "Low-income families", "Minorities", "People with disabilities",
  "Veterans", "Students", "Immigrants", "LGBTQ+",
  "Ethiopian Israelis", "Arab Citizens of Israel",
  "Ultra-Orthodox Communities", "Immigrants/Olim",
  "General public",
] as const;

export const GEOGRAPHY_OPTIONS = [
  "Israel", "Northern Israel", "Southern Israel (Negev)",
  "Jerusalem", "Tel Aviv Area", "West Bank",
  "United States", "Europe", "Global",
  "Middle East", "Africa", "Asia", "Latin America",
] as const;

export const SIZE_OPTIONS = [
  { value: "SOLO", label: "Just me" },
  { value: "SMALL", label: "2-10 people" },
  { value: "MEDIUM", label: "11-50 people" },
  { value: "LARGE", label: "51-200 people" },
  { value: "ENTERPRISE", label: "200+ people" },
] as const;

export const BUDGET_OPTIONS = [
  { value: "Under ₪1M", label: "Under ₪1M (~$280K)" },
  { value: "₪1M-₪5M", label: "₪1M-₪5M (~$280K-$1.4M)" },
  { value: "₪5M-₪20M", label: "₪5M-₪20M (~$1.4M-$5.6M)" },
  { value: "₪20M-₪50M", label: "₪20M-₪50M (~$5.6M-$14M)" },
  { value: "Over ₪50M", label: "Over ₪50M (~$14M+)" },
  { value: "Under $500K", label: "Under $500K" },
  { value: "$500K-$2M", label: "$500K-$2M" },
  { value: "$2M-$10M", label: "$2M-$10M" },
  { value: "$10M-$50M", label: "$10M-$50M" },
  { value: "Over $50M", label: "Over $50M" },
] as const;
