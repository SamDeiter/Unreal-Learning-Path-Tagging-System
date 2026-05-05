import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Film,
} from "lucide-react";
import { formatVideoLabel } from "./data/exposure";

const KIND_LABELS = {
  workflow_step: "Workflow",
  module: "Module",
  blueprint_node: "Blueprint",
  class: "Class",
};

function severityBorder(severity) {
  return severity === "breaking" ? "border-coral-accent" : "border-amber-accent";
}

function severityChip(severity) {
  return severity === "breaking"
    ? "bg-coral-accent/10 text-coral-accent"
    : "bg-amber-accent/10 text-amber-accent";
}

function DeltaCard({ refItem, exposureEntry }) {
  const [expanded, setExpanded] = useState(false);
  const kindLabel = KIND_LABELS[refItem.kind] ?? refItem.kind;
  const sevLabel =
    refItem.severity === "breaking" ? "BREAKING" : "MINOR";

  const videoCount = exposureEntry?.videoCount ?? 0;
  const videoIds = exposureEntry?.videoIds ?? [];
  const visibleVideoIds = videoIds.slice(0, 5);
  const moreCount = Math.max(0, videoCount - visibleVideoIds.length);

  const Caret = expanded ? ChevronUp : ChevronDown;

  return (
    <article
      className={`bg-surface-container border-l-4 ${severityBorder(refItem.severity)} p-gutter rounded-r-xl transition-all hover:translate-x-1`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between text-left"
      >
        <div className="min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-xs mb-xs">
            <span
              className={`px-sm py-[2px] rounded font-label-caps text-[10px] tracking-widest font-bold ${severityChip(refItem.severity)}`}
            >
              {sevLabel}
            </span>
            <span className="px-sm py-[2px] rounded font-label-caps text-[10px] tracking-widest font-bold bg-secondary-container/50 text-secondary-fixed-dim">
              {kindLabel}
            </span>
          </div>
          <h4 className="font-headline-md text-[18px] font-semibold text-on-surface break-words min-w-0">
            {refItem.name}
          </h4>
        </div>
        <Caret
          className="h-5 w-5 shrink-0 text-outline mt-1"
          aria-hidden="true"
        />
      </button>

      <p
        className={`min-w-0 break-words font-body-base text-code-sm text-on-surface-variant mt-sm ${expanded ? "" : "line-clamp-1"}`}
      >
        {refItem.summary}
      </p>

      {expanded ? (
        <div className="mt-gutter border-t border-outline-variant pt-gutter space-y-sm">
          {refItem.replacement ? (
            <div className="rounded-lg bg-emerald-accent/10 border border-emerald-accent/30 p-sm text-sm text-emerald-accent break-words min-w-0">
              <ArrowRightLeft
                className="mr-1 inline h-3.5 w-3.5"
                aria-hidden="true"
              />
              <span className="text-on-surface-variant">Now use </span>
              <span className="font-medium text-emerald-accent break-words">
                {refItem.replacement}
              </span>
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant">No direct replacement.</div>
          )}

          <div className="text-xs text-on-surface-variant">
            {refItem.fromVersion} &rarr; {refItem.toVersion}
            {refItem.area ? (
              <>
                <span className="mx-1.5 text-outline-variant">·</span>
                <span className="break-words">{refItem.area}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-xs text-sm text-on-surface">
            <Film className="h-4 w-4 text-outline" aria-hidden="true" />
            <span>
              <span className="font-semibold text-on-surface">{videoCount}</span>{" "}
              {videoCount === 1 ? "video" : "videos"} affected
            </span>
          </div>

          {videoCount > 0 ? (
            <ul className="space-y-1 text-xs text-on-surface-variant">
              {visibleVideoIds.map((vid) => (
                <li
                  key={vid}
                  className="min-w-0 truncate rounded bg-surface-container-high/60 px-2 py-1 break-words"
                  title={formatVideoLabel(vid)}
                >
                  {formatVideoLabel(vid)}
                </li>
              ))}
              {moreCount > 0 && (
                <li className="px-2 py-1 text-primary">
                  +{moreCount} more
                </li>
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DeltaGallery({ refs, exposure }) {
  const [filter, setFilter] = useState("all");
  const sectionRef = useRef(null);

  const safeRefs = Array.isArray(refs) ? refs : [];
  const safeExposure = exposure ?? {};

  const sortedRefs = useMemo(() => {
    const severityRank = { breaking: 0, minor: 1 };
    return [...safeRefs].sort((a, b) => {
      const aCount = safeExposure[a.id]?.videoCount ?? 0;
      const bCount = safeExposure[b.id]?.videoCount ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      const aSev = severityRank[a.severity] ?? 99;
      const bSev = severityRank[b.severity] ?? 99;
      return aSev - bSev;
    });
  }, [safeRefs, safeExposure]);

  const counts = useMemo(() => {
    const byKind = { workflow_step: 0, module: 0, blueprint_node: 0, class: 0 };
    let breaking = 0;
    for (const r of safeRefs) {
      if (byKind[r.kind] != null) byKind[r.kind] += 1;
      if (r.severity === "breaking") breaking += 1;
    }
    return { all: safeRefs.length, breaking, ...byKind };
  }, [safeRefs]);

  const filtered = useMemo(() => {
    if (filter === "all") return sortedRefs;
    if (filter === "breaking")
      return sortedRefs.filter((r) => r.severity === "breaking");
    return sortedRefs.filter((r) => r.kind === filter);
  }, [sortedRefs, filter]);

  useEffect(() => {
    function onScrollTo(e) {
      if (e?.detail?.section === "gallery") {
        setFilter("all");
        if (sectionRef.current) {
          sectionRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    }
    window.addEventListener("concept-page:scroll-to", onScrollTo);
    return () =>
      window.removeEventListener("concept-page:scroll-to", onScrollTo);
  }, []);

  const pills = [
    { id: "all", label: "All", count: counts.all },
    { id: "breaking", label: "Breaking", count: counts.breaking },
  ];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="delta-gallery-heading"
      className="px-margin py-lg"
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-sm mb-md">
          <h2
            id="delta-gallery-heading"
            className="font-headline-md text-headline-md text-on-surface"
          >
            Change Deltas
          </h2>
          <div
            className="flex flex-wrap gap-xs"
            role="tablist"
            aria-label="Filter deltas by kind"
          >
            {pills.map((p) => {
              const active = filter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-sm py-xs font-label-caps text-[10px] tracking-widest font-bold transition-colors motion-reduce:transition-none ${
                    active
                      ? "bg-surface-container-high text-on-surface"
                      : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] ${
                      active ? "text-primary" : "text-outline"
                    }`}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-md text-center text-sm text-on-surface-variant">
            No deltas match this filter.
          </div>
        ) : (
          <div className="flex flex-col gap-base">
            {filtered.map((r) => (
              <DeltaCard
                key={r.id}
                refItem={r}
                exposureEntry={safeExposure[r.id]}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
