"use client";

import { useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { LinkChip, type SourceChip } from "./link-chip";
import { FileDropZone } from "./file-drop-zone";
import { ExtractionOverlay } from "./extraction-overlay";

// ─── Props ──────────────────────────────────────────
interface StepSourcesProps {
  sources: SourceChip[];
  onAddSources: (newSources: Omit<SourceChip, "id">[]) => void;
  onRemoveSource: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  isExtracting: boolean;
  progressIdx: number;
}

// ─── Helpers ────────────────────────────────────────
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
}

// ─── Section heading ────────────────────────────────
function SectionLabel({
  icon,
  title,
  optional,
}: {
  icon: React.ReactNode;
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500">{icon}</span>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {optional && (
        <span className="text-xs text-zinc-400">(optional)</span>
      )}
    </div>
  );
}

// ─── Link icon ──────────────────────────────────────
function LinkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════
export function StepSources({
  sources,
  onAddSources,
  onRemoveSource,
  onContinue,
  onSkip,
  isExtracting,
  progressIdx,
}: StepSourcesProps) {
  const [urlInput, setUrlInput] = useState("");
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textModalValue, setTextModalValue] = useState("");
  const [guidestarModalOpen, setGuidestarModalOpen] = useState(false);
  const [guidestarRegInput, setGuidestarRegInput] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalValue, setLinkModalValue] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  // Split sources into links vs files
  const linkSources = sources.filter(
    (s) => s.type === "url" || s.type === "social" || s.type === "youtube" || s.type === "guidestar"
  );
  const fileSources = sources.filter((s) => s.type === "pdf");
  const textSources = sources.filter((s) => s.type === "text");

  // ─── Add URLs ─────────────────────────────────
  function handleAddUrl() {
    const raw = urlInput.trim();
    if (!raw) return;

    const urls = raw.split(/[\s,]+/).filter((u) => u.length > 0);
    const newSources: Omit<SourceChip, "id">[] = [];

    for (const u of urls) {
      let finalUrl = u.trim();
      if (!finalUrl) continue;
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;

      const isYouTube = /youtube\.com|youtu\.be/i.test(finalUrl);
      const isSocial = /linkedin\.com|facebook\.com|fb\.com|instagram\.com|twitter\.com|x\.com/i.test(finalUrl);
      newSources.push({
        type: isYouTube ? "youtube" : isSocial ? "social" : "url",
        label: finalUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40),
        value: finalUrl,
      });
    }

    if (newSources.length > 0) onAddSources(newSources);
    setUrlInput("");
  }

  // ─── Add files ────────────────────────────────
  function handleFilesAdded(files: File[]) {
    const newSources: Omit<SourceChip, "id">[] = [];

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        onAddSources([
          {
            type: "pdf",
            label: file.name.slice(0, 40),
            value: file.name,
            fileBase64: base64,
            fileMimeType: getMimeType(file.name),
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    return newSources;
  }

  // ─── Add text ─────────────────────────────────
  function handleAddText() {
    const text = textModalValue.trim();
    if (!text) return;
    const wordCount = text.split(/\s+/).length;
    onAddSources([
      { type: "text", label: `${wordCount} words`, value: text },
    ]);
    setTextModalValue("");
    setTextModalOpen(false);
  }

  // ─── Add social link ──────────────────────────
  function handleAddLink() {
    let url = linkModalValue.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    onAddSources([
      {
        type: isYouTube ? "youtube" : "social",
        label: url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40),
        value: url,
      },
    ]);
    setLinkModalValue("");
    setLinkModalOpen(false);
  }

  // ─── Add GuideStar ────────────────────────────
  function handleAddGuidestar() {
    const reg = guidestarRegInput.trim();
    if (!reg) return;
    onAddSources([
      { type: "guidestar", label: `GuideStar: ${reg}`, value: reg },
    ]);
    setGuidestarRegInput("");
    setGuidestarModalOpen(false);
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        <CardContent className="py-8">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Your Organization
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Add your website, GuideStar Israel page, or upload documents — we&apos;ll
              extract everything automatically
            </p>
          </div>

          <div ref={formRef} className="mt-8 space-y-7">
            {/* ── Website & Social Links ──────────── */}
            <div>
              <SectionLabel
                icon={<LinkIcon />}
                title="Website & Social Links"
              />
              <p className="mt-1 text-sm text-zinc-500">
                Add your website, LinkedIn, Twitter/X, Facebook, Instagram, etc.
              </p>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Paste one or multiple links (space-separated)..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  className="h-10 w-10 flex-shrink-0 rounded-lg"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </Button>
              </div>

              {/* Link chips */}
              {linkSources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {linkSources.map((source) => (
                    <LinkChip
                      key={source.id}
                      source={source}
                      onRemove={onRemoveSource}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Upload Documents ────────────────── */}
            <div>
              <SectionLabel
                icon={<DocIcon />}
                title="Upload Documents"
                optional
              />
              <p className="mt-1 text-sm text-zinc-500">
                Pitch decks, one-pagers, annual reports (PDF, PPT, Word)
              </p>

              <div className="mt-3">
                <FileDropZone onFiles={handleFilesAdded} disabled={isExtracting} />
              </div>

              {/* File chips */}
              {fileSources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fileSources.map((source) => (
                    <LinkChip
                      key={source.id}
                      source={source}
                      onRemove={onRemoveSource}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Additional sources ──────────────── */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTextModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 6.1H3M21 12.1H3M15.1 18H3" />
                </svg>
                Paste Text
              </button>
              <button
                type="button"
                onClick={() => setLinkModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Add Other Link
              </button>
              <button
                type="button"
                onClick={() => setGuidestarModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
                </svg>
                GuideStar IL
              </button>

              {/* Text chip(s) */}
              {textSources.map((source) => (
                <LinkChip
                  key={source.id}
                  source={source}
                  onRemove={onRemoveSource}
                />
              ))}
            </div>
          </div>

          {/* ── Footer ────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-zinc-400 underline-offset-2 hover:underline"
            >
              Skip, I&apos;ll type manually
            </button>
            <Button
              size="lg"
              onClick={onContinue}
              disabled={sources.length === 0 || isExtracting}
              className="gap-2"
            >
              Continue
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          </div>

          {/* ── Extraction overlay ─────────────────── */}
          <AnimatePresence>
            {isExtracting && <ExtractionOverlay progressIdx={progressIdx} />}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ─── Modals ──────────────────────────────── */}

      {/* Paste Text */}
      <Modal
        open={textModalOpen}
        onClose={() => setTextModalOpen(false)}
        title="Paste your text"
        description="Paste any text that describes your organization — about-us copy, annual report excerpts, etc."
      >
        <Textarea
          placeholder="Paste text here..."
          value={textModalValue}
          onChange={(e) => setTextModalValue(e.target.value)}
          rows={6}
        />
        <ModalFooter>
          <Button variant="outline" onClick={() => setTextModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddText} disabled={!textModalValue.trim()}>
            Add Text
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add Link */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Add a link"
        description="YouTube, LinkedIn, Facebook, Twitter, or any page about your organization."
      >
        <Input
          placeholder="https://..."
          value={linkModalValue}
          onChange={(e) => setLinkModalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddLink();
            }
          }}
        />
        <ModalFooter>
          <Button variant="outline" onClick={() => setLinkModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddLink} disabled={!linkModalValue.trim()}>
            Add Link
          </Button>
        </ModalFooter>
      </Modal>

      {/* GuideStar IL */}
      <Modal
        open={guidestarModalOpen}
        onClose={() => setGuidestarModalOpen(false)}
        title="Add GuideStar Israel source"
        description="Enter an Israeli nonprofit registration number (Mispar Amuta) to pull data directly from GuideStar Israel."
      >
        <Input
          placeholder="e.g. 580123456"
          value={guidestarRegInput}
          onChange={(e) => setGuidestarRegInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddGuidestar();
            }
          }}
        />
        <ModalFooter>
          <Button variant="outline" onClick={() => setGuidestarModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddGuidestar}
            disabled={!guidestarRegInput.trim()}
          >
            Add Source
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
