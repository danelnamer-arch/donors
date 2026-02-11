"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DonorData {
  donor: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    causes: string[];
    targetPopulations: string[];
    geographicFocus: string[];
    dataQualityScore: number;
  };
  grants: {
    id: string;
    recipientName: string;
    amount: number | null;
    currency: string;
    year: number | null;
    purpose: string | null;
    sourceUrl: string | null;
  }[];
  publications: {
    id: string;
    title: string;
    type: string;
    url: string;
    summary: string | null;
    publishedAt: string | null;
  }[];
  stats: {
    totalGiving: number;
    avgGrant: number;
    grantCount: number;
    yearRange: string | null;
  };
  pipeline: {
    id: string;
    stage: string;
    enrichmentStatus: string;
    enrichedData: Record<string, unknown> | null;
    notes: { id: string; content: string; createdAt: string; user: string }[];
    activity: { id: string; action: string; details: unknown; createdAt: string }[];
  } | null;
}

const STAGE_LABELS: Record<string, string> = {
  DISCOVERED: "Discovered",
  RESEARCHING: "Researching",
  OUTREACH: "Outreach",
  APPLIED: "Applied",
  IN_CONVERSATION: "In Conversation",
  FUNDED: "Funded",
  REJECTED: "Rejected",
};

const STAGE_COLORS: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  DISCOVERED: "default",
  RESEARCHING: "info",
  OUTREACH: "warning",
  APPLIED: "info",
  IN_CONVERSATION: "warning",
  FUNDED: "success",
  REJECTED: "danger",
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DonorDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<DonorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"grants" | "publications" | "activity">("grants");

  const fetchDonor = useCallback(async () => {
    try {
      const res = await fetch(`/api/donors/${id}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDonor();
  }, [fetchDonor]);

  async function addNote() {
    if (!noteText.trim() || !data?.pipeline) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineEntryId: data.pipeline.id,
          content: noteText.trim(),
        }),
      });
      if (res.ok) {
        const { note } = await res.json();
        setData((prev) =>
          prev && prev.pipeline
            ? {
                ...prev,
                pipeline: {
                  ...prev.pipeline,
                  notes: [note, ...prev.pipeline.notes],
                },
              }
            : prev
        );
        setNoteText("");
      }
    } catch {
      // silently fail
    } finally {
      setSavingNote(false);
    }
  }

  async function moveStage(stage: string) {
    if (!data?.pipeline) return;
    try {
      const res = await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: data.pipeline.id, stage }),
      });
      if (res.ok) {
        setData((prev) =>
          prev && prev.pipeline ? { ...prev, pipeline: { ...prev.pipeline, stage } } : prev
        );
      }
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold">Donor not found</h2>
          <Button className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </>
    );
  }

  const { donor, grants, publications, stats, pipeline } = data;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{donor.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{donor.type}</Badge>
              {donor.country && (
                <span className="text-sm text-zinc-500">
                  {donor.city ? `${donor.city}, ` : ""}
                  {donor.country}
                </span>
              )}
              {pipeline && (
                <Badge variant={STAGE_COLORS[pipeline.stage]}>
                  {STAGE_LABELS[pipeline.stage]}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {donor.website && (
              <a
                href={donor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Website
              </a>
            )}
            {donor.email && (
              <a
                href={`mailto:${donor.email}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Email
              </a>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats.grantCount > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Giving" value={formatCurrency(stats.totalGiving)} />
            <StatCard label="Avg Grant" value={formatCurrency(stats.avgGrant)} />
            <StatCard label="Grants" value={stats.grantCount.toString()} />
            <StatCard label="Years Active" value={stats.yearRange || "N/A"} />
          </div>
        )}

        {/* Description */}
        {donor.description && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm leading-relaxed text-zinc-600">{donor.description}</p>
          </div>
        )}

        {/* Tags */}
        <div className="mt-6 flex flex-wrap gap-6">
          {donor.causes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Focus Areas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {donor.causes.map((c) => (
                  <span key={c} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {donor.geographicFocus.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Geographic Focus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {donor.geographicFocus.map((g) => (
                  <span key={g} className="rounded-full bg-brand-light px-2.5 py-1 text-xs text-brand">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pipeline actions */}
        {pipeline && !["FUNDED", "REJECTED"].includes(pipeline.stage) && (
          <div className="mt-6 flex flex-wrap gap-2">
            {pipeline.stage !== "RESEARCHING" && (
              <Button size="sm" variant="secondary" onClick={() => moveStage("RESEARCHING")}>
                Move to Researching
              </Button>
            )}
            {pipeline.stage !== "OUTREACH" && (
              <Button size="sm" variant="secondary" onClick={() => moveStage("OUTREACH")}>
                Move to Outreach
              </Button>
            )}
            {pipeline.stage !== "IN_CONVERSATION" && (
              <Button size="sm" variant="secondary" onClick={() => moveStage("IN_CONVERSATION")}>
                Move to In Conversation
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => moveStage("FUNDED")}>
              Mark Funded
            </Button>
            <Button size="sm" variant="ghost" onClick={() => moveStage("REJECTED")}>
              Rejected
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-8 border-b border-zinc-200">
          <div className="flex gap-6">
            {[
              { key: "grants" as const, label: "Grants", count: grants.length },
              { key: "publications" as const, label: "Publications", count: publications.length },
              { key: "activity" as const, label: "Notes & Activity", count: pipeline?.notes.length || 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-brand text-brand"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-xs text-zinc-400">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "grants" && (
            <div>
              {grants.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">No grant data available</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Recipient</th>
                        <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Amount</th>
                        <th className="hidden px-4 py-2.5 text-left font-medium text-zinc-500 sm:table-cell">Year</th>
                        <th className="hidden px-4 py-2.5 text-left font-medium text-zinc-500 md:table-cell">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {grants.map((g) => (
                        <tr key={g.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-2.5 text-zinc-900">
                            {g.sourceUrl ? (
                              <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {g.recipientName}
                              </a>
                            ) : (
                              g.recipientName
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-zinc-900">
                            {g.amount ? formatCurrency(g.amount) : "—"}
                          </td>
                          <td className="hidden px-4 py-2.5 text-zinc-500 sm:table-cell">
                            {g.year || "—"}
                          </td>
                          <td className="hidden max-w-xs truncate px-4 py-2.5 text-zinc-500 md:table-cell">
                            {g.purpose || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "publications" && (
            <div>
              {publications.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">No publications found</p>
              ) : (
                <div className="space-y-3">
                  {publications.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-900">{p.title}</p>
                          {p.summary && (
                            <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{p.summary}</p>
                          )}
                        </div>
                        <Badge>{p.type.replace(/_/g, " ")}</Badge>
                      </div>
                      {p.publishedAt && (
                        <p className="mt-2 text-xs text-zinc-400">
                          {new Date(p.publishedAt).toLocaleDateString()}
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div>
              {/* Add note form */}
              {pipeline && (
                <div className="mb-6">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note about this donor..."
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    rows={3}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={addNote}
                      loading={savingNote}
                      disabled={!noteText.trim()}
                    >
                      Add Note
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes list */}
              {pipeline?.notes && pipeline.notes.length > 0 ? (
                <div className="space-y-3">
                  {pipeline.notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-zinc-200 p-4">
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{note.content}</p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {note.user} &middot; {timeAgo(note.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-zinc-400">
                  {pipeline ? "No notes yet" : "Add this donor to your pipeline to track notes"}
                </p>
              )}

              {/* Activity log */}
              {pipeline?.activity && pipeline.activity.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-medium text-zinc-500">Activity</h3>
                  <div className="space-y-2">
                    {pipeline.activity.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-zinc-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                        <span>{formatAction(a.action, a.details)}</span>
                        <span>&middot;</span>
                        <span>{timeAgo(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function formatAction(action: string, details: unknown): string {
  const d = details as Record<string, string> | null;
  switch (action) {
    case "STAGE_CHANGE":
      return `Moved from ${STAGE_LABELS[d?.from || ""] || d?.from} to ${STAGE_LABELS[d?.to || ""] || d?.to}`;
    case "NOTE_ADDED":
      return "Note added";
    case "ENRICHMENT_STARTED":
      return "Enrichment started";
    case "ENRICHMENT_COMPLETED":
      return "Enrichment completed";
    default:
      return action.replace(/_/g, " ").toLowerCase();
  }
}
