import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Code,
  Cpu,
  Sparkles,
  XCircle,
} from "lucide-react";

const OUTCOME_META = {
  ok: {
    label: "Works",
    Icon: CheckCircle,
    chip: "bg-emerald-500/15 text-emerald-300",
    dot: "bg-emerald-400",
  },
  warn: {
    label: "Works with deprecation warning",
    Icon: AlertTriangle,
    chip: "bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
  },
  broken: {
    label: "Broken",
    Icon: XCircle,
    chip: "bg-rose-500/15 text-rose-300",
    dot: "bg-rose-400",
  },
  fixed: {
    label: "Recommended path",
    Icon: Sparkles,
    chip: "bg-indigo-500/15 text-indigo-300",
    dot: "bg-indigo-400",
  },
};

export function Simulator({ scripts = [], refs = [] }) {
  const [activeScriptId, setActiveScriptId] = useState(scripts[0]?.id ?? null);
  const [stepIndex, setStepIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const containerRef = useRef(null);
  const interactedRef = useRef(false);

  const refsById = useMemo(() => {
    const map = new Map();
    for (const r of refs) map.set(r.id, r);
    return map;
  }, [refs]);

  const activeScript = useMemo(
    () => scripts.find((s) => s.id === activeScriptId) ?? scripts[0] ?? null,
    [scripts, activeScriptId]
  );

  const totalSteps = activeScript?.steps?.length ?? 0;
  const currentStep =
    activeScript && totalSteps > 0
      ? activeScript.steps[Math.min(stepIndex, totalSteps - 1)]
      : null;

  const linkedRef = activeScript ? refsById.get(activeScript.refId) : null;

  useEffect(() => {
    if (!activeScript) return;
    setFading(true);
    setStepIndex(0);
    const t = setTimeout(() => setFading(false), 180);
    return () => clearTimeout(t);
  }, [activeScriptId, activeScript]);

  useEffect(() => {
    function onKey(e) {
      if (!interactedRef.current) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const inViewport =
        rect.bottom > 0 &&
        rect.top < (window.innerHeight || document.documentElement.clientHeight);
      if (!inViewport) return;
      if (e.key === "ArrowLeft") {
        setStepIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [totalSteps]);

  function handleScriptPick(id) {
    interactedRef.current = true;
    setActiveScriptId(id);
  }

  function handlePrev() {
    interactedRef.current = true;
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    interactedRef.current = true;
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
  }

  function handleFocusOrClick() {
    interactedRef.current = true;
  }

  if (!activeScript || !currentStep) {
    return (
      <section className="px-margin py-lg bg-surface-container-lowest text-on-surface-variant">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-base mb-md">
            <Cpu className="text-primary h-6 w-6" aria-hidden="true" />
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Tutorial vs. Reality
            </h2>
          </div>
          <div className="text-sm">No simulator scripts available.</div>
        </div>
      </section>
    );
  }

  const outcome = OUTCOME_META[currentStep.reality.outcome] ?? OUTCOME_META.ok;
  const OutcomeIcon = outcome.Icon;
  const isRecommended = !!currentStep.tutorial.recommended;

  return (
    <section
      ref={containerRef}
      tabIndex={0}
      onFocus={handleFocusOrClick}
      onClick={handleFocusOrClick}
      aria-label="UE Version Migration Simulator"
      className="outline-none focus:ring-1 focus:ring-primary/30 px-margin py-lg bg-surface-container-lowest"
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-base mb-md">
          <Cpu className="text-primary h-6 w-6" aria-hidden="true" />
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Tutorial vs. Reality
          </h2>
        </div>

        {/* Script picker */}
        <div className="flex flex-wrap gap-xs mb-gutter">
          {scripts.map((s) => {
            const active = s.id === activeScript.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleScriptPick(s.id)}
                className={
                  "rounded-lg border px-gutter py-xs text-sm font-medium transition-colors motion-reduce:transition-none " +
                  (active
                    ? "border-primary/50 bg-primary/20 text-on-surface"
                    : "border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface")
                }
              >
                {s.title}
              </button>
            );
          })}
        </div>

        {/* Active script meta */}
        <div className="mb-md min-w-0">
          <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
            {activeScript.subtitle}
          </div>
          <p className="mt-xs break-words font-body-base text-code-sm text-on-surface min-w-0">
            {activeScript.summary}
          </p>
          {linkedRef ? (
            <div className="mt-xs break-words text-xs text-on-surface-variant min-w-0">
              Linked ref:{" "}
              <span className="text-on-surface break-words">{linkedRef.name}</span>
              <span className="mx-1.5 text-outline-variant">·</span>
              <span>
                {linkedRef.fromVersion} &rarr; {linkedRef.toVersion}
              </span>
              {linkedRef.replacement ? (
                <>
                  <span className="mx-1.5 text-outline-variant">·</span>
                  <span className="break-words">
                    replacement: {linkedRef.replacement}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Side-by-side panes */}
        <div
          className={
            "grid grid-cols-1 md:grid-cols-2 gap-gutter transition-opacity duration-200 motion-reduce:transition-none " +
            (fading ? "opacity-0" : "opacity-100")
          }
        >
          {/* Left — tutorial */}
          <div className="bg-surface-container border border-outline-variant p-gutter rounded-xl min-w-0 flex flex-col">
            <div className="flex items-center justify-between gap-xs mb-base">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> 5.6 TUTORIAL SAYS
              </p>
              {isRecommended ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-label-caps text-[10px] tracking-widest font-bold text-primary">
                  Recommended
                </span>
              ) : null}
            </div>
            <div className="bg-primary-container p-sm rounded border border-outline-variant font-code-sm text-code-sm text-on-primary-container min-w-0">
              <div className="font-semibold text-on-surface break-words min-w-0">
                {currentStep.tutorial.heading}
              </div>
              <p className="mt-xs leading-relaxed text-on-surface-variant break-words min-w-0">
                {currentStep.tutorial.body}
              </p>
            </div>
          </div>

          {/* Right — reality */}
          <div className="bg-surface-container-high border border-primary/30 p-gutter rounded-xl relative overflow-hidden min-w-0 flex flex-col">
            <div className="absolute top-0 right-0 px-xs py-xs bg-primary text-on-primary font-label-caps text-[10px] tracking-widest font-bold">
              REALITY
            </div>
            <div className="flex items-center justify-between gap-xs mb-base mt-7 sm:mt-2 pr-16">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
                <Code className="h-3.5 w-3.5" aria-hidden="true" /> UE 5.7 REALITY
              </p>
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                  outcome.chip
                }
              >
                <OutcomeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {outcome.label}
              </span>
            </div>
            <div className="bg-background p-sm rounded border border-outline-variant font-code-sm text-code-sm text-emerald-accent min-w-0 relative">
              <span
                className={`absolute right-3 top-3 inline-block h-2 w-2 rounded-full ${outcome.dot}`}
                aria-hidden="true"
              />
              <div className="font-semibold text-on-surface break-words min-w-0 pr-6">
                {currentStep.reality.heading}
              </div>
              <p className="mt-xs leading-relaxed text-on-surface-variant break-words min-w-0">
                {currentStep.reality.body}
              </p>
            </div>
          </div>
        </div>

        {/* Step navigator */}
        <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 rounded-md bg-surface-container-high/60 px-sm py-xs text-sm text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Prev
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={stepIndex >= totalSteps - 1}
              className="inline-flex items-center gap-1 rounded-md bg-surface-container-high/60 px-sm py-xs text-sm text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-sm">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {activeScript.steps.map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-2 w-2 rounded-full transition-colors motion-reduce:transition-none " +
                    (i === stepIndex ? "bg-primary" : "bg-outline-variant")
                  }
                />
              ))}
            </div>
            <div className="text-xs text-on-surface-variant">
              Step {stepIndex + 1} of {totalSteps}
            </div>
          </div>
        </div>

        <div className="mt-sm text-[11px] text-on-surface-variant">
          Tip: use &larr; / &rarr; to step through after clicking the simulator.
        </div>
      </div>
    </section>
  );
}
