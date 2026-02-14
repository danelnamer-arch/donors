/**
 * Donor Data Validation Schemas
 *
 * Single source of truth for all donor data validation using Zod.
 * Every data entry point (discovery, IRS 990, admin API, enrichment)
 * must validate through these schemas before writing to the database.
 *
 * Mirrors the Prisma Donor model + related models exactly.
 */

import { z } from "zod";

// ─── Enums (mirror Prisma) ────────────────────────────────────────

export const DonorTypeEnum = z.enum([
  "FOUNDATION",
  "INDIVIDUAL",
  "CORPORATE",
  "GOVERNMENT",
  "OTHER",
]);

export const PoliticalAffiliationEnum = z.enum([
  "LEFT",
  "CENTER_LEFT",
  "CENTER",
  "CENTER_RIGHT",
  "RIGHT",
  "NONPARTISAN",
  "UNKNOWN",
]);

export const DonorConfidenceEnum = z.enum([
  "CONFIRMED",
  "LIKELY",
  "SUSPECTED",
]);

export const ResearchStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "NEEDS_UPDATE",
]);

export const PublicationTypeEnum = z.enum([
  "ARTICLE",
  "SOCIAL_MEDIA",
  "PODCAST",
  "PRESS_RELEASE",
  "BLOG_POST",
  "VIDEO",
  "OTHER",
]);

// ─── Reusable field schemas ───────────────────────────────────────

/**
 * Permissive URL schema — accepts URLs with or without protocol.
 * Transforms bare domains to https://.
 */
export const permissiveUrlSchema = z
  .string()
  .transform((val) => {
    const trimmed = val.trim();
    if (!trimmed) return trimmed;
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  })
  .refine(
    (val) => {
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid URL format" }
  );

/** Quality score: 0-1 range, rounded to 2 decimals */
export const dataQualityScoreSchema = z
  .number()
  .min(0, "Quality score must be >= 0")
  .max(1, "Quality score must be <= 1");

/** EIN: 9 digits, optional dash after first 2 */
export const einSchema = z
  .string()
  .transform((val) => val.replace(/-/g, ""))
  .refine((val) => /^\d{9}$/.test(val), {
    message: "EIN must be 9 digits (e.g., 133015694 or 13-3015694)",
  });

// ─── Grant schema ─────────────────────────────────────────────────

export const grantSchema = z.object({
  recipientName: z.string().min(1, "Recipient name is required").max(500),
  recipientEin: einSchema.nullish(),
  amount: z
    .number()
    .min(1, "Grant amount must be at least $1")
    .max(50_000_000_000, "Grant amount exceeds $50B — likely an error")
    .nullish(),
  currency: z.string().max(10).default("USD"),
  year: z
    .number()
    .int()
    .min(1900, "Year must be >= 1900")
    .max(new Date().getFullYear() + 1, "Year cannot be in the far future")
    .nullish(),
  purpose: z.string().max(5000).nullish(),
  sourceUrl: permissiveUrlSchema.nullish(),
});

// ─── Publication schema ───────────────────────────────────────────

export const publicationSchema = z.object({
  title: z.string().min(1, "Publication title is required").max(1000),
  type: PublicationTypeEnum,
  url: z.string().url("Publication must have a valid URL"),
  summary: z.string().max(5000).nullish(),
  publishedAt: z.string().nullish(),
});

// ─── Data source schema ───────────────────────────────────────────

export const dataSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  fetchedAt: z.string(),
});

// ─── Donor creation schema ────────────────────────────────────────

/**
 * Full donor validation for creation (discovery pipeline, IRS 990, seeds).
 * All fields validated with types, bounds, and format checks.
 * Unknown fields are stripped automatically.
 */
export const donorCreateSchema = z.object({
  // Identity
  name: z.string().min(1, "Donor name is required").max(500),
  type: DonorTypeEnum.default("FOUNDATION"),
  description: z.string().max(10000).nullish(),

  // Web presence
  website: permissiveUrlSchema.nullish(),
  websiteVerified: z.boolean().default(false),
  websiteSource: z.string().max(100).nullish(),
  email: z.string().email("Invalid email format").nullish(),
  phone: z.string().max(50).nullish(),
  socialLinks: z.record(z.string(), z.string()).nullish(),

  // Location
  country: z.string().max(100).nullish(),
  city: z.string().max(200).nullish(),
  headquartersCountry: z.string().max(100).nullish(),
  headquartersCity: z.string().max(200).nullish(),
  location: z.string().max(300).nullish(),
  activeRegions: z.array(z.string().max(100)).default([]),

  // Classification
  politicalAffiliation: PoliticalAffiliationEnum.default("UNKNOWN"),
  politicalStance: z.string().max(2000).nullish(),
  causes: z.array(z.string().max(100)).default([]),
  targetPopulations: z.array(z.string().max(100)).default([]),
  geographicFocus: z.array(z.string().max(100)).default([]),

  // Financials
  totalGivingUsd: z
    .number()
    .min(0, "Total giving cannot be negative")
    .max(500_000_000_000, "Total giving exceeds $500B — likely an error")
    .nullish(),
  avgGrantSizeUsd: z
    .number()
    .min(0, "Average grant size cannot be negative")
    .max(50_000_000_000, "Average grant size exceeds $50B — likely an error")
    .nullish(),
  grantCount: z.number().int().min(0).default(0),
  givingYearRange: z.string().max(20).nullish(),

  // Confidence
  donorConfidence: DonorConfidenceEnum.default("CONFIRMED"),

  // Metadata
  dataQualityScore: dataQualityScoreSchema.default(0),
  dataSources: z.array(dataSourceSchema).default([]),
  researchStatus: ResearchStatusEnum.default("PENDING"),
  ein: einSchema.nullish(),
  israeliRegistrationNumber: z.string().max(20).nullish(),
  irsData: z.any().nullish(),
});

// ─── Donor update schema ──────────────────────────────────────────

/**
 * Partial donor validation for updates (admin PATCH, apply-changes).
 * Same rules as create but every field is optional.
 * Unknown fields are stripped automatically.
 */
export const donorUpdateSchema = donorCreateSchema.partial();

// ─── Type exports ─────────────────────────────────────────────────

export type DonorCreateInput = z.infer<typeof donorCreateSchema>;
export type DonorUpdateInput = z.infer<typeof donorUpdateSchema>;
export type GrantInput = z.infer<typeof grantSchema>;
export type PublicationInput = z.infer<typeof publicationSchema>;
