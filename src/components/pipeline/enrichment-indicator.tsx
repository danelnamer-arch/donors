"use client";

interface EnrichmentCategory {
  status: "complete" | "missing" | "in_progress";
  source?: string | null;
  count?: number;
}

interface EnrichmentData {
  categories?: {
    basicInfo?: EnrichmentCategory;
    grants?: EnrichmentCategory;
    publications?: EnrichmentCategory;
    contactInfo?: EnrichmentCategory;
    financials?: EnrichmentCategory;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  basicInfo: "Basic Info",
  grants: "Grants",
  publications: "Publications",
  contactInfo: "Contact",
  financials: "Financials",
};

const CATEGORY_KEYS = ["basicInfo", "grants", "publications", "contactInfo", "financials"] as const;

/* ─── Table cell variant (5 dots) ───────────────── */
export function EnrichmentDots({
  enrichedData,
}: {
  enrichedData: Record<string, unknown> | null;
}) {
  const data = enrichedData as EnrichmentData | null;
  const cats = data?.categories;

  return (
    <div className="flex items-center gap-1" title="Enrichment status">
      {CATEGORY_KEYS.map((key) => {
        const cat = cats?.[key];
        const status = cat?.status || "missing";

        return (
          <div
            key={key}
            className={`h-2 w-2 rounded-full ${
              status === "complete"
                ? "bg-green-500"
                : status === "in_progress"
                  ? "animate-pulse bg-blue-500"
                  : "bg-zinc-200 dark:bg-zinc-700"
            }`}
            title={`${CATEGORY_LABELS[key]}: ${
              status === "complete"
                ? `Found${cat?.source ? ` via ${cat.source}` : ""}${cat?.count ? ` (${cat.count})` : ""}`
                : status === "in_progress"
                  ? "In progress"
                  : "Not enriched"
            }`}
          />
        );
      })}
    </div>
  );
}

/* ─── Panel expanded variant ────────────────────── */
export function EnrichmentDetail({
  enrichedData,
}: {
  enrichedData: Record<string, unknown> | null;
}) {
  const data = enrichedData as EnrichmentData | null;
  const cats = data?.categories;

  if (!cats) {
    return <p className="text-sm italic text-zinc-400">No enrichment data</p>;
  }

  return (
    <div className="space-y-1.5">
      {CATEGORY_KEYS.map((key) => {
        const cat = cats[key];
        const status = cat?.status || "missing";

        return (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">
              {CATEGORY_LABELS[key]}
            </span>
            <div className="flex items-center gap-1.5">
              {status === "complete" ? (
                <>
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {cat?.count ? `${cat.count} found` : "complete"}
                  </span>
                  {cat?.source && (
                    <span className="text-[10px] text-zinc-400">
                      via {cat.source}
                    </span>
                  )}
                </>
              ) : status === "in_progress" ? (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  in progress
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Card mini bar variant ─────────────────────── */
export function EnrichmentMiniBar({
  enrichedData,
}: {
  enrichedData: Record<string, unknown> | null;
}) {
  const data = enrichedData as EnrichmentData | null;
  const cats = data?.categories;

  return (
    <div className="flex h-1 w-full gap-px overflow-hidden rounded-full">
      {CATEGORY_KEYS.map((key) => {
        const status = cats?.[key]?.status || "missing";
        return (
          <div
            key={key}
            className={`flex-1 ${
              status === "complete"
                ? "bg-green-500"
                : status === "in_progress"
                  ? "animate-pulse bg-blue-500"
                  : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        );
      })}
    </div>
  );
}
