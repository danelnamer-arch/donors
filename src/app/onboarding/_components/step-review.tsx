"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CAUSE_OPTIONS,
  POPULATION_OPTIONS,
  GEOGRAPHY_OPTIONS,
  SIZE_OPTIONS,
  BUDGET_OPTIONS,
} from "@/lib/constants/onboarding-options";
import { SparkleIcon } from "./sparkle-icon";
import { ReExtractCard } from "./re-extract-card";
import type { SourceChip } from "./link-chip";

// ─── Types ──────────────────────────────────────────

export interface ReviewFormState {
  orgName: string;
  mission: string;
  website: string;
  country: string;
  size: string;
  budget: string;
  israeliRegNumber: string;
  politicalStance: string;
  causes: string[];
  populations: string[];
  geography: string[];
  similarOrgs: string;
  existingDonors: string;
}

interface StepReviewProps {
  form: ReviewFormState;
  onFormChange: <K extends keyof ReviewFormState>(
    field: K,
    value: ReviewFormState[K]
  ) => void;
  aiFields: Set<string>;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  // Re-extract props
  sources: SourceChip[];
  onAddSources: (s: Omit<SourceChip, "id">[]) => void;
  onRemoveSource: (id: string) => void;
  onReExtract: () => void;
  isExtracting: boolean;
  hasExtracted: boolean;
}

// ─── Helpers ────────────────────────────────────────

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item)
    ? list.filter((i) => i !== item)
    : [...list, item];
}

