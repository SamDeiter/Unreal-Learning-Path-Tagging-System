import { useEffect, useMemo, useState } from "react";
import { Clock, RotateCcw, Trophy, Zap } from "lucide-react";

const STORAGE_KEY = "concept-page-migration-checklist-v1";

const KIND_LABELS = {
  workflow_step: "workflow",
  module: "module",
  blueprint_node: "blueprint",
  class: "class",
};

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage disabled — silently ignore */
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled — silently ignore */
  }
}

function modeFromVersion(refs) {
  const counts = new Map();
  for (const r of refs) {
    if (!r.fromVersion) continue;
    counts.set(r.fromVersion, (counts.get(r.fromVersion) || 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [version, count] of counts) {
    if (count > bestCount) {
      best = version;
      bestCount = count;
    }
  }
  return best || "5.6";
}

function deriveActionParts(ref) {
  const { name, replacement, changeType } = ref;
  if (replacement && changeType === "deprecated") {
    return [
      { text: "Replace " },
      { code: name },
      { text: " with " },
      { code: replacement },
    ];
  }
  if (replacement && changeType === "removed") {
    return [
      { code: name },
      { text: " is removed — migrate to " },
      { code: replacement },
    ];
  }
  if (!replacement && changeType === "deprecated") {
    return [
      { text: "Audit usage of " },
      { code: name },
      { text: " — deprecated, no replacement yet" },
    ];
  }
  return [
    { text: "Remove " },
    { code: name },
    { text: " from project — no replacement" },
  ];
}

function ActionText({ delta, checked }) {
  const parts = deriveActionParts(delta);
  return (
    <span
      className={`font-body-base text-code-sm break-words min-w-0 ${
        checked ? "text-on-surface-variant line-through" : "text-on-surface"
      } transition motion-reduce:transition-none`}
    >
      {parts.map((p, i) =>
        p.code ? (
          <code
            key={i}
            className="rounded bg-surface-container-high/70 px-1 py-0.5 font-mono text-[0.8rem] text-primary break-words"
          >
            {p.code}
          </code>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

function ChecklistItem({ refItem, checked, onToggle, videoCount }) {
  const kindLabel = KIND_LABELS[refItem.kind] || refItem.kind;

  return (
    <label className="flex items-center gap-gutter p-gutter bg-surface-container border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors motion-reduce:transition-none min-w-0">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={onToggle}
        aria-label={checked ? "Mark as not done" : "Mark as done"}
        className="form-checkbox bg-background border-outline-variant text-primary rounded-sm w-5 h-5 shrink-0"
      />
      <span className="flex-1 min-w-0 break-words">
        <ActionText delta={refItem} checked={checked} />
      </span>
      <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5">
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-caps text-[0.65rem] tracking-widest font-bold text-on-surface-variant">
          {kindLabel}
        </span>
        {videoCount > 0 ? (
          <span className="rounded-full bg-secondary-container/40 px-2 py-0.5 font-label-caps text-[0.65rem] tracking-widest font-bold text-on-secondary-container">
            {videoCount} {videoCount === 1 ? "vid" : "vids"}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Checklist({ refs = [], userVersion = "5.7" }) {
  const [checks, setChecks] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration on mount; standard pattern
    setChecks(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(checks);
  }, [checks, hydrated]);

  const fromVersion = useMemo(() => modeFromVersion(refs), [refs]);

  const { breaking, minor } = useMemo(() => {
    const sortDesc = (a, b) => (b.mentionCount || 0) - (a.mentionCount || 0);
    const breakingItems = refs
      .filter((r) => r.severity === "breaking")
      .slice()
      .sort(sortDesc);
    const minorItems = refs
      .filter((r) => r.severity !== "breaking")
      .slice()
      .sort(sortDesc);
    return { breaking: breakingItems, minor: minorItems };
  }, [refs]);

  const total = refs.length;
  const doneCount = useMemo(
    () => refs.reduce((acc, r) => acc + (checks[r.id] ? 1 : 0), 0),
    [refs, checks]
  );
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const allDone = total > 0 && doneCount === total;

  const toggle = (id) => {
    setChecks((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setChecks({});
    clearStorage();
    setConfirmingReset(false);
  };

  useEffect(() => {
    if (!confirmingReset) return undefined;
    const t = setTimeout(() => setConfirmingReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingReset]);

  return (
    <section className="px-margin py-lg pb-24">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-baseline justify-between gap-sm mb-xs">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Migration Strategy
          </h2>
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
            UE {fromVersion} &rarr; {userVersion}
          </span>
        </div>
        <p className="font-body-base text-code-sm text-on-surface-variant mb-md">
          Check off each item as you migrate your project. Progress saves locally
          to your browser.
        </p>

        {allDone ? (
          <div className="mb-md flex items-start gap-sm rounded-lg bg-emerald-accent/10 p-sm text-sm text-emerald-accent">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">All migrations complete.</span>{" "}
              Your project is {userVersion}-ready.
            </span>
          </div>
        ) : null}

        <div className="mb-md">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              <span className="font-semibold text-on-surface">{doneCount}</span> of{" "}
              <span className="font-semibold text-on-surface">{total}</span> done
              <span className="mx-1.5 text-outline-variant">·</span>
              <span className="font-semibold text-on-surface">{pct}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-outline-variant">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-coral-accent via-amber-accent to-emerald-accent transition-all duration-300 motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="space-y-lg">
          {breaking.length > 0 ? (
            <div>
              <h4 className="font-label-caps text-label-caps text-coral-accent mb-base tracking-widest uppercase flex items-center gap-xs">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" /> DO FIRST
                (CRITICAL)
              </h4>
              <div className="space-y-base">
                {breaking.map((r) => (
                  <ChecklistItem
                    key={r.id}
                    refItem={r}
                    checked={!!checks[r.id]}
                    onToggle={() => toggle(r.id)}
                    videoCount={r.mentionCount || 0}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {minor.length > 0 ? (
            <div>
              <h4 className="font-label-caps text-label-caps text-primary mb-base tracking-widest uppercase flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> WHEN YOU HAVE
                TIME
              </h4>
              <div className="space-y-base">
                {minor.map((r) => (
                  <ChecklistItem
                    key={r.id}
                    refItem={r}
                    checked={!!checks[r.id]}
                    onToggle={() => toggle(r.id)}
                    videoCount={r.mentionCount || 0}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-md flex items-center justify-end">
          <button
            type="button"
            onClick={handleResetClick}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition motion-reduce:transition-none ${
              confirmingReset
                ? "text-coral-accent hover:text-coral-accent/80"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {confirmingReset ? "Click again to confirm reset" : "Reset checklist"}
          </button>
        </div>
      </div>
    </section>
  );
}
