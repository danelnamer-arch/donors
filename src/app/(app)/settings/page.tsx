"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  CAUSE_OPTIONS,
  GEOGRAPHY_OPTIONS,
  SIZE_OPTIONS,
  BUDGET_OPTIONS,
} from "@/lib/constants/onboarding-options";
import { getSimilarOrgNames, getExistingDonorNames, type JsonValue } from "@/lib/utils/org-helpers";

// ─── Types ──────────────────────────────────────────────

interface OrgProfile {
  id: string;
  name: string;
  mission: string | null;
  website: string | null;
  country: string | null;
  location: string | null;
  size: string | null;
  annualBudgetRange: string | null;
  politicalAffiliation: string;
  politicalStance: string | null;
  israeliRegistrationNumber: string | null;
  guidestarIsraelUrl: string | null;
  causes: string[];
  targetAudience: string | null;
  geographicFocus: string[];
  similarOrgs: JsonValue[];
  existingDonors: JsonValue[];
}

// ─── Profile completeness fields ─────────────────────────

const COMPLETENESS_FIELDS = [
  { key: "name", label: "Organization name", check: (o: OrgProfile) => !!o.name },
  { key: "mission", label: "Mission statement", check: (o: OrgProfile) => !!o.mission },
  { key: "causes", label: "Focus areas", check: (o: OrgProfile) => o.causes.length > 0 },
  { key: "geo", label: "Target regions", check: (o: OrgProfile) => o.geographicFocus.length > 0 },
  { key: "website", label: "Website", check: (o: OrgProfile) => !!o.website },
  { key: "similar", label: "Similar organizations", check: (o: OrgProfile) => getSimilarOrgNames(o.similarOrgs).length > 0 },
] as const;

function getCompleteness(org: OrgProfile): { percent: number; fields: { label: string; done: boolean }[] } {
  const fields = COMPLETENESS_FIELDS.map((f) => ({ label: f.label, done: f.check(org) }));
  const done = fields.filter((f) => f.done).length;
  return { percent: Math.round((done / fields.length) * 100), fields };
}

// ─── ChipListCard ────────────────────────────────────────

interface ChipListCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  actionButton?: React.ReactNode;
  saving?: boolean;
}

