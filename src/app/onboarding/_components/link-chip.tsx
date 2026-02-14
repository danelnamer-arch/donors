"use client";

import { useState } from "react";

// ─── Types ──────────────────────────────────────────
interface SourceChip {
  id: string;
  type: "url" | "pdf" | "youtube" | "social" | "text" | "guidestar";
  label: string;
  value: string;
  fileBase64?: string;
  fileMimeType?: string;
}

interface LinkChipProps {
  source: SourceChip;
  onRemove: (id: string) => void;
}

// ─── Helpers ────────────────────────────────────────
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

// SVG fallback icons for non-URL types
function GlobeIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 6.1H3M21 12.1H3M15.1 18H3" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────
export function LinkChip({ source, onRemove }: LinkChipProps) {
  const [faviconError, setFaviconError] = useState(false);

  const isUrl = source.type === "url" || source.type === "social" || source.type === "youtube";
  const domain = isUrl ? extractDomain(source.value) : null;

  function getIcon() {
    if (isUrl && domain && !faviconError) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className="h-4 w-4 rounded-sm"
          loading="lazy"
          onError={() => setFaviconError(true)}
        />
      );
    }
    if (isUrl) return <GlobeIcon />;
    if (source.type === "pdf") return <DocumentIcon />;
    if (source.type === "text") return <TextIcon />;
    if (source.type === "guidestar") return <BuildingIcon />;
    return <GlobeIcon />;
  }

  function getLabel() {
    if (isUrl && domain) return domain;
    return source.label;
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {getIcon()}
      <span className="max-w-[180px] truncate">{getLabel()}</span>
      <button
        type="button"
        onClick={() => onRemove(source.id)}
        className="ml-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
        aria-label={`Remove ${getLabel()}`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export type { SourceChip };
