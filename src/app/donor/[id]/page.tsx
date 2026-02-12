"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DonorDetailSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatGrantAmount } from "@/lib/utils/format-amount";

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

const formatCurrency = formatGrantAmount;

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

const statIcons = [
  <path key="giving" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  <path key="avg" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  <path key="count" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />,
  <path key="years" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />,
];

export default function DonorDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<DonorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchDonor = useCallback(async () => {
    try {
      const res = await fetch(`/api/donors/${id}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error("Failed to load donor");
      }
    } catch {
      toast.error("Failed to connect to server");
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
        toast.success("Note added");
      } else {
        toast.error("Failed to add note");
      }
    } catch {
      toast.error("Failed to add note");
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
        toast.success(`Moved to ${STAGE_LABELS[stage] || stage}`);
      } else {
        toast.error("Failed to update stage");
      }
    } catch {
      toast.error("Failed to update stage");
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <DonorDetailSkeleton />
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <EmptyState
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            }
            title="Donor not found"
            description="This donor may have been removed or the link is incorrect."
            action={<Button onClick={() => router.back()}>Go Back</Button>}
          />
        </main>
      </>
    );
  }

  const { donor, grants, publications, stats, pipeline } = data;

  return (
    <>
      <Nav
        breadcrumbs={[
          { label: "Pipeline", href: "/pipeline" },
          { label: donor.name },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{donor.name}</h1>
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
              <Button variant="outline" size="sm" onClick={() => window.open(donor.website!, "_blank")}>
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Website
              </Button>
            )}
            {donor.email && (
              <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${donor.email}`)}>
                Email
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats.grantCount > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Giving", value: formatCurrency(stats.totalGiving) },
              { label: "Avg Grant", value: formatCurrency(stats.avgGrant) },
              { label: "Grants", value: stats.grantCount.toString() },
              { label: "Years Active", value: stats.yearRange || "N/A" },
            ].map((stat, i) => (
              <Card key={stat.label}>
                <CardContent className="p-4 text-center">
                  <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light">
                    <svg className="h-4 w-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {statIcons[i]}
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Description */}
        {donor.description && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{donor.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        <div className="mt-6 flex flex-wrap gap-6">
          {donor.causes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Focus Areas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {donor.causes.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            </div>
          )}
          {donor.geographicFocus.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Geographic Focus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {donor.geographicFocus.map((g) => (
                  <Badge key={g} variant="info">{g}</Badge>
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
        <div className="mt-8">
          <Tabs defaultValue="grants">
            <TabsList>
              <TabsTrigger value="grants" count={grants.length}>Grants</TabsTrigger>
              <TabsTrigger value="publications" count={publications.length}>Publications</TabsTrigger>
              <TabsTrigger value="activity" count={pipeline?.notes.length || 0}>Notes & Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="grants" className="mt-6">
              {grants.length === 0 ? (
                <EmptyState
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="No grant data available"
                />
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Recipient</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                          <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">Year</th>
                          <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {grants.map((g) => (
                          <tr key={g.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                              {g.sourceUrl ? (
                                <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                                  {g.recipientName}
                                </a>
                              ) : (
                                g.recipientName
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
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
                </Card>
              )}
            </TabsContent>

            <TabsContent value="publications" className="mt-6">
              {publications.length === 0 ? (
                <EmptyState
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  }
                  title="No publications found"
                />
              ) : (
                <div className="space-y-3">
                  {publications.map((p) => (
                    <Card key={p.id} variant="interactive">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.title}</p>
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
                        </CardContent>
                      </a>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              {/* Add note form */}
              {pipeline && (
                <div className="mb-6">
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note about this donor..."
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
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <p className="text-sm text-zinc-700 whitespace-pre-wrap dark:text-zinc-300">{note.content}</p>
                        <p className="mt-2 text-xs text-zinc-400">
                          {note.user} &middot; {timeAgo(note.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  }
                  title={pipeline ? "No notes yet" : "Add to pipeline to track notes"}
                />
              )}

              {/* Activity log */}
              {pipeline?.activity && pipeline.activity.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-500">Activity</h3>
                  <div className="space-y-2">
                    {pipeline.activity.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-zinc-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        <span>{formatAction(a.action, a.details)}</span>
                        <span>&middot;</span>
                        <span>{timeAgo(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
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
