"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalDonors: number;
  totalGrants: number;
  totalPublications: number;
  totalMatches: number;
  verifiedWebsites: number;
  withActiveRegions: number;
  withGivingData: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentDonors: { id: string; name: string; type: string; createdAt: string; researchStatus: string }[];
}

interface Donor {
  id: string;
  name: string;
  type: string;
  website: string | null;
  websiteVerified: boolean;
  country: string | null;
  headquartersCountry: string | null;
  activeRegions: string[];
  totalGivingUsd: number | null;
  grantCount: number;
  dataQualityScore: number;
  researchStatus: string;
  createdAt: string;
  updatedAt: string;
  _count: { grants: number; publications: number; matches: number };
}

interface DuplicateGroup {
  reason: string;
  donors: { id: string; name: string; ein: string | null; website: string | null; type: string }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState<string[]>([]);

  // Discovery form
  const [discoverCause, setDiscoverCause] = useState("");
  const [discoverRegion, setDiscoverRegion] = useState("");
  const [discovering, setDiscovering] = useState(false);

  // IRS 990 import
  const [importing990, setImporting990] = useState(false);
  const [importEin, setImportEin] = useState("");
  const [importingEin, setImportingEin] = useState(false);

  // Tab state
  const [tab, setTab] = useState<"donors" | "discover" | "duplicates">("donors");

