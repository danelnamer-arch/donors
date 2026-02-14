"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type TemplateType = "introduction" | "follow_up" | "grant_inquiry" | "thank_you" | "loi";

const TEMPLATE_OPTIONS = [
  { value: "introduction", label: "Introduction" },
  { value: "follow_up", label: "Follow-up" },
  { value: "grant_inquiry", label: "Grant Inquiry" },
  { value: "thank_you", label: "Thank You" },
  { value: "loi", label: "Letter of Intent (LOI)" },
];

const TEMPLATE_DESCRIPTIONS: Record<TemplateType, string> = {
  introduction: "First contact with a new donor prospect",
  follow_up: "Follow up after initial outreach or meeting",
  grant_inquiry: "Ask about grant opportunities and deadlines",
  thank_you: "Thank them after a conversation or meeting",
  loi: "Formal Letter of Intent for grant application",
};

interface OutreachModalProps {
  open: boolean;
  onClose: () => void;
  pipelineEntryId: string;
  donorName: string;
  onNoteSaved?: () => void;
}

export function OutreachModal({
  open,
  onClose,
  pipelineEntryId,
  donorName,
  onNoteSaved,
}: OutreachModalProps) {
  const [templateType, setTemplateType] = useState<TemplateType>("introduction");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ subject: string; body: string; draftId: string } | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineEntryId, templateType }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        toast.error(data.error || "Failed to generate outreach");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    const text = `Subject: ${result.subject}\n\n${result.body}`;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function handleSaveAsNote() {
    if (!result) return;
    setSavingNote(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineEntryId,
          content: `[AI Draft — ${templateType}]\nSubject: ${result.subject}\n\n${result.body}`,
        }),
      });

      if (res.ok) {
        toast.success("Saved as note");
        onNoteSaved?.();
      } else {
        toast.error("Failed to save note");
      }
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  function handleClose() {
    setResult(null);
    setTemplateType("introduction");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Draft Outreach"
      description={`Generate an AI-powered email draft for ${donorName}`}
      className="max-w-lg"
    >
      {/* Template selector */}
      <div className="space-y-3">
        <Select
          label="Template Type"
          options={TEMPLATE_OPTIONS}
          value={templateType}
          onChange={(e) => {
            setTemplateType(e.target.value as TemplateType);
            setResult(null);
          }}
        />
        <p className="text-xs text-zinc-400">
          {TEMPLATE_DESCRIPTIONS[templateType]}
        </p>

        <Button
          onClick={handleGenerate}
          loading={generating}
          className="w-full"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          {result ? "Regenerate" : "Generate Draft"}
        </Button>
      </div>

      {/* Result display */}
      {result && (
        <div className="mt-4 space-y-3">
          {/* Subject */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Subject
            </label>
            <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {result.subject}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Body
            </label>
            <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {result.body}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAsNote}
              loading={savingNote}
              className="flex-1"
            >
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
              </svg>
              Save as Note
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