function ChipListCard({
  icon,
  title,
  subtitle,
  items,
  onUpdate,
  suggestions,
  placeholder = "Enter name...",
  actionButton,
  saving,
}: ChipListCardProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(input.toLowerCase()) &&
          !items.some((i) => i.toLowerCase() === s.toLowerCase())
      )
    : [];

  function handleAdd(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    onUpdate([...items, trimmed]);
    setInput("");
    setShowSuggestions(false);
  }

  function handleRemove(index: number) {
    onUpdate(items.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
              <p className="text-sm text-zinc-500">{subtitle}</p>
            </div>
          </div>
          {actionButton}
        </div>

        {/* Chips */}
        {items.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {items.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="ml-0.5 rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  title="Remove"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search/Add input */}
        <div className="relative mt-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (suggestions) setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions && input) setShowSuggestions(true);
              }}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd(input);
                }
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleAdd(input)}
              disabled={!input.trim() || saving}
            >
              +
            </Button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {filtered.slice(0, 10).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAdd(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state for the "Organization" card
  const [name, setName] = useState("");
  const [israeliRegNumber, setIsraeliRegNumber] = useState("");
  const [mission, setMission] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [size, setSize] = useState("");
  const [budget, setBudget] = useState("");

  const fetchOrg = useCallback(async () => {
    if (!session?.user) return;

    try {
      // Get org ID from the user's token
      const res = await fetch("/api/user/me");
      const me = await res.json();
      if (!me.organizationId) {
        router.push("/onboarding");
        return;
      }

      const orgRes = await fetch(`/api/organizations/${me.organizationId}`);
      if (!orgRes.ok) {
        toast.error("Failed to load organization");
        return;
      }

      const data: OrgProfile = await orgRes.json();
      setOrg(data);

      // Populate form fields
      setName(data.name || "");
      setIsraeliRegNumber(data.israeliRegistrationNumber || "");
      setMission(data.mission || "");
      setWebsite(data.website || "");
      setCountry(data.country || "");
      setSize(data.size || "");
      setBudget(data.annualBudgetRange || "");
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [session, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchOrg();
    }
  }, [status, router, fetchOrg]);

  // ─── PATCH helper ─────────────────────────────────────
  async function patchOrg(data: Record<string, unknown>) {
    if (!org) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Update failed");
        return;
      }

      const updated: OrgProfile = await res.json();
      setOrg(updated);
      toast.success("Saved");
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  }

  // ─── Save basic info ──────────────────────────────────
  function handleSaveBasicInfo() {
    patchOrg({
      name,
      israeliRegistrationNumber: israeliRegNumber || null,
      mission: mission || null,
      website: website || null,
      country: country || null,
      size: size || null,
      annualBudgetRange: budget || null,
    });
  }

  // ─── Array field updaters ─────────────────────────────
  function updateCauses(items: string[]) {
    if (!org) return;
    setOrg({ ...org, causes: items });
    patchOrg({ causes: items });
  }

  function updateTargetAudience(value: string) {
    if (!org) return;
    const trimmed = value || null;
    setOrg({ ...org, targetAudience: trimmed });
    patchOrg({ targetAudience: trimmed });
  }

  function updateGeography(items: string[]) {
    if (!org) return;
    setOrg({ ...org, geographicFocus: items });
    patchOrg({ geographicFocus: items });
  }

  function updateSimilarOrgs(items: string[]) {
    if (!org) return;
    const jsonValues = items.map((name) => ({ name })) as JsonValue[];
    setOrg({ ...org, similarOrgs: jsonValues });
    patchOrg({ similarOrgs: jsonValues });
  }

  function updateExistingDonors(items: string[]) {
    if (!org) return;
    const jsonValues = items.map((name) => ({ name })) as JsonValue[];
    setOrg({ ...org, existingDonors: jsonValues });
    patchOrg({ existingDonors: jsonValues });
  }

  // ─── Generate similar orgs ─────────────────────────────
  async function handleGenerateMore() {
    if (!org) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}/discover-peer-donors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Discovery failed");
        return;
      }

      toast.success("Discovering similar organizations...");
      // Refresh to pick up new similar org names
      setTimeout(() => fetchOrg(), 3000);
    } catch {
      toast.error("Discovery failed");
    } finally {
      setGenerating(false);
    }
  }

  // ─── Loading state ────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-60 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-zinc-500">No organization found. Please complete onboarding.</p>
        <Button className="mt-4" onClick={() => router.push("/onboarding")}>
          Go to Onboarding
        </Button>
      </div>
    );
  }

  const completeness = getCompleteness(org);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Manage your organization and account preferences
      </p>

      <div className="mt-8 space-y-6">
        {/* ─── Profile Completeness ──────────────────── */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Profile Completeness
              </h3>
              <span className="text-2xl font-bold text-brand">
                {completeness.percent}%
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${completeness.percent}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {completeness.fields.map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-sm">
                  {f.done ? (
                    <svg className="h-4 w-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    </svg>
                  )}
                  <span className={f.done ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}>
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Organization Info ──────────────────────── */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Organization
                </h3>
                <p className="text-sm text-zinc-500">Your nonprofit&apos;s information</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Organization Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Israeli Registration Number
                  <span className="ml-1 text-xs font-normal text-zinc-400">(Mispar Amuta)</span>
                </label>
                <Input
                  placeholder="e.g. 580123456"
                  value={israeliRegNumber}
                  onChange={(e) => setIsraeliRegNumber(e.target.value)}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Providing this auto-enriches from GuideStar Israel
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Mission Statement
                </label>
                <Textarea
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  rows={4}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Website
                </label>
                <Input
                  placeholder="https://your-org.org"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Country
                  </label>
                  <Input
                    placeholder="e.g. Israel"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Team Size
                  </label>
                  <Select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="Select..."
                    options={[...SIZE_OPTIONS]}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Annual Budget
                </label>
                <Select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Select range..."
                  options={[...BUDGET_OPTIONS]}
                  className="mt-1.5"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBasicInfo} loading={saving}>
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Focus Areas ────────────────────────────── */}
        <ChipListCard
          icon={<span>◎</span>}
          title="Focus Areas"
          subtitle="Select the causes your organization works in"
          items={org.causes}
          onUpdate={updateCauses}
          suggestions={CAUSE_OPTIONS}
          placeholder="Type to search or add focus area..."
          saving={saving}
        />

        {/* ─── Target Audience ──────────────────────────── */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Target Audience
                </h3>
                <p className="text-sm text-zinc-500">Who does your organization serve?</p>
              </div>
            </div>
            <Textarea
              value={org.targetAudience ?? ""}
              onChange={(e) => setOrg({ ...org, targetAudience: e.target.value || null })}
              onBlur={() => updateTargetAudience(org.targetAudience ?? "")}
              rows={3}
              placeholder="Describe the populations and communities your organization serves..."
              className="mt-4"
            />
          </CardContent>
        </Card>

        {/* ─── Geographic Focus ───────────────────────── */}
        <ChipListCard
          icon={<span>◎</span>}
          title="Geographic Focus"
          subtitle="Where does your organization operate?"
          items={org.geographicFocus}
          onUpdate={updateGeography}
          suggestions={GEOGRAPHY_OPTIONS}
          placeholder="Type to search regions..."
          saving={saving}
        />

        {/* ─── Similar Organizations ──────────────────── */}
        <ChipListCard
          icon={<span>📋</span>}
          title="Similar Organizations"
          subtitle="Add look-alike organizations to find donors who support similar causes"
          items={getSimilarOrgNames(org.similarOrgs)}
          onUpdate={updateSimilarOrgs}
          placeholder="Enter organization name..."
          saving={saving}
          actionButton={
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateMore}
              loading={generating}
            >
              <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Generate More
            </Button>
          }
        />

        {/* ─── Existing Donors ────────────────────────── */}
        <ChipListCard
          icon={<span>💰</span>}
          title="Existing Donors"
          subtitle="Donors who already support you — we won't show them as matches"
          items={getExistingDonorNames(org.existingDonors)}
          onUpdate={updateExistingDonors}
          placeholder="Enter donor name..."
          saving={saving}
        />

        {/* ─── Account ────────────────────────────────── */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">👤</span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Account
              </h3>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <Avatar
                name={session?.user?.name || session?.user?.email || "User"}
                src={session?.user?.image}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-sm text-zinc-500">
                  {session?.user?.email}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/billing")}
              >
                Manage Billing
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
