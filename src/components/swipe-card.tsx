"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { formatGrantAmount } from "@/lib/utils/format-amount";

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

interface ScoreBreakdown {
  causeAlignment: number;
  geographicOverlap: number;
  populationOverlap: number;
  semanticSimilarity: number;
  politicalAlignment?: number;
  grantSizeAlignment: number;
  grantRecipientSimilarity: number;
  recencyBonus: number;
  feedbackBoost: number;
  dataQuality: number;
}

interface MatchData {
  id: string;
  reasoning: string;
  scoreBreakdown?: ScoreBreakdown | null;
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

/**
 * Get the top scoring signals to display as strength bars.
 * Returns up to 4 signals, sorted by value, with human labels and colors.
 */
function getTopSignals(breakdown: ScoreBreakdown): { label: string; value: number; color: string }[] {
  const signals: { label: string; value: number; color: string; key: string }[] = [
    { label: "Cause Alignment", value: breakdown.causeAlignment, color: "bg-emerald-500", key: "cause" },
    { label: "Geographic Overlap", value: breakdown.geographicOverlap, color: "bg-blue-500", key: "geo" },
    { label: "Mission Similarity", value: breakdown.semanticSimilarity, color: "bg-violet-500", key: "semantic" },
    { label: "Grant Size Fit", value: breakdown.grantSizeAlignment, color: "bg-amber-500", key: "grant" },
    { label: "Population Match", value: breakdown.populationOverlap, color: "bg-teal-500", key: "pop" },
    { label: "Funds Similar Orgs", value: breakdown.grantRecipientSimilarity, color: "bg-rose-500", key: "recipient" },
    { label: "Recent Activity", value: breakdown.recencyBonus, color: "bg-cyan-500", key: "recency" },
    { label: "Values Alignment", value: breakdown.politicalAlignment ?? 0, color: "bg-purple-500", key: "political" },
  ];

  return signals
    .filter((s) => s.value > 0.1) // Only show meaningful signals
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function strengthLabel(value: number): string {
  if (value >= 0.8) return "Strong";
  if (value >= 0.5) return "Good";
  if (value >= 0.3) return "Moderate";
  return "Weak";
}

export function SwipeCard({ match, onSwipe, disabled }: SwipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const passOpacity = useTransform(x, [-150, -50, 0], [1, 0, 0]);
  const likeOpacity = useTransform(x, [0, 50, 150], [0, 0, 1]);

  const { donor } = match;

  function handleSwipe(action: "RIGHT" | "LEFT") {
    setExiting(action === "RIGHT" ? "right" : "left");
    setTimeout(() => onSwipe(match.id, action), 250);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    if (disabled) return;
    const threshold = 120;
    if (info.offset.x > threshold || info.velocity.x > 500) {
      handleSwipe("RIGHT");
    } else if (info.offset.x < -threshold || info.velocity.x < -500) {
      handleSwipe("LEFT");
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={match.id}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={
          exiting === "left"
            ? { x: -500, opacity: 0, rotate: -15 }
            : exiting === "right"
              ? { x: 500, opacity: 0, rotate: 15 }
              : { opacity: 1, scale: 1, y: 0 }
        }
        transition={
          exiting
            ? { duration: 0.25, ease: "easeOut" }
            : { type: "spring", stiffness: 300, damping: 25 }
        }
        className="relative w-full max-w-lg cursor-grab overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-lg shadow-zinc-200/60 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-zinc-900/50"
      >
        {/* Drag overlays */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-green-400 bg-green-400/10"
        >
          <span className="-rotate-12 rounded-xl border-4 border-green-500 px-8 py-3 text-3xl font-extrabold uppercase tracking-wider text-green-500">
            Interested
          </span>
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-red-400 bg-red-400/10"
        >
          <span className="rotate-12 rounded-xl border-4 border-red-500 px-8 py-3 text-3xl font-extrabold uppercase tracking-wider text-red-500">
            Pass
          </span>
        </motion.div>

        {/* Header with gradient accent */}
        <div className="bg-gradient-to-r from-brand/5 via-brand/10 to-emerald-500/5 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {donor.name}
              </h2>
              <div className="mt-1.5 flex items-center gap-2 text-sm text-zinc-500">
                <span className="inline-flex items-center rounded-md bg-brand-light px-2 py-0.5 text-xs font-medium text-brand">
                  {donor.type}
                </span>
                {donor.country && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {donor.country}
                  </span>
                )}
              </div>
            </div>
            {donor.website && (
              <a
                href={donor.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Website
              </a>
            )}
          </div>

          {/* Match reasoning */}
          <div className="mt-4 rounded-xl border border-brand/20 bg-white/80 px-4 py-3 backdrop-blur-sm dark:bg-zinc-900/80">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Why this match
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {match.reasoning}
            </p>
          </div>

          {/* Match Strength Breakdown */}
          {match.scoreBreakdown && (
            <div className="mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowStrength(!showStrength); }}
                className="flex w-full items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showStrength ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Match Strength
              </button>
              {showStrength && (
                <div className="mt-2 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  {getTopSignals(match.scoreBreakdown).map((signal) => (
                    <div key={signal.label} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-xs text-zinc-500">{signal.label}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${signal.color} transition-all`}
                          style={{ width: `${Math.round(signal.value * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-medium text-zinc-500">
                        {strengthLabel(signal.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {donor.causes.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
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
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
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

          {donor.description ? (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {donor.description.length > 200 && !expanded
                ? `${donor.description.slice(0, 200)}...`
                : donor.description}
              {donor.description.length > 200 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="ml-1 font-medium text-brand hover:underline"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </p>
          ) : (
            donor.causes.length === 0 && donor.grants.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-sm text-zinc-400">
                  Limited data available for this donor. Swipe right to save and we&apos;ll enrich the profile.
                </p>
              </div>
            )
          )}
        </div>

        {/* Past Grants */}
        {donor.grants.length > 0 && (
          <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Past Grants
            </p>
            <div className="space-y-2.5">
              {donor.grants.slice(0, 3).map((grant, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {grant.recipientName}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {grant.amount
                      ? formatGrantAmount(grant.amount)
                      : "N/A"}
                    {grant.year ? (
                      <span className="ml-1 font-normal text-zinc-400">
                        ({grant.year})
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publications */}
        {donor.publications.length > 0 && (
          <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
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
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-brand hover:underline"
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
            className="flex flex-1 items-center justify-center gap-2 py-4 text-sm font-semibold text-zinc-400 transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
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
            className="flex flex-1 items-center justify-center gap-2 py-4 text-sm font-semibold text-brand transition-all hover:bg-brand-light disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Interested
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
