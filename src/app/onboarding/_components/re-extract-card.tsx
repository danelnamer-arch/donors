"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LinkChip, type SourceChip } from "./link-chip";
import { FileDropZone } from "./file-drop-zone";

// ─── Props ──────────────────────────────────────────
interface ReExtractCardProps {
  sources: SourceChip[];
  onAddSources: (newSources: Omit<SourceChip, "id">[]) => void;
  onRemoveSource: (id: string) => void;
  onReExtract: () => void;
  isExtracting: boolean;
}

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

function SparkleAiIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
      <svg
        className="h-5 w-5 text-brand"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════
export function ReExtractCard({
  sources,
  onAddSources,
  onRemoveSource,
  onReExtract,
  isExtracting,
}: ReExtractCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [urlInput, setUrlInput] = useState("");

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
      newSources.push({
        type: isYouTube ? "youtube" : "url",
        label: finalUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40),
        value: finalUrl,
      });
    }
    if (newSources.length > 0) onAddSources(newSources);
    setUrlInput("");
  }

  function handleFilesAdded(files: File[]) {
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
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-start gap-4">
        <SparkleAiIcon />
        <div className="flex-1">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Add More &amp; Re-Extract
          </h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            Added new links or documents? Click to update your extracted info
          </p>
        </div>
      </div>

      {/* Expanded area for adding sources */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              {/* URL input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste links..."
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

              {/* File drop zone */}
              <FileDropZone onFiles={handleFilesAdded} disabled={isExtracting} />

              {/* Current source chips */}
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <LinkChip key={s.id} source={s} onRemove={onRemoveSource} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {!expanded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(true)}
          >
            Add more sources
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onReExtract}
          loading={isExtracting}
          disabled={sources.length === 0}
          className="gap-1.5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
          </svg>
          Re-Extract Information
        </Button>
      </div>
    </div>
  );
}
