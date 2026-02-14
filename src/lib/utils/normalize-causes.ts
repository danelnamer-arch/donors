/**
 * Cause Taxonomy & Normalization
 *
 * Maps free-text cause labels to a controlled vocabulary of canonical cause areas.
 * This ensures consistent matching across donors imported from different sources
 * (IRS 990, AI discovery, manual seed data).
 *
 * Each donor keeps BOTH:
 *   - Original cause labels (for display / specificity)
 *   - Normalized canonical causes (for matching / filtering)
 *
 * The normalization is applied at import time.
 */

/**
 * Canonical cause categories — the controlled vocabulary.
 */
export const CANONICAL_CAUSES = [
  "Education",
  "Health",
  "Environment",
  "Arts & Culture",
  "Human Rights",
  "Poverty Alleviation",
  "Youth Development",
  "Women & Girls",
  "International Development",
  "Technology & STEM",
  "Disability & Accessibility",
  "Veterans & Military",
  "Elderly & Aging",
  "Faith & Religion",
  "Community Development",
  "Animal Welfare",
  "Disaster Relief",
  "Criminal Justice",
  "Housing & Homelessness",
  "Food & Agriculture",
  "Science & Research",
  "Democracy & Governance",
  "Immigration & Refugees",
  "LGBTQ Rights",
  "Mental Health",
  "Philanthropy & Grantmaking",
] as const;

export type CanonicalCause = (typeof CANONICAL_CAUSES)[number];

/**
 * Mapping from various free-text labels → canonical cause.
 * Case-insensitive matching is applied at lookup time.
 */
const CAUSE_MAP: Record<string, CanonicalCause> = {
  // Education
  education: "Education",
  "jewish education": "Education",
  "k-12 education": "Education",
  "higher education": "Education",
  "education reform": "Education",
  "scholarship fund": "Education",
  "stem education": "Education",
  "early childhood education": "Education",
  "literacy": "Education",
  "adult education": "Education",

  // Health
  health: "Health",
  healthcare: "Health",
  "medical research": "Health",
  "disease research": "Health",
  "global health": "Health",
  "public health": "Health",
  "health equity": "Health",
  "diabetes": "Health",
  "cancer research": "Health",
  "hiv/aids": "Health",

  // Mental Health
  "mental health": "Mental Health",
  "behavioral health": "Mental Health",
  "substance abuse": "Mental Health",
  "addiction recovery": "Mental Health",

  // Environment
  environment: "Environment",
  "environmental conservation": "Environment",
  "climate change": "Environment",
  "conservation": "Environment",
  "clean energy": "Environment",
  "sustainability": "Environment",
  "ocean conservation": "Environment",
  "biodiversity": "Environment",
  "clean water": "Environment",
  "renewable energy": "Environment",

  // Arts & Culture
  arts: "Arts & Culture",
  "arts and culture": "Arts & Culture",
  culture: "Arts & Culture",
  humanities: "Arts & Culture",
  "performing arts": "Arts & Culture",
  "visual arts": "Arts & Culture",
  "arts education": "Arts & Culture",
  "cultural preservation": "Arts & Culture",
  "music": "Arts & Culture",
  "film": "Arts & Culture",

  // Human Rights
  "human rights": "Human Rights",
  "civil rights": "Human Rights",
  "civil liberties": "Human Rights",
  "social justice": "Human Rights",
  "social action": "Human Rights",
  "racial justice": "Human Rights",
  "racial equity": "Human Rights",
  "social equality": "Human Rights",

  // Poverty
  "poverty alleviation": "Poverty Alleviation",
  "poverty": "Poverty Alleviation",
  "anti-poverty": "Poverty Alleviation",
  "economic development": "Poverty Alleviation",
  "economic empowerment": "Poverty Alleviation",
  "microfinance": "Poverty Alleviation",
  "social services": "Poverty Alleviation",
  "human services": "Poverty Alleviation",

  // Youth
  "youth development": "Youth Development",
  "youth": "Youth Development",
  "children": "Youth Development",
  "child welfare": "Youth Development",
  "after-school programs": "Youth Development",
  "mentoring": "Youth Development",
  "early childhood development": "Youth Development",

  // Women & Girls
  "women empowerment": "Women & Girls",
  "women's rights": "Women & Girls",
  "gender equality": "Women & Girls",
  "girls education": "Women & Girls",
  "maternal health": "Women & Girls",
  "reproductive rights": "Women & Girls",
  "women's fund": "Women & Girls",

  // International Development
  "international development": "International Development",
  international: "International Development",
  "foreign affairs": "International Development",
  "global development": "International Development",
  "global aid": "International Development",
  "foreign assistance": "International Development",

  // Technology & STEM
  "technology": "Technology & STEM",
  "stem": "Technology & STEM",
  "digital equity": "Technology & STEM",
  "computer science": "Technology & STEM",
  "innovation": "Technology & STEM",
  "science and technology": "Technology & STEM",
  "technology access": "Technology & STEM",

  // Disability
  "disability": "Disability & Accessibility",
  "disability rights": "Disability & Accessibility",
  "accessibility": "Disability & Accessibility",
  "special needs": "Disability & Accessibility",
  "inclusive education": "Disability & Accessibility",

  // Veterans
  "veterans": "Veterans & Military",
  "military families": "Veterans & Military",
  "veteran services": "Veterans & Military",

  // Elderly
  "elderly": "Elderly & Aging",
  "aging": "Elderly & Aging",
  "senior care": "Elderly & Aging",
  "elder care": "Elderly & Aging",
  "aging services": "Elderly & Aging",

  // Faith & Religion
  "religion": "Faith & Religion",
  "faith": "Faith & Religion",
  "interfaith": "Faith & Religion",
  "interfaith dialogue": "Faith & Religion",
  "jewish community": "Faith & Religion",
  "islamic relief": "Faith & Religion",
  "christian foundation": "Faith & Religion",

  // Community Development
  "community development": "Community Development",
  "community building": "Community Development",
  "neighborhood development": "Community Development",
  "rural development": "Community Development",
  "urban development": "Community Development",
  "civic engagement": "Community Development",

  // Animal Welfare
  "animal welfare": "Animal Welfare",
  "animal rights": "Animal Welfare",
  "wildlife conservation": "Animal Welfare",

  // Disaster Relief
  "disaster relief": "Disaster Relief",
  "emergency response": "Disaster Relief",
  "humanitarian aid": "Disaster Relief",
  "crisis response": "Disaster Relief",

  // Criminal Justice
  "criminal justice": "Criminal Justice",
  "criminal justice reform": "Criminal Justice",
  "crime prevention": "Criminal Justice",
  "public safety": "Criminal Justice",
  "prison reform": "Criminal Justice",
  "reentry services": "Criminal Justice",

  // Housing
  "housing": "Housing & Homelessness",
  "homelessness": "Housing & Homelessness",
  "shelter": "Housing & Homelessness",
  "affordable housing": "Housing & Homelessness",
  "housing and shelter": "Housing & Homelessness",

  // Food & Agriculture
  "food": "Food & Agriculture",
  "agriculture": "Food & Agriculture",
  "nutrition": "Food & Agriculture",
  "food security": "Food & Agriculture",
  "hunger": "Food & Agriculture",
  "anti-hunger": "Food & Agriculture",
  "food rescue": "Food & Agriculture",

  // Science & Research
  "science": "Science & Research",
  "research": "Science & Research",
  "scientific research": "Science & Research",
  "social science research": "Science & Research",

  // Democracy & Governance
  "democracy": "Democracy & Governance",
  "governance": "Democracy & Governance",
  "public affairs": "Democracy & Governance",
  "government": "Democracy & Governance",
  "public policy": "Democracy & Governance",
  "civic participation": "Democracy & Governance",

  // Immigration & Refugees
  "immigration": "Immigration & Refugees",
  "refugees": "Immigration & Refugees",
  "refugee assistance": "Immigration & Refugees",
  "immigrant services": "Immigration & Refugees",
  "refugee resettlement": "Immigration & Refugees",

  // LGBTQ Rights
  "lgbtq rights": "LGBTQ Rights",
  "lgbtq": "LGBTQ Rights",
  "lgbtq+ rights": "LGBTQ Rights",

  // Philanthropy
  "philanthropy": "Philanthropy & Grantmaking",
  "grantmaking": "Philanthropy & Grantmaking",
  "corporate social responsibility": "Philanthropy & Grantmaking",

  // Employment
  "employment": "Poverty Alleviation",
  "job training": "Poverty Alleviation",
  "workforce development": "Poverty Alleviation",

  // Recreation & Sports
  "recreation": "Youth Development",
  "sports": "Youth Development",

  // Israel-specific (map to relevant canonical causes)
  "israel": "International Development",
  "jewish identity": "Faith & Religion",
};