function FieldLabel({
  label,
  required,
  aiField,
  aiFields,
  count,
}: {
  label: string;
  required?: boolean;
  aiField?: string;
  aiFields: Set<string>;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {aiField && aiFields.has(aiField) && <SparkleIcon />}
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && " *"}
      </span>
      {count != null && count > 0 && (
        <span className="text-xs text-zinc-400">({count} selected)</span>
      )}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════
export function StepReview({
  form,
  onFormChange,
  aiFields,
  onBack,
  onSubmit,
  submitting,
  sources,
  onAddSources,
  onRemoveSource,
  onReExtract,
  isExtracting,
  hasExtracted,
}: StepReviewProps) {
  const canSubmit =
    form.orgName.trim() &&
    form.causes.length > 0 &&
    form.geography.length > 0;

  return (
    <div className="space-y-5">
      {/* Re-Extract card (shown if user has extracted at least once) */}
      {hasExtracted && (
        <ReExtractCard
          sources={sources}
          onAddSources={onAddSources}
          onRemoveSource={onRemoveSource}
          onReExtract={onReExtract}
          isExtracting={isExtracting}
        />
      )}

      <Card>
        <CardContent className="py-8">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Review your profile
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {aiFields.size > 0
              ? "We've pre-filled your info from uploaded sources. Review and edit anything."
              : "Fill in your organization details to start finding donors."}
          </p>

          <div className="mt-6 flex flex-col gap-5">
            {/* ── Basic Info ─────────────────────── */}
            <SectionDivider label="Basic Info" />

            {/* Organization Name */}
            <div>
              <FieldLabel label="Organization Name" required aiField="orgName" aiFields={aiFields} />
              <Input
                placeholder="e.g. Leket Israel"
                value={form.orgName}
                onChange={(e) => onFormChange("orgName", e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            {/* Israeli Registration Number */}
            <div>
              <FieldLabel label="Israeli Registration Number" aiField="israeliRegNumber" aiFields={aiFields} />
              <span className="ml-1 text-xs text-zinc-400">(Mispar Amuta)</span>
              <Input
                placeholder="e.g. 580123456"
                value={form.israeliRegNumber}
                onChange={(e) => onFormChange("israeliRegNumber", e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Providing this greatly improves match quality — auto-enriches from GuideStar Israel
              </p>
            </div>

            {/* Mission */}
            <div>
              <FieldLabel label="Mission Statement" aiField="mission" aiFields={aiFields} />
              <Textarea
                placeholder="What does your organization do?"
                value={form.mission}
                onChange={(e) => onFormChange("mission", e.target.value)}
                rows={4}
                className="mt-1.5"
              />
            </div>

            {/* Website */}
            <div>
              <FieldLabel label="Website" aiField="website" aiFields={aiFields} />
              <Input
                placeholder="https://your-org.org"
                value={form.website}
                onChange={(e) => onFormChange("website", e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Country + Size */}
            <div className="flex gap-4">
              <div className="flex-1">
                <FieldLabel label="Country" aiField="country" aiFields={aiFields} />
                <Input
                  placeholder="e.g. Israel"
                  value={form.country}
                  onChange={(e) => onFormChange("country", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex-1">
                <FieldLabel label="Team Size" aiField="size" aiFields={aiFields} />
                <Select
                  value={form.size}
                  onChange={(e) => onFormChange("size", e.target.value)}
                  placeholder="Select..."
                  options={[...SIZE_OPTIONS]}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <FieldLabel label="Annual Budget" aiField="budget" aiFields={aiFields} />
              <Select
                value={form.budget}
                onChange={(e) => onFormChange("budget", e.target.value)}
                placeholder="Select range..."
                options={[...BUDGET_OPTIONS]}
                className="mt-1.5"
              />
            </div>

            {/* ── Focus Areas ────────────────────── */}
            <SectionDivider label="Focus Areas" />

            {/* Causes */}
            <div>
              <FieldLabel
                label="Cause Areas"
                required
                aiField="causes"
                aiFields={aiFields}
                count={form.causes.length}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {CAUSE_OPTIONS.map((cause) => (
                  <button
                    key={cause}
                    type="button"
                    onClick={() =>
                      onFormChange("causes", toggleItem(form.causes, cause))
                    }
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      form.causes.includes(cause)
                        ? "bg-brand text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {cause}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Populations */}
            <div>
              <FieldLabel
                label="Target Populations"
                aiField="populations"
                aiFields={aiFields}
                count={form.populations.length}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULATION_OPTIONS.map((pop) => (
                  <button
                    key={pop}
                    type="button"
                    onClick={() =>
                      onFormChange("populations", toggleItem(form.populations, pop))
                    }
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      form.populations.includes(pop)
                        ? "bg-brand text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {pop}
                  </button>
                ))}
              </div>
            </div>

            {/* Geographic Focus */}
            <div>
              <FieldLabel
                label="Geographic Focus"
                required
                aiField="geography"
                aiFields={aiFields}
                count={form.geography.length}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {GEOGRAPHY_OPTIONS.map((geo) => (
                  <button
                    key={geo}
                    type="button"
                    onClick={() =>
                      onFormChange("geography", toggleItem(form.geography, geo))
                    }
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      form.geography.includes(geo)
                        ? "bg-brand text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {geo}
                  </button>
                ))}
              </div>
            </div>

            {/* Political Stance (only if set) */}
            {form.politicalStance && (
              <div>
                <FieldLabel label="Values & Orientation" aiField="politicalStance" aiFields={aiFields} />
                <Textarea
                  placeholder="Political/ideological orientation, values, stances..."
                  value={form.politicalStance}
                  onChange={(e) => onFormChange("politicalStance", e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Used to improve alignment matching with donors
                </p>
              </div>
            )}

            {/* ── Connections ────────────────────── */}
            <SectionDivider label="Connections" />

            {/* Similar Organizations */}
            <div>
              <FieldLabel label="Similar Organizations" aiField="similarOrgs" aiFields={aiFields} />
              <span className="ml-1 text-xs text-zinc-400">(optional)</span>
              <Textarea
                placeholder="Names of organizations similar to yours, separated by commas"
                hint="We'll look at their donors to find matches for you"
                value={form.similarOrgs}
                onChange={(e) => onFormChange("similarOrgs", e.target.value)}
                rows={2}
                className="mt-1.5"
              />
            </div>

            {/* Existing Donors */}
            <div>
              <FieldLabel label="Existing Donors" aiField="existingDonors" aiFields={aiFields} />
              <span className="ml-1 text-xs text-zinc-400">(optional)</span>
              <Textarea
                placeholder="Names of donors who already support you, separated by commas"
                hint="We won't show you donors you already have"
                value={form.existingDonors}
                onChange={(e) => onFormChange("existingDonors", e.target.value)}
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* ── Footer ────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <Button
              size="lg"
              onClick={onSubmit}
              loading={submitting}
              disabled={!canSubmit}
              className="gap-2"
            >
              Start Finding Donors
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
