"use client";

import { motion } from "framer-motion";

const PROGRESS_MESSAGES = [
  "Reading your sources...",
  "Understanding your mission...",
  "Identifying cause areas...",
  "Mapping your geographic focus...",
  "Finding target populations...",
  "Looking for mentioned donors...",
  "Building your profile...",
];

interface ExtractionOverlayProps {
  progressIdx: number;
}

export function ExtractionOverlay({ progressIdx }: ExtractionOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm dark:bg-zinc-950/95"
    >
      {/* Spinner */}
      <div className="mb-5">
        <span className="inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </div>

      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Analyzing your sources...
      </h3>

      {/* Progress messages */}
      <div className="mt-5 min-h-[100px] space-y-1.5 px-8 text-center">
        {PROGRESS_MESSAGES.slice(0, progressIdx + 1).map((msg, i) => (
          <motion.p
            key={msg}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: i === progressIdx ? 1 : 0.4, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-sm text-zinc-500"
          >
            {i < progressIdx ? "✓" : "..."} {msg}
          </motion.p>
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        This usually takes 15–30 seconds
      </p>
    </motion.div>
  );
}

export { PROGRESS_MESSAGES };