  const log = (msg: string) => setActionLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);

  const fetchStats = async () => {
    const res = await fetch("/api/admin/stats");
    const data = await res.json();
    setStats(data);
  };

  const fetchDonors = async () => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);

    const res = await fetch(`/api/admin/donors?${params}`);
    const data = await res.json();
    setDonors(data.donors);
    setTotalPages(data.pagination.totalPages);
  };

  const fetchDuplicates = async () => {
    const res = await fetch("/api/admin/duplicates");
    const data = await res.json();
    setDuplicates(data.groups);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchDonors()]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDonors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, typeFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all related data? This cannot be undone.`)) return;
    await fetch(`/api/admin/donors/${id}`, { method: "DELETE" });
    log(`Deleted donor: ${name}`);
    fetchDonors();
    fetchStats();
  };

  const handleEnrich = async (id: string, name: string) => {
    log(`Enriching ${name}...`);
    const res = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enrich", donorId: id }),
    });
    const data = await res.json();
    if (data.success) {
      log(`Enriched ${name}: +${data.enrichedData?.newGrantsAdded ?? 0} grants, +${data.enrichedData?.newPublicationsAdded ?? 0} pubs`);
    } else {
      log(`Enrich failed for ${name}: ${data.error}`);
    }
    fetchDonors();
  };

  const handleDiscover = async () => {
    if (!discoverCause.trim()) return;
    setDiscovering(true);
    log(`Discovering donors for cause: "${discoverCause}", region: "${discoverRegion || "any"}"...`);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discover",
          cause: discoverCause,
          region: discoverRegion || undefined,
        }),
      });
      const data = await res.json();
      log(`Discovery complete: ${data.discovered} found, ${data.validated} validated, ${data.stored} stored`);
      if (data.errors?.length) {
        for (const err of data.errors.slice(0, 5)) log(`  Error: ${err}`);
      }
      fetchDonors();
      fetchStats();
    } catch (err) {
      log(`Discovery failed: ${err}`);
    }
    setDiscovering(false);
  };

  const handleIrs990Import = async () => {
    setImporting990(true);
    log("Starting IRS 990 import from ProPublica (this may take a minute)...");
    try {
      const res = await fetch("/api/irs990/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 2 }),
      });
      const data = await res.json();
      if (data.error) {
        log(`IRS 990 import failed: ${data.error}`);
      } else {
        log(`IRS 990 import complete: ${data.searched} searched, ${data.imported} imported, ${data.duplicates} duplicates, ${data.skipped} skipped`);
        if (data.errors?.length) {
          for (const err of data.errors.slice(0, 5)) log(`  Error: ${err}`);
        }
      }
      fetchDonors();
      fetchStats();
    } catch (err) {
      log(`IRS 990 import failed: ${err}`);
    }
    setImporting990(false);
  };

  const handleEinImport = async () => {
    const ein = importEin.trim().replace(/-/g, "");
    if (!ein || !/^\d{9}$/.test(ein)) {
      log("Invalid EIN — must be 9 digits (e.g., 133015694 or 13-3015694)");
      return;
    }
    setImportingEin(true);
    log(`Importing foundation with EIN ${ein} from ProPublica...`);
    try {
      const res = await fetch("/api/irs990/import-ein", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein }),
      });
      const data = await res.json();
      if (data.error) {
        log(`EIN import failed: ${data.error}`);
      } else if (data.donorId) {
        log(`Imported: ${data.name ?? ein} (ID: ${data.donorId})`);
        fetchDonors();
        fetchStats();
      } else {
        log(`EIN ${ein}: ${data.message ?? "already exists or could not import"}`);
      }
    } catch (err) {
      log(`EIN import failed: ${err}`);
    }
    setImportingEin(false);
    setImportEin("");
  };

  const handleMerge = async (primaryId: string, mergeIds: string[], groupReason: string) => {
    if (!confirm(`Merge ${mergeIds.length} donors into the primary? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, mergeIds }),
    });
    const data = await res.json();
    if (data.success) {
      log(`Merged duplicates (${groupReason}): ${data.donorsDeleted} removed, ${data.grantsMerged} grants moved`);
    }
    fetchDuplicates();
    fetchDonors();
    fetchStats();
  };

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Admin Dashboard</h1>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Developer</span>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
            Back to App
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Stats Grid */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "Donors", value: stats.totalDonors },
              { label: "Grants", value: stats.totalGrants },
              { label: "Publications", value: stats.totalPublications },
              { label: "Matches", value: stats.totalMatches },
              { label: "Verified Sites", value: stats.verifiedWebsites },
              { label: "With Regions", value: stats.withActiveRegions },
              { label: "With Giving $", value: stats.withGivingData },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</div>
                <div className="text-xs text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(["donors", "discover", "duplicates"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "duplicates" && duplicates.length === 0) fetchDuplicates();
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-brand text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Donors Tab */}
        {tab === "donors" && (
          <>
            {/* Search & Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by name, EIN, or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="NEEDS_UPDATE">Needs Update</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">All Types</option>
                <option value="FOUNDATION">Foundation</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="CORPORATE">Corporate</option>
                <option value="GOVERNMENT">Government</option>
              </select>
            </div>

            {/* Donors Table */}
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">HQ</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">Regions</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-600">Total Giving</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-600">Grants</th>
                    <th className="px-3 py-2 text-center font-medium text-zinc-600">Quality</th>
                    <th className="px-3 py-2 text-center font-medium text-zinc-600">Site</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-600">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donors.map((d) => (
                    <tr key={d.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2">
                        <Link href={`/admin/donors/${d.id}`} className="font-medium text-brand hover:underline">
                          {d.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{d.type}</td>
                      <td className="px-3 py-2 text-zinc-500">{d.headquartersCountry ?? d.country ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(d.activeRegions ?? []).slice(0, 3).map((r) => (
                            <span key={r} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">{fmt(d.totalGivingUsd)}</td>
                      <td className="px-3 py-2 text-right text-zinc-500">{d._count.grants}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{
                          backgroundColor: d.dataQualityScore >= 0.8 ? "#dcfce7" : d.dataQualityScore >= 0.5 ? "#fef9c3" : "#fee2e2",
                          color: d.dataQualityScore >= 0.8 ? "#166534" : d.dataQualityScore >= 0.5 ? "#854d0e" : "#991b1b",
                        }}>
                          {Math.round(d.dataQualityScore * 100)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">{d.websiteVerified ? "✓" : "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          d.researchStatus === "COMPLETED" ? "bg-green-50 text-green-700" :
                          d.researchStatus === "FAILED" ? "bg-red-50 text-red-700" :
                          d.researchStatus === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" :
                          "bg-zinc-100 text-zinc-600"
                        }`}>
                          {d.researchStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEnrich(d.id, d.name)}
                            className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                            title="Enrich donor data"
                          >
                            Enrich
                          </button>
                          <button
                            onClick={() => handleDelete(d.id, d.name)}
                            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            title="Delete donor"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {/* Discover Tab */}
        {tab === "discover" && (
          <div className="space-y-4">
            {/* AI Discovery */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Discovery</h2>
              <p className="mb-4 text-sm text-zinc-500">
                Search for new donors using Tavily + Perplexity. Results are validated and stored automatically.
                This uses your API credits (Tavily, Perplexity, OpenAI).
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  placeholder="Cause area (e.g., Jewish education, healthcare in Israel)"
                  value={discoverCause}
                  onChange={(e) => setDiscoverCause(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  type="text"
                  placeholder="Region (optional, e.g., Israel, US)"
                  value={discoverRegion}
                  onChange={(e) => setDiscoverRegion(e.target.value)}
                  className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button
                  onClick={handleDiscover}
                  disabled={discovering || !discoverCause.trim()}
                  className="rounded-lg bg-brand px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {discovering ? "Searching..." : "Discover"}
                </button>
              </div>
            </div>

            {/* IRS 990 / ProPublica Import */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">IRS 990 / ProPublica Import</h2>
              <p className="mb-4 text-sm text-zinc-500">
                Import US foundations from ProPublica&apos;s Nonprofit Explorer API. Free, no API key needed.
                Searches for Israel-related foundations and imports their IRS 990 data (EIN, financials, filings).
              </p>

              <div className="flex flex-col gap-4">
                {/* Bulk import */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleIrs990Import}
                    disabled={importing990}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {importing990 ? "Importing..." : "Import Israel-Related Foundations"}
                  </button>
                  <span className="text-xs text-zinc-400">Searches 5 keywords x 2 pages = ~100 orgs scanned</span>
                </div>

                {/* Single EIN import */}
                <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                  <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Import by EIN</div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="EIN (e.g., 13-3015694 or 133015694)"
                      value={importEin}
                      onChange={(e) => setImportEin(e.target.value)}
                      className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <button
                      onClick={handleEinImport}
                      disabled={importingEin || !importEin.trim()}
                      className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {importingEin ? "Importing..." : "Import"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Find EINs at{" "}
                    <a href="https://projects.propublica.org/nonprofits/" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                      ProPublica Nonprofit Explorer
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicates Tab */}
        {tab === "duplicates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Duplicate Detection ({duplicates.length} groups found)
              </h2>
              <button
                onClick={fetchDuplicates}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Refresh
              </button>
            </div>

            {duplicates.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                No duplicates found. Your database is clean!
              </div>
            ) : (
              duplicates.map((group, i) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">{group.reason}</div>
                  <div className="space-y-1">
                    {group.donors.map((d, j) => (
                      <div key={d.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                        <div>
                          <span className="font-medium">{d.name}</span>
                          <span className="ml-2 text-zinc-400">{d.type}</span>
                          {d.ein && <span className="ml-2 text-zinc-400">EIN: {d.ein}</span>}
                        </div>
                        {j === 0 ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Primary</span>
                        ) : (
                          <button
                            onClick={() => handleMerge(group.donors[0].id, [d.id], group.reason)}
                            className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                          >
                            Merge into primary
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Action Log */}
        {actionLog.length > 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-900 p-4 dark:border-zinc-700">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400">Action Log</h3>
              <button onClick={() => setActionLog([])} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-xs text-green-400">
              {actionLog.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
