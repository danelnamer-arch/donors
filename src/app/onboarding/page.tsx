"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { StepIndicator } from "./_components/step-indicator";
import { StepSources } from "./_components/step-sources";
import { StepReview, type ReviewFormState } from "./_components/step-review";
import type { SourceChip } from "./_components/link-chip";

// ─── Types ───────────────────────────────────────────
interface ExtractedProfile {
  name: string | null;
  mission: string | null;
  website: string | null;
  country: string | null;
  size: string | null;
  annualBudgetRange: string | null;
  israeliRegistrationNumber: string | null;
  politicalStance: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  similarOrgNames: string[];
  existingDonorNames: string[];
}

// ─── Animation variants ──────────────────────────────
const slideVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Wizard step
  const [step, setStep] = useState<1 | 2>(1);

  // Source state
  const [sources, setSources] = useState<SourceChip[]>([]);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [rawProfileText, setRawProfileText] = useState<string | null>(null);

  // AI-extracted field tracking
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  // Review form state
  const [form, setForm] = useState<ReviewFormState>({
    orgName: "",
    mission: "",
    website: "",
    country: "",
    size: "",
    budget: "",
    israeliRegNumber: "",
    politicalStance: "",
    causes: [],
    populations: [],
    geography: [],
    similarOrgs: "",
    existingDonors: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Auth guard
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // ─── Source management ─────────────────────────────
  function addSources(newSources: Omit<SourceChip, "id">[]) {
    setSources((prev) => [
      ...prev,
      ...newSources.map((s) => ({
        ...s,
        id: Math.random().toString(36).slice(2),
      })),
    ]);
  }

  function removeSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  // ─── Form change handler ──────────────────────────
  function handleFormChange<K extends keyof ReviewFormState>(
    field: K,
    value: ReviewFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Apply extraction results to form ──────────────
  function applyExtraction(
    profile: ExtractedProfile,
    merge: boolean = false
  ) {
    const newAiFields = new Set(aiFields);

    setForm((prev) => {
      const next = { ...prev };

      // For "merge" mode (re-extract): only fill empty fields & append arrays
      // For initial extract: overwrite everything
      if (!merge || !next.orgName) {
        if (profile.name) { next.orgName = profile.name; newAiFields.add("orgName"); }
      }
      if (!merge || !next.mission) {
        if (profile.mission) { next.mission = profile.mission; newAiFields.add("mission"); }
      }
      if (!merge || !next.website) {
        if (profile.website) { next.website = profile.website; newAiFields.add("website"); }
      }
      if (!merge || !next.country) {
        if (profile.country) { next.country = profile.country; newAiFields.add("country"); }
      }
      if (!merge || !next.size) {
        if (profile.size) { next.size = profile.size; newAiFields.add("size"); }
      }
      if (!merge || !next.budget) {
        if (profile.annualBudgetRange) { next.budget = profile.annualBudgetRange; newAiFields.add("budget"); }
      }
      if (!merge || !next.israeliRegNumber) {
        if (profile.israeliRegistrationNumber) { next.israeliRegNumber = profile.israeliRegistrationNumber; newAiFields.add("israeliRegNumber"); }
      }
      if (!merge || !next.politicalStance) {
        if (profile.politicalStance) { next.politicalStance = profile.politicalStance; newAiFields.add("politicalStance"); }
      }

      // Arrays: always merge (deduplicate)
      if (profile.causes.length > 0) {
        next.causes = [...new Set([...next.causes, ...profile.causes])];
        newAiFields.add("causes");
      }
      if (profile.targetPopulations.length > 0) {
        next.populations = [...new Set([...next.populations, ...profile.targetPopulations])];
        newAiFields.add("populations");
      }
      if (profile.geographicFocus.length > 0) {
        next.geography = [...new Set([...next.geography, ...profile.geographicFocus])];
        newAiFields.add("geography");
      }
      if (profile.similarOrgNames.length > 0) {
        const existing = next.similarOrgs ? next.similarOrgs.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const merged = [...new Set([...existing, ...profile.similarOrgNames])];
        next.similarOrgs = merged.join(", ");
        newAiFields.add("similarOrgs");
      }
      if (profile.existingDonorNames.length > 0) {
        const existing = next.existingDonors ? next.existingDonors.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const merged = [...new Set([...existing, ...profile.existingDonorNames])];
        next.existingDonors = merged.join(", ");
        newAiFields.add("existingDonors");
      }

      return next;
    });

    setAiFields(newAiFields);
  }

  // ─── Extract ───────────────────────────────────────
  async function handleExtract(merge: boolean = false) {
    if (sources.length === 0) return;

    setIsExtracting(true);
    setProgressIdx(0);

    const interval = setInterval(() => {
      setProgressIdx((prev) => (prev < 6 ? prev + 1 : prev));
    }, 2500);

    try {
      const res = await fetch("/api/onboarding/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: sources.map((s) => ({
            type: s.type,
            value: s.value,
            fileBase64: s.fileBase64,
            fileMimeType: s.fileMimeType,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Extraction failed. You can fill in manually.");
        if (!merge) setStep(2);
        return;
      }

      applyExtraction(data.profile, merge);
      setRawProfileText(data.rawProfileText || null);
      setHasExtracted(true);

      if (data.errors?.length) {
        toast.warning(
          `Extracted with ${data.errors.length} source error(s). Review below.`
        );
      }

      if (!merge) setStep(2);
    } catch {
      toast.error("Extraction failed. You can fill in manually.");
      if (!merge) setStep(2);
    } finally {
      clearInterval(interval);
      setIsExtracting(false);
    }
  }

  // ─── Submit ────────────────────────────────────────
  async function handleSubmit() {
    if (!form.orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    if (form.causes.length === 0) {
      toast.error("Select at least one cause area");
      return;
    }
    if (form.geography.length === 0) {
      toast.error("Select at least one geographic focus");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: form.orgName,
          mission: form.mission || undefined,
          website: form.website || undefined,
          country: form.country || undefined,
          size: form.size || undefined,
          annualBudgetRange: form.budget || undefined,
          israeliRegistrationNumber: form.israeliRegNumber || undefined,
          politicalStance: form.politicalStance || undefined,
          causes: form.causes,
          targetPopulations: form.populations,
          geographicFocus: form.geography,
          similarOrgNames: form.similarOrgs
            ? form.similarOrgs.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          existingDonorNames: form.existingDonors
            ? form.existingDonors.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          rawProfileText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-xl">
        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Wizard steps */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-sources"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <StepSources
                sources={sources}
                onAddSources={addSources}
                onRemoveSource={removeSource}
                onContinue={() => handleExtract(false)}
                onSkip={() => setStep(2)}
                isExtracting={isExtracting}
                progressIdx={progressIdx}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-review"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <StepReview
                form={form}
                onFormChange={handleFormChange}
                aiFields={aiFields}
                onBack={() => setStep(1)}
                onSubmit={handleSubmit}
                submitting={submitting}
                sources={sources}
                onAddSources={addSources}
                onRemoveSource={removeSource}
                onReExtract={() => handleExtract(true)}
                isExtracting={isExtracting}
                hasExtracted={hasExtracted}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        {session?.user?.email && (
          <p className="mt-4 text-center text-xs text-zinc-400">
            Signed in as {session.user.email}
          </p>
        )}
      </div>
    </div>
  );
}
