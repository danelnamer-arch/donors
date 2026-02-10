"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const CAUSE_OPTIONS = [
  "Education", "Health", "Environment", "Human Rights",
  "Poverty Alleviation", "Arts & Culture", "Youth Development",
  "Community Development", "Animal Welfare", "Disaster Relief",
  "Mental Health", "Women's Rights", "Technology",
  "Democracy", "Peace", "Immigration", "Housing",
  "Food Security", "Disability Rights",
];

const POPULATION_OPTIONS = [
  "Children", "Youth", "Elderly", "Women", "Refugees",
  "Low-income families", "Minorities", "People with disabilities",
  "Veterans", "Students", "Immigrants", "LGBTQ+",
  "General public",
];

const GEOGRAPHY_OPTIONS = [
  "Israel", "United States", "Europe", "Global",
  "Middle East", "Africa", "Asia", "Latin America",
];

const SIZE_OPTIONS = [
  { value: "SOLO", label: "Just me" },
  { value: "SMALL", label: "2-10 people" },
  { value: "MEDIUM", label: "11-50 people" },
  { value: "LARGE", label: "51-200 people" },
  { value: "ENTERPRISE", label: "200+ people" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [size, setSize] = useState("");
  const [causes, setCauses] = useState<string[]>([]);
  const [populations, setPopulations] = useState<string[]>([]);
  const [geography, setGeography] = useState<string[]>([]);
  const [similarOrgs, setSimilarOrgs] = useState("");
  const [existingDonors, setExistingDonors] = useState("");

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

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(
      list.includes(item)
        ? list.filter((i) => i !== item)
        : [...list, item]
    );
  }

  async function handleFinish() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          mission,
          website: website || undefined,
          country: country || undefined,
          size: size || undefined,
          causes,
          targetPopulations: populations,
          geographicFocus: geography,
          similarOrgNames: similarOrgs
            ? similarOrgs.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          existingDonorNames: existingDonors
            ? existingDonors.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-xs text-zinc-400">
            <span>Step {step} of 4</span>
            <span>{Math.round((step / 4) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-black transition-all dark:bg-white"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        <Card>
          <CardContent className="py-8">
            {/* Step 1: Organization Basics */}
            {step === 1 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold">
                    Tell us about your organization
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    We&apos;ll use this to find the best donor matches for you.
                  </p>
                </div>
                <Input
                  label="Organization Name"
                  placeholder="e.g. Leket Israel"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Mission Statement
                  </label>
                  <textarea
                    className="min-h-[100px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="What does your organization do? What's your mission?"
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                  />
                </div>
                <Input
                  label="Website (optional)"
                  placeholder="https://your-org.org"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      label="Country"
                      placeholder="e.g. Israel"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Team Size
                    </label>
                    <select
                      className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {SIZE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!orgName}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Causes & Populations */}
            {step === 2 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold">
                    What causes do you focus on?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Select all that apply. This helps match you with the right donors.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Cause Areas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CAUSE_OPTIONS.map((cause) => (
                      <button
                        key={cause}
                        type="button"
                        onClick={() => toggleItem(causes, setCauses, cause)}
                        className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                          causes.includes(cause)
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {cause}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Target Populations
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {POPULATION_OPTIONS.map((pop) => (
                      <button
                        key={pop}
                        type="button"
                        onClick={() =>
                          toggleItem(populations, setPopulations, pop)
                        }
                        className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                          populations.includes(pop)
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {pop}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={causes.length === 0}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Geographic Focus */}
            {step === 3 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold">
                    Where do you operate?
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Where does your organization have impact?
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Geographic Focus
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GEOGRAPHY_OPTIONS.map((geo) => (
                      <button
                        key={geo}
                        type="button"
                        onClick={() =>
                          toggleItem(geography, setGeography, geo)
                        }
                        className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                          geography.includes(geo)
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {geo}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    disabled={geography.length === 0}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Similar Orgs & Existing Donors */}
            {step === 4 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold">
                    Almost done!
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    This helps us find donors faster. Skip if you&apos;re not sure.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Similar Organizations (optional)
                  </label>
                  <textarea
                    className="min-h-[80px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="Names of organizations similar to yours, separated by commas"
                    value={similarOrgs}
                    onChange={(e) => setSimilarOrgs(e.target.value)}
                  />
                  <p className="text-xs text-zinc-400">
                    We&apos;ll look at their donors to find matches for you
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Existing Donors (optional)
                  </label>
                  <textarea
                    className="min-h-[80px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="Names of donors who already support you, separated by commas"
                    value={existingDonors}
                    onChange={(e) => setExistingDonors(e.target.value)}
                  />
                  <p className="text-xs text-zinc-400">
                    We won&apos;t show you donors you already have
                  </p>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleFinish}
                    loading={loading}
                    className="flex-1"
                  >
                    Start Finding Donors
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {session?.user?.name && (
          <p className="mt-4 text-center text-xs text-zinc-400">
            Signed in as {session.user.email}
          </p>
        )}
      </div>
    </div>
  );
}