/**
 * Normalize a single cause string to its canonical form.
 * Returns the canonical cause if found, or the original string (title-cased) if no mapping exists.
 */
export function normalizeCause(cause: string): string {
  const key = cause.toLowerCase().trim();
  return CAUSE_MAP[key] ?? titleCase(cause);
}

/**
 * Normalize an array of causes to canonical forms, deduplicating.
 */
export function normalizeCauses(causes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const cause of causes) {
    const normalized = normalizeCause(cause);
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Title-case a string: "hello world" → "Hello World"
 */
function titleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Map NTEE major group code to canonical causes.
 * NTEE codes are the standard classification for US nonprofits.
 */
export function nteeToCauses(nteeCode: string): string[] {
  if (!nteeCode) return [];

  const majorGroup = nteeCode.charAt(0).toUpperCase();
  const causeMap: Record<string, CanonicalCause[]> = {
    A: ["Arts & Culture"],
    B: ["Education"],
    C: ["Environment"],
    D: ["Animal Welfare"],
    E: ["Health"],
    F: ["Mental Health"],
    G: ["Health", "Science & Research"],
    H: ["Health", "Science & Research"],
    I: ["Criminal Justice"],
    J: ["Poverty Alleviation"],
    K: ["Food & Agriculture"],
    L: ["Housing & Homelessness"],
    M: ["Disaster Relief"],
    N: ["Youth Development"],
    O: ["Youth Development"],
    P: ["Poverty Alleviation"],
    Q: ["International Development"],
    R: ["Human Rights"],
    S: ["Community Development"],
    T: ["Philanthropy & Grantmaking"],
    U: ["Technology & STEM", "Science & Research"],
    V: ["Science & Research"],
    W: ["Democracy & Governance"],
    X: ["Faith & Religion"],
    Y: ["Community Development"],
    Z: [],
  };

  return causeMap[majorGroup] ?? [];
}
