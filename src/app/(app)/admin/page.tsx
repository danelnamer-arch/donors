"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StatsGridSkeleton, TableRowSkeleton } from "@/components/ui/skeleton";

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

const statusBadgeVariant: Record<string, "success" | "danger" | "info" | "default" | "warning"> = {
  COMPLETED: "success",
  FAILED: "danger",
  IN_PROGRESS: "info",
  PENDING: "default",
  NEEDS_UPDATE: "warning",
};

const qualityColor = (score: number) => {
  if (score >= 0.8) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 0.5) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
};

const statIcons = [
  <path key="donors" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  <path key="grants" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  <path key="pubs" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
  <path key="matches" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />,
  <path key="sites" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  <path key="regions" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />,
  <path key="giving" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />,
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Discovery form
  const [discoverCause, setDiscoverCause] = useState("");
  const [discoverRegion, setDiscoverRegion] = useState("");
  const [discovering, setDiscovering] = useState(false);

  // IRS 990 import
  const [importing990, setImporting990] = useState(false);
  const [importEin, setImportEin] = useState("");
  const [importingEin, setImportingEin] = useState(false);

  // Batch operations
  const [batchDiscovering, setBatchDiscovering] = useState(false);
  const [importingAllSectors, setImportingAllSectors] = useState(false);
  const [importSector, setImportSector] = useState("");

  // Tab state
  const [tab, setTab] = useState("donors");

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    loading: boolean;
  }>({ open: false, title: "", description: "", onConfirm: () => {}, loading: false });

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error("Failed to load stats");
    }
  };

  const fetchDonors = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/admin/donors?${params}`);
      const data = await res.json();
      setDonors(data.donors);
      setTotalPages(data.pagination.totalPages);
    } catch {
      toast.error("Failed to load donors");
    }
  };

  const fetchDuplicates = async () => {
    try {
      const res = await fetch("/api/admin/duplicates");
      const data = await res.json();
      setDuplicates(data.groups);
    } catch {
      toast.error("Failed to load duplicates");
    }
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

  const handleDelete = (id: string, name: string) => {
    setConfirmModal({
      open: true,
      title: "Delete donor",
      description: `Delete "${name}" and all related data? This cannot be undone.`,
      loading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await fetch(`/api/admin/donors/${id}`, { method: "DELETE" });
          toast.success(`Deleted ${name}`);
          fetchDonors();
          fetchStats();
        } catch {
          toast.error(`Failed to delete ${name}`);
        }
        setConfirmModal((prev) => ({ ...prev, open: false, loading: false }));
      },
    });
  };

  const handleEnrich = async (id: string, name: string) => {
    const toastId = toast.loading(`Enriching ${name}...`);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enrich", donorId: id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Enriched ${name}: +${data.enrichedData?.newGrantsAdded ?? 0} grants, +${data.enrichedData?.newPublicationsAdded ?? 0} pubs`,
          { id: toastId }
        );
      } else {
        toast.error(`Enrich failed for ${name}: ${data.error}`, { id: toastId });
      }
      fetchDonors();
    } catch {
      toast.error(`Enrich failed for ${name}`, { id: toastId });
    }
  };

  const handleDiscover = async () => {
    if (!discoverCause.trim()) return;
    setDiscovering(true);
    const toastId = toast.loading(`Discovering donors for "${discoverCause}"...`);
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
      toast.success(
        `Discovery complete: ${data.discovered} found, ${data.validated} validated, ${data.stored} stored`,
        { id: toastId }
      );
      if (data.errors?.length) {
        for (const err of data.errors.slice(0, 3)) toast.error(err);
      }
      fetchDonors();
      fetchStats();
    } catch {
      toast.error("Discovery failed", { id: toastId });
    }
    setDiscovering(false);
  };

  const handleIrs990Import = async () => {
    setImporting990(true);
    toast.info("Starting IRS 990 import from ProPublica...");
    try {
      const res = await fetch("/api/irs990/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 2 }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`IRS 990 import failed: ${data.error}`);
      } else {
        toast.success(`IRS 990 import: ${data.imported} imported, ${data.duplicates} duplicates`);
      }
      fetchDonors();
      fetchStats();
    } catch {
      toast.error("IRS 990 import failed");
    }
    setImporting990(false);
  };

  const handleEinImport = async () => {
    const ein = importEin.trim().replace(/-/g, "");
    if (!ein || !/^\d{9}$/.test(ein)) {
      toast.error("Invalid EIN — must be 9 digits (e.g., 133015694 or 13-3015694)");
      return;
    }
    setImportingEin(true);
    toast.info(`Importing EIN ${ein}...`);
    try {
      const res = await fetch("/api/irs990/import-ein", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`EIN import failed: ${data.error}`);
      } else if (data.donorId) {
        toast.success(`Imported: ${data.name ?? ein}`);
        fetchDonors();
        fetchStats();
      } else {
        toast.info(`EIN ${ein}: ${data.message ?? "already exists"}`);
      }
    } catch {
      toast.error("EIN import failed");
    }
    setImportingEin(false);
    setImportEin("");
  };

  const handleBatchDiscover = async () => {
    setBatchDiscovering(true);
    const toastId = toast.loading("Starting batch discovery across all sectors... This may take several minutes.");
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch-discover" }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Batch discovery failed: ${data.error}`, { id: toastId });
      } else {
        toast.success(
          `Batch discovery complete: ${data.summary?.totalDiscovered ?? 0} discovered, ${data.summary?.totalStored ?? 0} stored across ${data.summary?.targetsCompleted ?? 0} sectors`,
          { id: toastId, duration: 10000 }
        );
      }
      fetchDonors();
      fetchStats();
    } catch {
      toast.error("Batch discovery failed", { id: toastId });
    }
    setBatchDiscovering(false);
  };

  const handleImportAllSectors = async (sector?: string) => {
    setImportingAllSectors(true);
    const label = sector || "all sectors";
    const toastId = toast.loading(`Importing IRS 990 data for ${label}... This may take a few minutes.`);
    try {
      const res = await fetch("/api/irs990/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: sector || "all", maxPages: 1 }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`IRS 990 import failed: ${data.error}`, { id: toastId });
      } else {
        toast.success(
          `IRS 990 import (${label}): ${data.imported} imported, ${data.duplicates} duplicates, ${data.errors} errors`,
          { id: toastId, duration: 8000 }
        );
      }
      fetchDonors();
      fetchStats();
    } catch {
      toast.error("IRS 990 import failed", { id: toastId });
    }
    setImportingAllSectors(false);
  };

  const handleMerge = (primaryId: string, mergeIds: string[], groupReason: string) => {
    setConfirmModal({
      open: true,
      title: "Merge donors",
      description: `Merge ${mergeIds.length} donor(s) into the primary? This cannot be undone.`,
      loading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          const res = await fetch("/api/admin/duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ primaryId, mergeIds }),
          });
          const data = await res.json();
          if (data.success) {
            toast.success(`Merged duplicates (${groupReason}): ${data.donorsDeleted} removed, ${data.grantsMerged} grants moved`);
          }
          fetchDuplicates();
          fetchDonors();
          fetchStats();
        } catch {
          toast.error("Merge failed");
        }
        setConfirmModal((prev) => ({ ...prev, open: false, loading: false }));
      },
    });
  };

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };

  const statItems = stats ? [
    { label: "Donors", value: stats.totalDonors },
    { label: "Grants", value: stats.totalGrants },
    { label: "Publications", value: stats.totalPublications },
    { label: "Matches", value: stats.totalMatches },
    { label: "Verified Sites", value: stats.verifiedWebsites },
    { label: "With Regions", value: stats.withActiveRegions },
    { label: "With Giving $", value: stats.withGivingData },
  ] : [];

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stats Grid */}
        {loading ? (
          <div className="mb-6">
            <StatsGridSkeleton />
          </div>
        ) : stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {statItems.map((s, i) => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-brand-light p-1.5">
                      <svg className="h-4 w-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {statIcons[i]}
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</div>
                  <div className="text-xs text-zinc-500">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs
          defaultValue="donors"
          value={tab}
          onValueChange={(t) => {
            setTab(t);
            if (t === "duplicates" && duplicates.length === 0) fetchDuplicates();
          }}
          variant="pills"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="donors">Donors</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="duplicates" count={duplicates.length}>Duplicates</TabsTrigger>
          </TabsList>

          {/* Donors Tab */}
          <TabsContent value="donors">
            {/* Search & Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Search by name, EIN, or description..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                placeholder="All Statuses"
                options={[
                  { value: "PENDING", label: "Pending" },
                  { value: "IN_PROGRESS", label: "In Progress" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "FAILED", label: "Failed" },
                  { value: "NEEDS_UPDATE", label: "Needs Update" },
                ]}
                className="w-40"
              />
              <Select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                placeholder="All Types"
                options={[
                  { value: "FOUNDATION", label: "Foundation" },
                  { value: "INDIVIDUAL", label: "Individual" },
                  { value: "CORPORATE", label: "Corporate" },
                  { value: "GOVERNMENT", label: "Government" },
                ]}
                className="w-40"
              />
            </div>

            {/* Donors Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">HQ</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Regions</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total Giving</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Grants</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">Quality</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">Site</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} columns={10} />)
                    ) : donors.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-sm text-zinc-400">
                          No donors found
                        </td>
                      </tr>
                    ) : (
                      donors.map((d) => (
                        <tr key={d.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                          <td className="px-3 py-2.5">
                            <Link href={`/admin/donors/${d.id}`} className="font-medium text-brand hover:underline">
                              {d.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge>{d.type}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-500">{d.headquartersCountry ?? d.country ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(d.activeRegions ?? []).slice(0, 3).map((r) => (
                                <Badge key={r} variant="info">{r}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{fmt(d.totalGivingUsd)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-500">{d._count.grants}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Tooltip content={`Quality score: ${Math.round(d.dataQualityScore * 100)}%`}>
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${qualityColor(d.dataQualityScore)}`}>
                                {Math.round(d.dataQualityScore * 100)}
                              </span>
                            </Tooltip>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {d.websiteVerified ? (
                              <Badge variant="success">Verified</Badge>
                            ) : (
                              <span className="text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={statusBadgeVariant[d.researchStatus] || "default"}>
                              {d.researchStatus}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEnrich(d.id, d.name)}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                Enrich
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(d.id, d.name)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Discover Tab */}
          <TabsContent value="discover">
            <div className="space-y-4">
              {/* Batch Operations */}
              <Card className="border-brand/20 bg-brand-light/30 dark:border-brand/10 dark:bg-brand-light/5">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Batch Operations</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Scale your database quickly. These operations run across all sectors and may take several minutes.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      onClick={handleBatchDiscover}
                      disabled={batchDiscovering || importingAllSectors}
                      loading={batchDiscovering}
                    >
                      {batchDiscovering ? "Discovering..." : "Batch Discover (All Sectors)"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleImportAllSectors()}
                      disabled={importingAllSectors || batchDiscovering}
                      loading={importingAllSectors}
                    >
                      {importingAllSectors ? "Importing..." : "IRS 990 Import (All Sectors)"}
                    </Button>
                    {(batchDiscovering || importingAllSectors) && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        This may take 5-15 minutes. Do not close this page.
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>Batch Discover: 20 cause/region combos via AI (Perplexity + Tavily)</span>
                    <span className="text-zinc-300 dark:text-zinc-600">|</span>
                    <span>IRS 990: 20 sectors via ProPublica (free)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Single Discovery */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Discovery</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Search for new donors using Tavily + Perplexity. Results are validated and stored automatically.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <Input
                        placeholder="Cause area (e.g., climate change, education equality, refugee assistance)"
                        value={discoverCause}
                        onChange={(e) => setDiscoverCause(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <Input
                        placeholder="Region (optional)"
                        value={discoverRegion}
                        onChange={(e) => setDiscoverRegion(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleDiscover}
                      disabled={discovering || !discoverCause.trim()}
                      loading={discovering}
                    >
                      {discovering ? "Searching..." : "Discover"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* IRS 990 Import */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">IRS 990 / ProPublica Import</h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Import US foundations from ProPublica&apos;s Nonprofit Explorer API. Free, no API key needed.
                  </p>
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Import by Sector</p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Select
                          value={importSector}
                          onChange={(e) => setImportSector(e.target.value)}
                          placeholder="Select sector"
                          options={[
                            { value: "health", label: "Health" },
                            { value: "education", label: "Education" },
                            { value: "environment", label: "Environment" },
                            { value: "arts", label: "Arts & Culture" },
                            { value: "humanRights", label: "Human Rights" },
                            { value: "poverty", label: "Poverty Alleviation" },
                            { value: "youth", label: "Youth Development" },
                            { value: "women", label: "Women & Girls" },
                            { value: "international", label: "International" },
                            { value: "technology", label: "Technology & STEM" },
                            { value: "disability", label: "Disability" },
                            { value: "veterans", label: "Veterans" },
                            { value: "elderly", label: "Elderly & Aging" },
                            { value: "faith", label: "Faith & Religion" },
                            { value: "community", label: "Community" },
                            { value: "animal", label: "Animal Welfare" },
                            { value: "disaster", label: "Disaster Relief" },
                            { value: "criminalJustice", label: "Criminal Justice" },
                            { value: "housing", label: "Housing" },
                            { value: "food", label: "Food & Agriculture" },
                          ]}
                          className="w-56"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => handleImportAllSectors(importSector || undefined)}
                          disabled={importingAllSectors || importing990}
                          loading={importingAllSectors}
                        >
                          {importingAllSectors ? "Importing..." : importSector ? `Import ${importSector}` : "Import All Sectors"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleIrs990Import}
                          disabled={importing990 || importingAllSectors}
                          loading={importing990}
                        >
                          {importing990 ? "Importing..." : "Legacy (Israel-Related)"}
                        </Button>
                      </div>
                    </div>
                    <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Import by EIN</p>
                      <div className="flex gap-3">
                        <div className="w-64">
                          <Input
                            placeholder="EIN (e.g., 13-3015694)"
                            value={importEin}
                            onChange={(e) => setImportEin(e.target.value)}
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleEinImport}
                          disabled={importingEin || !importEin.trim()}
                          loading={importingEin}
                        >
                          {importingEin ? "Importing..." : "Import"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-zinc-400">
                        Find EINs at{" "}
                        <a href="https://projects.propublica.org/nonprofits/" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                          ProPublica Nonprofit Explorer
                        </a>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Duplicates Tab */}
          <TabsContent value="duplicates">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Duplicate Detection
              </h2>
              <Button variant="outline" size="sm" onClick={fetchDuplicates}>
                Refresh
              </Button>
            </div>

            {duplicates.length === 0 ? (
              <Card>
                <EmptyState
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="No duplicates found"
                  description="Your database is clean!"
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {duplicates.map((group, i) => (
                  <Card key={i} className="border-amber-200 dark:border-amber-800">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant="warning">{group.reason}</Badge>
                        <span className="text-xs text-zinc-400">{group.donors.length} donors</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.donors.map((d, j) => (
                          <div key={d.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.name}</span>
                              <Badge>{d.type}</Badge>
                              {d.ein && <span className="text-xs text-zinc-400">EIN: {d.ein}</span>}
                            </div>
                            {j === 0 ? (
                              <Badge variant="success">Primary</Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMerge(group.donors[0].id, [d.id], group.reason)}
                                className="text-xs"
                              >
                                Merge into primary
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel="Confirm"
        variant="destructive"
        loading={confirmModal.loading}
      />
    </>
  );
}
