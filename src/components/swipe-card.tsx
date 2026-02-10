"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface DonorGrant {
  recipientName: string;
  amount: number | null;
  year: number | null;
  purpose: string | null;
}

interface DonorPublication {
  title: string;
  url: string | null;
  publishedAt: Date | null;
}

interface MatchData {
  id: string;
  reasoning: string;
  donor: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    website: string | null;
    country: string | null;
    causes: string[];
    targetPopulations: string[];
    geographicFocus: string[];
    grants: DonorGrant[];
    publications: DonorPublication[];
  };
}

interface SwipeCardProps {
  match: MatchData;
  onSwipe: (matchId: string, action: "RIGHT" | "LEFT") => void;
  disabled?: boolean;
}

export function SwipeCard({ match, onSwipe, disabled }: SwipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);

  const { donor } = match;

  function handleSwipe(action: "RIGHT" | "LEFT") {
    setSwiping(action === "RIGHT" ? "right" : "left");
    setTimeout(() => onSwipe(match.id, action), 300);
  }

  return (
    <div
      className={`w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-lg transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950 ${
        swiping === "left"
          ? "-translate-x-full rotate-[-10deg] opacity-0"
          : swiping === "right"
            ? "translate-x-full rotate-[10deg] opacity-0"
            : ""
      }`}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-black dark:text-white">
              {donor.name}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
              <Badge variant="info">{donor.type}</Badge>
              {donor.country && <span>{donor.country}</span>}
            </div>
          </div>
          {donor.website && (
            <a
              href={donor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Website
            </a>
          )}
        </div>

        {/* Match reasoning */}
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Why this match?
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            {match.reasoning}
          </p>
        </div>
      </div>

      {/* Causes & Focus */}
      <div className="px-6 pb-4">
        {donor.causes.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase text-zinc-400">
              Focus Areas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {donor.causes.map((cause) => (
                <Badge key={cause}>{cause}</Badge>
              ))}
            </div>
          </div>
        )}

        {donor.geographicFocus.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase text-zinc-400">
              Geographic Focus
            </p>
            <div className="flex flex-wrap gap-1.5">
              {donor.geographicFocus.map((geo) => (
                <Badge key={geo} variant="info">
                  {geo}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {donor.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {donor.description.length > 200 && !expanded
              ? `${donor.description.slice(0, 200)}...`
              : donor.description}
            {donor.description.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-1 text-blue-600 hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        )}
      </div>

      {/* Past Grants */}
      {donor.grants.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase text-zinc-400">
            Past Grants
          </p>
          <div className="space-y-2">
            {donor.grants.slice(0, 3).map((grant, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {grant.recipientName}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {grant.amount
                    ? `$${grant.amount.toLocaleString()}`
                    : "Amount N/A"}
                  {grant.year ? ` (${grant.year})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publications */}
      {donor.publications.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase text-zinc-400">
            Publications
          </p>
          <div className="space-y-1.5">
            {donor.publications.map((pub, i) => (
              <div key={i}>
                {pub.url ? (
                  <a
                    href={pub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {pub.title}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-600">{pub.title}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => handleSwipe("LEFT")}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-bl-2xl py-4 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Pass
        </button>
        <div className="w-px bg-zinc-100 dark:bg-zinc-800" />
        <button
          onClick={() => handleSwipe("RIGHT")}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-br-2xl py-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-900/20"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Interested
        </button>
      </div>
    </div>
  );
}
