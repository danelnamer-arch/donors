"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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

export default function AdminDonorEdit() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [donor, setDonor] = useState<Donor | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [enriching, setEnriching] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    type: "FOUNDATION",
    description: "",
    website: "",
    websiteVerified: false,
    email: "",
    phone: "",
    headquartersCountry: "",
    headquartersCity: "",
    activeRegions: "",
    causes: "",
    targetPopulations: "",
    geographicFocus: "",
    totalGivingUsd: "",
    avgGrantSizeUsd: "",
    grantCount: "",
    givingYearRange: "",
    dataQualityScore: "",
    researchStatus: "COMPLETED",
    ein: "",
  });

  useEffect(() => {
    fetch(`/api/admin/donors/${id}`)
      .then((r) => r.json())
      .then((d: Donor) => {
        setDonor(d);
        setForm({
          name: d.name,
          type: d.type,
          description: d.description ?? "",
          website: d.website ?? "",
          websiteVerified: d.websiteVerified,
          email: d.email ?? "",
          phone: d.phone ?? "",
          headquartersCountry: d.headquartersCountry ?? "",
          headquartersCity: d.headquartersCity ?? "",
          activeRegions: (d.activeRegions ?? []).join(", "),
          causes: d.causes.join(", "),
          targetPopulations: d.targetPopulations.join(", "),
          geographicFocus: d.geographicFocus.join(", "),
          totalGivingUsd: d.totalGivingUsd?.toString() ?? "",
          avgGrantSizeUsd: d.avgGrantSizeUsd?.toString() ?? "",
          grantCount: d.grantCount.toString(),
          givingYearRange: d.givingYearRange ?? "",
          dataQualityScore: d.dataQualityScore.toString(),
          researchStatus: d.researchStatus,
          ein: d.ein ?? "",
        });
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const splitArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

    const data = {
      name: form.name,
      type: form.type,
      description: form.description || null,
      website: form.website || null,
      websiteVerified: form.websiteVerified,
      email: form.email || null,
      phone: form.phone || null,
      headquartersCountry: form.headquartersCountry || null,
      headquartersCity: form.headquartersCity || null,
      activeRegions: splitArr(form.activeRegions),
      causes: splitArr(form.causes),
      targetPopulations: splitArr(form.targetPopulations),
      geographicFocus: splitArr(form.geographicFocus),
      totalGivingUsd: form.totalGivingUsd ? parseFloat(form.totalGivingUsd) : null,
      avgGrantSizeUsd: form.avgGrantSizeUsd ? parseFloat(form.avgGrantSizeUsd) : null,
      grantCount: parseInt(form.grantCount) || 0,
      givingYearRange: form.givingYearRange || null,
      dataQualityScore: parseFloat(form.dataQualityScore) || 0,
      researchStatus: form.researchStatus,
      ein: form.ein || null,
    };

    const res = await fetch(`/api/admin/donors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setMessage("Saved successfully");
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error ?? "Save failed"}`);
    }
    setSaving(false);
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setMessage("Enriching donor data...");
    const res = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enrich", donorId: id }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(`Enriched: +${data.enrichedData?.newGrantsAdded ?? 0} grants, +${data.enrichedData?.newPublicationsAdded ?? 0} publications`);
      // Refresh
      const updated = await fetch(`/api/admin/donors/${id}`).then(r => r.json());
      setDonor(updated);
    } else {
      setMessage(`Enrich failed: ${data.error}`);
    }
    setEnriching(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${donor?.name}" and all related data? This cannot be undone.`)) return;
    await fetch(`/api/admin/donors/${id}`, { method: "DELETE" });
    router.push("/admin");
  };

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  if (!donor) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">← Admin</Link>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{donor.name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="rounded-lg border border-blue-300 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              {enriching ? "Enriching..." : "Enrich"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {message && (
          <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${message.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Form */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Basic Info</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                    {["FOUNDATION", "INDIVIDUAL", "CORPORATE", "GOVERNMENT", "OTHER"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Field label="EIN" value={form.ein} onChange={(v) => setForm({ ...form, ein: v })} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Research Status</label>
                  <select value={form.researchStatus} onChange={(e) => setForm({ ...form, researchStatus: e.target.value })} className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                    {["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NEEDS_UPDATE"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Contact & Website</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.websiteVerified} onChange={(e) => setForm({ ...form, websiteVerified: e.target.checked })} />
                    Website Verified
                  </label>
                </div>
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Location & Geography</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="HQ Country" value={form.headquartersCountry} onChange={(v) => setForm({ ...form, headquartersCountry: v })} />
                <Field label="HQ City" value={form.headquartersCity} onChange={(v) => setForm({ ...form, headquartersCity: v })} />
                <div className="sm:col-span-2">
                  <Field label="Active Regions (comma-separated)" value={form.activeRegions} onChange={(v) => setForm({ ...form, activeRegions: v })} />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Geographic Focus (comma-separated)" value={form.geographicFocus} onChange={(v) => setForm({ ...form, geographicFocus: v })} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Causes & Populations</h2>
              <div className="grid gap-3">
                <Field label="Causes (comma-separated)" value={form.causes} onChange={(v) => setForm({ ...form, causes: v })} />
                <Field label="Target Populations (comma-separated)" value={form.targetPopulations} onChange={(v) => setForm({ ...form, targetPopulations: v })} />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Giving Statistics</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Total Giving (USD)" value={form.totalGivingUsd} onChange={(v) => setForm({ ...form, totalGivingUsd: v })} />
                <Field label="Avg Grant Size (USD)" value={form.avgGrantSizeUsd} onChange={(v) => setForm({ ...form, avgGrantSizeUsd: v })} />
                <Field label="Grant Count" value={form.grantCount} onChange={(v) => setForm({ ...form, grantCount: v })} />
                <Field label="Giving Year Range" value={form.givingYearRange} onChange={(v) => setForm({ ...form, givingYearRange: v })} />
                <Field label="Data Quality Score (0-1)" value={form.dataQualityScore} onChange={(v) => setForm({ ...form, dataQualityScore: v })} />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {/* Right: Grants & Publications */}
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
                Grants ({donor.grants.length})
              </h2>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {donor.grants.length === 0 ? (
                  <p className="text-sm text-zinc-400">No grants recorded</p>
                ) : donor.grants.map((g) => (
                  <div key={g.id} className="rounded border border-zinc-100 p-2 text-xs dark:border-zinc-800">
                    <div className="font-medium">{g.recipientName}</div>
                    <div className="text-zinc-500">
                      {fmt(g.amount)} {g.year && `(${g.year})`}
                    </div>
                    {g.purpose && <div className="mt-0.5 text-zinc-400">{g.purpose}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
                Publications ({donor.publications.length})
              </h2>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {donor.publications.length === 0 ? (
                  <p className="text-sm text-zinc-400">No publications found</p>
                ) : donor.publications.map((p) => (
                  <div key={p.id} className="rounded border border-zinc-100 p-2 text-xs dark:border-zinc-800">
                    <a href={p.url} target="_blank" className="font-medium text-brand hover:underline">{p.title}</a>
                    <div className="text-zinc-400">{p.type}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Metadata</h2>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>ID: <span className="font-mono">{donor.id}</span></div>
                <div>Created: {new Date(donor.createdAt).toLocaleDateString()}</div>
                <div>Updated: {new Date(donor.updatedAt).toLocaleDateString()}</div>
                <div>Matches: {donor._count.matches}</div>
                <div>Pipeline entries: {donor._count.pipelineEntries}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
    </div>
  );
}
