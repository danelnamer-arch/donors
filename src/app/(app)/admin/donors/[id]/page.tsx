"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/modal";
import { formatGrantAmount } from "@/lib/utils/format-amount";

interface Donor {
  id: string;
  name: string;
  type: string;
  description: string | null;
  website: string | null;
  websiteVerified: boolean;
  websiteSource: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  headquartersCountry: string | null;
  headquartersCity: string | null;
  activeRegions: string[];
  location: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  totalGivingUsd: number | null;
  avgGrantSizeUsd: number | null;
  grantCount: number;
  givingYearRange: string | null;
  dataQualityScore: number;
  researchStatus: string;
  ein: string | null;
  createdAt: string;
  updatedAt: string;
  grants: { id: string; recipientName: string; amount: number | null; year: number | null; purpose: string | null; sourceUrl: string | null }[];
  publications: { id: string; title: string; type: string; url: string; summary: string | null }[];
  _count: { matches: number; pipelineEntries: number };
}

interface ProposedChange {
  field: string;
  label: string;
  currentValue: unknown;
  proposedValue: unknown;
  source: string;
  confidence: number;
}

type Scope = "full" | "website" | "geography" | "giving" | "description" | "causes" | "publications";

export default function AdminDonorEdit() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [donor, setDonor] = useState<Donor | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Enrichment preview state
  const [proposals, setProposals] = useState<ProposedChange[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [enrichingScope, setEnrichingScope] = useState<Scope | null>(null);
  const [applying, setApplying] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", type: "FOUNDATION", description: "", website: "", websiteVerified: false,
    email: "", phone: "", headquartersCountry: "", headquartersCity: "", activeRegions: "",
    causes: "", targetPopulations: "", geographicFocus: "", totalGivingUsd: "",
    avgGrantSizeUsd: "", grantCount: "", givingYearRange: "", dataQualityScore: "",
    researchStatus: "COMPLETED", ein: "",
  });

  const loadDonor = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/donors/${id}`);
      const d: Donor = await res.json();
      setDonor(d);
      setForm({
        name: d.name, type: d.type, description: d.description ?? "", website: d.website ?? "",
        websiteVerified: d.websiteVerified, email: d.email ?? "", phone: d.phone ?? "",
        headquartersCountry: d.headquartersCountry ?? "", headquartersCity: d.headquartersCity ?? "",
        activeRegions: (d.activeRegions ?? []).join(", "), causes: d.causes.join(", "),
        targetPopulations: d.targetPopulations.join(", "), geographicFocus: d.geographicFocus.join(", "),
        totalGivingUsd: d.totalGivingUsd?.toString() ?? "", avgGrantSizeUsd: d.avgGrantSizeUsd?.toString() ?? "",
        grantCount: d.grantCount.toString(), givingYearRange: d.givingYearRange ?? "",
        dataQualityScore: d.dataQualityScore.toString(), researchStatus: d.researchStatus, ein: d.ein ?? "",
      });
    } catch {
      toast.error("Failed to load donor");
    }
  }, [id]);

  useEffect(() => { loadDonor(); }, [loadDonor]);

  const handleSave = async () => {
    setSaving(true);
    const splitArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
    const data = {
      name: form.name, type: form.type, description: form.description || null,
      website: form.website || null, websiteVerified: form.websiteVerified,
      email: form.email || null, phone: form.phone || null,
      headquartersCountry: form.headquartersCountry || null, headquartersCity: form.headquartersCity || null,
      activeRegions: splitArr(form.activeRegions), causes: splitArr(form.causes),
      targetPopulations: splitArr(form.targetPopulations), geographicFocus: splitArr(form.geographicFocus),
      totalGivingUsd: form.totalGivingUsd ? parseFloat(form.totalGivingUsd) : null,
      avgGrantSizeUsd: form.avgGrantSizeUsd ? parseFloat(form.avgGrantSizeUsd) : null,
      grantCount: parseInt(form.grantCount) || 0, givingYearRange: form.givingYearRange || null,
      dataQualityScore: parseFloat(form.dataQualityScore) || 0, researchStatus: form.researchStatus,
      ein: form.ein || null,
    };
    try {
      const res = await fetch(`/api/admin/donors/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Saved successfully");
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error ?? "Save failed"}`);
      }
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  };

  const handleEnrichPreview = async (scope: Scope) => {
    setEnrichingScope(scope);
    setProposals([]);
    setAccepted(new Set());
    const toastId = toast.loading(`Running ${scope} enrichment preview...`);

    try {
      const res = await fetch("/api/admin/enrich-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: id, scope }),
      });
      const data = await res.json();
      if (data.proposals?.length > 0) {
        setProposals(data.proposals);
        toast.success(`Found ${data.proposals.length} proposed changes`, { id: toastId });
      } else {
        toast.info("No changes proposed — data is already up to date.", { id: toastId });
      }
    } catch {
      toast.error("Enrichment failed", { id: toastId });
    }
    setEnrichingScope(null);
  };

  const toggleAccepted = (field: string) => {
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const acceptAll = () => setAccepted(new Set(proposals.map(p => p.field)));
  const rejectAll = () => { setAccepted(new Set()); setProposals([]); };

  const applyAccepted = async () => {
    if (accepted.size === 0) return;
    setApplying(true);

    const changes = proposals
      .filter(p => accepted.has(p.field))
      .map(p => ({ field: p.field, value: p.proposedValue }));

    try {
      const res = await fetch("/api/admin/apply-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: id, changes }),
      });

      const data = await res.json();
      if (data.success) {
        const parts = [];
        if (data.fieldsUpdated) parts.push(`${data.fieldsUpdated} fields`);
        if (data.grantsAdded) parts.push(`${data.grantsAdded} grants`);
        if (data.pubsAdded) parts.push(`${data.pubsAdded} publications`);
        toast.success(`Applied: ${parts.join(", ") || "no changes"}.`);
        setProposals([]);
        setAccepted(new Set());
        await loadDonor();
      } else {
        toast.error(`Error applying changes: ${data.error}`);
      }
    } catch {
      toast.error("Failed to apply changes");
    }
    setApplying(false);
  };

  const handleDelete = async () => {
    try {
      await fetch(`/api/admin/donors/${id}`, { method: "DELETE" });
      toast.success("Donor deleted");
      router.push("/admin");
    } catch {
      toast.error("Delete failed");
    }
  };

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    return formatGrantAmount(n);
  };

  const formatValue = (val: unknown): string => {
    if (val == null) return "—";
    if (Array.isArray(val)) {
      if (val.length === 0) return "—";
      if (typeof val[0] === "object") return JSON.stringify(val, null, 1);
      return val.join(", ");
    }
    if (typeof val === "number") {
      if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
      return String(val);
    }
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };

  if (!donor) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">Loading...</div>
      </main>
    );
  }

  const SectionHeader = ({ title, scope }: { title: string; scope: Scope }) => (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleEnrichPreview(scope)}
        disabled={enrichingScope !== null}
        loading={enrichingScope === scope}
        className="text-xs"
      >
        {enrichingScope === scope ? "Researching..." : "Enrich & Verify"}
      </Button>
    </div>
  );

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Top bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{donor.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge>{donor.type}</Badge>
              <Badge variant={donor.researchStatus === "COMPLETED" ? "success" : donor.researchStatus === "FAILED" ? "danger" : "default"}>
                {donor.researchStatus}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleEnrichPreview("full")}
              disabled={enrichingScope !== null}
              loading={enrichingScope === "full"}
            >
              {enrichingScope === "full" ? "Researching..." : "Enrich All"}
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Approval Panel — shows when there are proposals */}
        {proposals.length > 0 && (
          <Card className="mb-6 border-2 border-blue-300 dark:border-blue-700">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100">
                  Proposed Changes ({proposals.length}) — Review before applying
                </h2>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={acceptAll} className="text-xs text-green-600">
                    Accept All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={rejectAll} className="text-xs text-red-600">
                    Dismiss All
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {proposals.map((p) => (
                  <div
                    key={p.field}
                    className={`rounded-lg border p-3 transition-colors ${
                      accepted.has(p.field)
                        ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.label}</span>
                          <Badge variant={p.confidence >= 0.8 ? "success" : p.confidence >= 0.6 ? "warning" : "danger"}>
                            {Math.round(p.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">Source: {p.source}</div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wide text-red-500">Current</div>
                            <div className="mt-0.5 rounded-lg bg-red-50 p-2 text-xs text-zinc-700 dark:bg-red-900/20 dark:text-zinc-300">
                              {formatValue(p.currentValue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium uppercase tracking-wide text-green-600">Proposed</div>
                            <div className="mt-0.5 rounded-lg bg-green-50 p-2 text-xs text-zinc-700 dark:bg-green-900/20 dark:text-zinc-300">
                              {formatValue(p.proposedValue)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant={accepted.has(p.field) ? "primary" : "outline"}
                        size="sm"
                        onClick={() => toggleAccepted(p.field)}
                        className="shrink-0 text-xs"
                      >
                        {accepted.has(p.field) ? "Accepted" : "Accept"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {accepted.size > 0 && (
                <Button
                  onClick={applyAccepted}
                  disabled={applying}
                  loading={applying}
                  className="mt-3 w-full"
                >
                  {applying ? "Applying..." : `Apply ${accepted.size} Accepted Change${accepted.size > 1 ? "s" : ""}`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Form */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <SectionHeader title="Basic Info" scope="description" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Select
                    label="Type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    options={[
                      { value: "FOUNDATION", label: "Foundation" },
                      { value: "INDIVIDUAL", label: "Individual" },
                      { value: "CORPORATE", label: "Corporate" },
                      { value: "GOVERNMENT", label: "Government" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                  <Input label="EIN" value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })} />
                  <Select
                    label="Research Status"
                    value={form.researchStatus}
                    onChange={(e) => setForm({ ...form, researchStatus: e.target.value })}
                    options={[
                      { value: "PENDING", label: "Pending" },
                      { value: "IN_PROGRESS", label: "In Progress" },
                      { value: "COMPLETED", label: "Completed" },
                      { value: "FAILED", label: "Failed" },
                      { value: "NEEDS_UPDATE", label: "Needs Update" },
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeader title="Contact & Website" scope="website" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={form.websiteVerified}
                        onChange={(e) => setForm({ ...form, websiteVerified: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand"
                      />
                      Website Verified
                    </label>
                  </div>
                  <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeader title="Location & Geography" scope="geography" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="HQ Country" value={form.headquartersCountry} onChange={(e) => setForm({ ...form, headquartersCountry: e.target.value })} />
                  <Input label="HQ City" value={form.headquartersCity} onChange={(e) => setForm({ ...form, headquartersCity: e.target.value })} />
                  <div className="sm:col-span-2">
                    <Input label="Active Regions" hint="Comma-separated" value={form.activeRegions} onChange={(e) => setForm({ ...form, activeRegions: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Input label="Geographic Focus" hint="Comma-separated" value={form.geographicFocus} onChange={(e) => setForm({ ...form, geographicFocus: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeader title="Causes & Populations" scope="causes" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <Input label="Causes" hint="Comma-separated" value={form.causes} onChange={(e) => setForm({ ...form, causes: e.target.value })} />
                  <Input label="Target Populations" hint="Comma-separated" value={form.targetPopulations} onChange={(e) => setForm({ ...form, targetPopulations: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeader title="Giving Statistics" scope="giving" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Total Giving (USD)" value={form.totalGivingUsd} onChange={(e) => setForm({ ...form, totalGivingUsd: e.target.value })} />
                  <Input label="Avg Grant Size (USD)" value={form.avgGrantSizeUsd} onChange={(e) => setForm({ ...form, avgGrantSizeUsd: e.target.value })} />
                  <Input label="Grant Count" value={form.grantCount} onChange={(e) => setForm({ ...form, grantCount: e.target.value })} />
                  <Input label="Giving Year Range" value={form.givingYearRange} onChange={(e) => setForm({ ...form, givingYearRange: e.target.value })} />
                  <Input label="Data Quality Score (0-1)" value={form.dataQualityScore} onChange={(e) => setForm({ ...form, dataQualityScore: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSave}
              loading={saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Manual Changes"}
            </Button>
          </div>

          {/* Right: Grants & Publications */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Grants ({donor.grants.length})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEnrichPreview("giving")}
                  disabled={enrichingScope !== null}
                  loading={enrichingScope === "giving"}
                  className="text-xs"
                >
                  {enrichingScope === "giving" ? "Searching..." : "Find New Grants"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {donor.grants.length === 0 ? (
                    <p className="text-sm text-zinc-400">No grants recorded</p>
                  ) : donor.grants.map((g) => (
                    <div key={g.id} className="rounded-lg border border-zinc-100 p-2.5 text-xs dark:border-zinc-800">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{g.recipientName}</div>
                      <div className="mt-0.5 text-zinc-500">
                        {fmt(g.amount)} {g.year && `(${g.year})`}
                      </div>
                      {g.purpose && <div className="mt-1 text-zinc-400">{g.purpose}</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Publications ({donor.publications.length})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEnrichPreview("publications")}
                  disabled={enrichingScope !== null}
                  loading={enrichingScope === "publications"}
                  className="text-xs"
                >
                  {enrichingScope === "publications" ? "Searching..." : "Find Publications"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {donor.publications.length === 0 ? (
                    <p className="text-sm text-zinc-400">No publications found</p>
                  ) : donor.publications.map((p) => (
                    <div key={p.id} className="rounded-lg border border-zinc-100 p-2.5 text-xs dark:border-zinc-800">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">{p.title}</a>
                      <div className="mt-0.5 text-zinc-400">{p.type}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Metadata</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-xs text-zinc-500">
                  <div className="flex justify-between">
                    <span>ID</span>
                    <span className="font-mono text-zinc-400">{donor.id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{new Date(donor.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated</span>
                    <span>{new Date(donor.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matches</span>
                    <span>{donor._count.matches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pipeline entries</span>
                    <span>{donor._count.pipelineEntries}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete donor"
        description={`Delete "${donor.name}" and all related data? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </>
  );
}
