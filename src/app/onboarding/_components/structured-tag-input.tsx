"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────

export interface SimilarOrg {
  name: string;
  registrationNumber?: string;
  website?: string;
}

export interface ExistingDonor {
  name: string;
  website?: string;
}

// ─── Similar Orgs Input ─────────────────────────────

interface SimilarOrgsInputProps {
  items: SimilarOrg[];
  onAdd: (item: SimilarOrg) => void;
  onRemove: (index: number) => void;
}

export function SimilarOrgsInput({ items, onAdd, onRemove }: SimilarOrgsInputProps) {
  const [name, setName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [website, setWebsite] = useState("");

  function handleAdd() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onAdd({
      name: trimmedName,
      ...(regNumber.trim() ? { registrationNumber: regNumber.trim() } : {}),
      ...(website.trim() ? { website: website.trim() } : {}),
    });
    setName("");
    setRegNumber("");
    setWebsite("");
  }

  return (
    <div className="space-y-3">
      {/* Existing tags */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={`${item.name}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <span className="max-w-[200px] truncate font-medium">{item.name}</span>
              {item.registrationNumber && (
                <span className="text-xs text-zinc-400">#{item.registrationNumber}</span>
              )}
              {item.website && (
                <span className="text-xs text-blue-400" title={item.website}>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex gap-2">
          <Input
            placeholder="Organization name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="flex-1"
          />
          <Input
            placeholder="Reg. number"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="w-32"
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Website URL (optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
            className="h-10 px-4"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Existing Donors Input ──────────────────────────

interface ExistingDonorsInputProps {
  items: ExistingDonor[];
  onAdd: (item: ExistingDonor) => void;
  onRemove: (index: number) => void;
}

export function ExistingDonorsInput({ items, onAdd, onRemove }: ExistingDonorsInputProps) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  function handleAdd() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onAdd({
      name: trimmedName,
      ...(website.trim() ? { website: website.trim() } : {}),
    });
    setName("");
    setWebsite("");
  }

  return (
    <div className="space-y-3">
      {/* Existing tags */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <span
              key={`${item.name}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <span className="max-w-[200px] truncate font-medium">{item.name}</span>
              {item.website && (
                <span className="text-xs text-blue-400" title={item.website}>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="flex gap-2 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
        <Input
          placeholder="Donor or foundation name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1"
        />
        <Input
          placeholder="Website (optional)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="h-10 px-4"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
