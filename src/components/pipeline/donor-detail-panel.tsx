"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { formatGrantAmount } from "@/lib/utils/format-amount";

/* ─── Types ─────────────────────────────────────── */

interface DonorPanelData {
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

const TEMPLATE_OPTIONS = [
  { value: "introduction", label: "Introduction" },
  { value: "follow_up", label: "Follow-up" },
  { value: "grant_inquiry", label: "Grant Inquiry" },
  { value: "thank_you", label: "Thank You" },
  { value: "loi", label: "Letter of Intent (LOI)" },
];

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

/* ─── Cache ─────────────────────────────────────── */
const panelCache = new Map<string, DonorPanelData>();
const MAX_CACHE = 5;

/* ─── Component ─────────────────────────────────── */

interface DonorDetailPanelProps {
  donorId: string;
  onClose: () => void;
  onStageChange?: (entryId: string, stage: string) => void;
  onEnrich?: (entryId: string, donorName: string) => void;
}

export function DonorDetailPanel({
  donorId,
  onClose,
  onStageChange,
  onEnrich,
}: DonorDetailPanelProps) {
  const [data, setData] = useState<DonorPanelData | null>(panelCache.get(donorId) ?? null);
  const [loading, setLoading] = useState(!panelCache.has(donorId));
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Outreach inline state
  const [templateType, setTemplateType] = useState("introduction");
  const [generating, setGenerating] = useState(false);
  const [outreachResult, setOutreachResult] = useState<{ subject: string; body: string } | null>(null);

  const fetchDonor = useCallback(async () => {
    if (panelCache.has(donorId)) {
      setData(panelCache.get(donorId)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/donors/${donorId}`);
      if (res.ok) {
        const d = await res.json();
        // Maintain cache size
        if (panelCache.size >= MAX_CACHE) {
          const firstKey = panelCache.keys().next().value;
          if (firstKey) panelCache.delete(firstKey);
        }
        panelCache.set(donorId, d);
        setData(d);
      } else {
        toast.error("Failed to load donor");
      }
    } catch {
      toast.error("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, [donorId]);

  useEffect(() => {
    fetchDonor();
    setNoteText("");
    setOutreachResult(null);
    setTemplateType("introduction");
  }, [fetchDonor]);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addNote() {
    if (!noteText.trim() || !data?.pipeline) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineEntryId: data.pipeline.id, content: noteText.trim() }),
      });
      if (res.ok) {
        const { note } = await res.json();
        // Update cache
        const updated = {
          ...data,
          pipeline: data.pipeline
            ? { ...data.pipeline, notes: [note, ...data.pipeline.notes] }
            : null,
        };
        setData(updated);
        panelCache.set(donorId, updated);
        setNoteText("");
        toast.success("Note added");
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
        const updated = {
          ...data,
          pipeline: data.pipeline ? { ...data.pipeline, stage } : null,
        };
        setData(updated);
        panelCache.set(donorId, updated);
        onStageChange?.(data.pipeline.id, stage);
        toast.success(`Moved to ${STAGE_LABELS[stage] || stage}`);
      }
    } catch {
      toast.error("Failed to update stage");
    }
  }

  async function handleGenerateOutreach() {
    if (!data?.pipeline) return;
    setGenerating(true);
    setOutreachResult(null);
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineEntryId: data.pipeline.id, templateType }),
      });
      const result = await res.json();
      if (res.ok) setOutreachResult(result);
      else toast.error(result.error || "Failed to generate outreach");
    } catch {
      toast.error("Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyOutreach() {
    if (!outreachResult) return;
    await navigator.clipboard.writeText(`Subject: ${outreachResult.subject}\n\n${outreachResult.body}`);
    toast.success("Copied to clipboard");
  }

  const { donor, grants, publications, stats, pipeline } = data || {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative flex h-full w-[420px] min-w-[380px] max-w-[560px] flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:w-[480px]"
      >
        {/* Loading state */}
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" />
          </div>
        )}

        {!loading && donor && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {donor.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge>{donor.type}</Badge>
                  {donor.country && (
                    <span className="text-xs text-zinc-500">
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
              <div className="ml-3 flex items-center gap-1">
                {donor.website && (
                  <button
                    onClick={() => window.open(donor.website!, "_blank")}
                    className="rounded p-1 text-zinc-400 transition-colors hover:text-brand"
                    title="Open website"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Stats row */}
              {stats && stats.grantCount > 0 && (
                <div className="grid grid-cols-4 gap-px border-b border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
                  {[
                    { label: "Total Giving", value: formatGrantAmount(stats.totalGiving) },
                    { label: "Avg Grant", value: formatGrantAmount(stats.avgGrant) },
                    { label: "Grants", value: stats.grantCount.toString() },
                    { label: "Years", value: stats.yearRange || "N/A" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white px-3 py-3 text-center dark:bg-zinc-950">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
                      <p className="text-[10px] text-zinc-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                {donor.causes.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Focus Areas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {donor.causes.map((c) => (
                        <Badge key={c} className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {donor.geographicFocus.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Geographic Focus
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {donor.geographicFocus.map((g) => (
                        <Badge key={g} variant="info" className="text-[10px]">{g}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="px-5 py-4">
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="grants" count={grants?.length || 0}>Grants</TabsTrigger>
                    <TabsTrigger value="publications" count={publications?.length || 0}>Pubs</TabsTrigger>
                    <TabsTrigger value="notes" count={pipeline?.notes.length || 0}>Notes</TabsTrigger>
                    <TabsTrigger value="outreach">Outreach</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-4">
                    {donor.description ? (
                      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {donor.description}
                      </p>
                    ) : (
                      <p className="text-sm italic text-zinc-400">No description available</p>
                    )}
                  </TabsContent>

                  {/* Grants Tab */}
                  <TabsContent value="grants" className="mt-4">
                    {!grants || grants.length === 0 ? (
                      <p className="text-sm italic text-zinc-400">No grant data available</p>
                    ) : (
                      <div className="space-y-2">
                        {grants.slice(0, 20).map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {g.sourceUrl ? (
                                  <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline">
                                    {g.recipientName}
                                  </a>
                                ) : g.recipientName}
                              </p>
                              {g.purpose && (
                                <p className="mt-0.5 truncate text-xs text-zinc-400">{g.purpose}</p>
                              )}
                            </div>
                            <div className="ml-3 text-right">
                              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                {g.amount ? formatGrantAmount(g.amount) : "—"}
                              </p>
                              {g.year && <p className="text-[10px] text-zinc-400">{g.year}</p>}
                            </div>
                          </div>
                        ))}
                        {grants.length > 20 && (
                          <p className="text-center text-xs text-zinc-400">
                            +{grants.length - 20} more grants
                          </p>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  {/* Publications Tab */}
                  <TabsContent value="publications" className="mt-4">
                    {!publications || publications.length === 0 ? (
                      <p className="text-sm italic text-zinc-400">No publications found</p>
                    ) : (
                      <div className="space-y-2">
                        {publications.map((p) => (
                          <a
                            key={p.id}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg border border-zinc-100 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                          >
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.title}</p>
                            {p.summary && (
                              <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{p.summary}</p>
                            )}
                            <div className="mt-1 flex items-center gap-2">
                              <Badge className="text-[10px]">{p.type.replace(/_/g, " ")}</Badge>
                              {p.publishedAt && (
                                <span className="text-[10px] text-zinc-400">
                                  {new Date(p.publishedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Notes Tab */}
                  <TabsContent value="notes" className="mt-4">
                    {pipeline && (
                      <div className="mb-4">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a note..."
                          rows={2}
                        />
                        <div className="mt-1.5 flex justify-end">
                          <Button size="sm" onClick={addNote} loading={savingNote} disabled={!noteText.trim()}>
                            Add Note
                          </Button>
                        </div>
                      </div>
                    )}

                    {pipeline?.notes && pipeline.notes.length > 0 ? (
                      <div className="space-y-2">
                        {pipeline.notes.map((n) => (
                          <div key={n.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                            <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{n.content}</p>
                            <p className="mt-1 text-[10px] text-zinc-400">
                              {n.user} &middot; {timeAgo(n.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-zinc-400">No notes yet</p>
                    )}

                    {/* Activity log */}
                    {pipeline?.activity && pipeline.activity.length > 0 && (
                      <div className="mt-4">
                        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Activity
                        </h3>
                        <div className="space-y-1">
                          {pipeline.activity.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                              <span>{formatAction(a.action, a.details)}</span>
                              <span>&middot;</span>
                              <span>{timeAgo(a.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Outreach Tab */}
                  <TabsContent value="outreach" className="mt-4">
                    {pipeline ? (
                      <div className="space-y-3">
                        <Select
                          label="Template"
                          options={TEMPLATE_OPTIONS}
                          value={templateType}
                          onChange={(e) => {
                            setTemplateType(e.target.value);
                            setOutreachResult(null);
                          }}
                        />
                        <Button
                          onClick={handleGenerateOutreach}
                          loading={generating}
                          className="w-full"
                          size="sm"
                        >
                          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          {outreachResult ? "Regenerate" : "Generate Draft"}
                        </Button>

                        {outreachResult && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Subject</p>
                              <div className="mt-0.5 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                                {outreachResult.subject}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Body</p>
                              <div className="mt-0.5 max-h-48 overflow-y-auto rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900">
                                {outreachResult.body}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleCopyOutreach} className="w-full">
                              Copy to Clipboard
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm italic text-zinc-400">Add to pipeline to use outreach</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Sticky footer actions */}
            {pipeline && !["FUNDED", "REJECTED"].includes(pipeline.stage) && (
              <div className="flex flex-wrap gap-1.5 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
                {pipeline.enrichmentStatus !== "COMPLETED" && pipeline.enrichmentStatus !== "IN_PROGRESS" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEnrich?.(pipeline.id, donor.name)}
                  >
                    <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    Enrich
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => moveStage("FUNDED")}>
                  Mark Funded
                </Button>
                <Button size="sm" variant="ghost" onClick={() => moveStage("REJECTED")} className="text-red-500 hover:text-red-600">
                  Reject
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
