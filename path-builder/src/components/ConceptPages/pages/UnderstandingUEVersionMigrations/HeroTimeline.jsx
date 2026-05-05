import { useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Trash2,
  Film,
  RefreshCw,
} from "lucide-react";

const ALL_VERSIONS = [
  "5.0",
  "5.1",
  "5.2",
  "5.3",
  "5.4",
  "5.5",
  "5.6",
  "5.7",
  "5.8",
];

function focusedWindow(userVersion) {
  const idx = ALL_VERSIONS.indexOf(userVersion);
  const safeIdx = idx === -1 ? ALL_VERSIONS.length - 2 : idx;
  let start = safeIdx - 2;
  let end = safeIdx + 2;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > ALL_VERSIONS.length - 1) {
    start -= end - (ALL_VERSIONS.length - 1);
    end = ALL_VERSIONS.length - 1;
    if (start < 0) start = 0;
  }
  const window = ALL_VERSIONS.slice(start, end + 1);
  if (window.length <= 4) return window;
  const userPos = window.indexOf(userVersion);
  const winStart = Math.max(0, Math.min(window.length - 4, userPos - 2));
  return window.slice(winStart, winStart + 4);
}

// eslint-disable-next-line no-unused-vars
function StatTile({ Icon, value, label, accent, border, glow, colSpan }) {
  return (
    <div
      className={`bg-surface-container p-gutter border ${border} rounded-xl hover:bg-surface-container-high transition-all ${colSpan ?? ""}`}
    >
      <Icon
        className={`mb-base h-6 w-6 ${accent} ${glow ?? ""}`}
        aria-hidden="true"
      />
      <p className="font-label-caps text-label-caps text-on-surface-variant">
        {label}
      </p>
      <h3 className="font-headline-md text-headline-md text-on-surface mt-xs">
        {value}
      </h3>
    </div>
  );
}

export function HeroTimeline({
  refs = [],
  userVersion = "5.7",
  // eslint-disable-next-line no-unused-vars
  exposure = {},
  totalAffected = 0,
}) {
  const counts = useMemo(() => {
    let breaking = 0;
    let minor = 0;
    let removed = 0;
    let withReplacement = 0;
    for (const r of refs) {
      if (r.severity === "breaking") breaking += 1;
      else if (r.severity === "minor") minor += 1;
      if (r.changeType === "removed") removed += 1;
      if (r.replacement) withReplacement += 1;
    }
    return { breaking, minor, removed, withReplacement };
  }, [refs]);

  const VERSIONS = useMemo(() => focusedWindow(userVersion), [userVersion]);
  const userIdx = Math.max(0, VERSIONS.indexOf(userVersion));
  const progressPercent =
    VERSIONS.length > 1 ? `${(userIdx / (VERSIONS.length - 1)) * 100}%` : "0%";

  return (
    <>
      {/* (a) Bento stats */}
      <section className="px-margin py-lg">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-5 gap-gutter">
          <StatTile
            Icon={Film}
            value={totalAffected}
            label="Videos Affected"
            accent="text-primary"
            border="border-outline-variant"
            colSpan="col-span-2 md:col-span-1"
          />
          <StatTile
            Icon={AlertOctagon}
            value={counts.breaking}
            label="Breaking"
            accent="text-coral-accent"
            border="border-coral-accent/30"
            glow="glow-coral"
          />
          <StatTile
            Icon={AlertTriangle}
            value={counts.minor}
            label="Minor"
            accent="text-amber-accent"
            border="border-amber-accent/30"
            glow="glow-amber"
          />
          <StatTile
            Icon={Trash2}
            value={counts.removed}
            label="Removed"
            accent="text-on-surface-variant"
            border="border-outline-variant"
          />
          <StatTile
            Icon={RefreshCw}
            value={counts.withReplacement}
            label="Replacement"
            accent="text-emerald-accent"
            border="border-emerald-accent/30"
          />
        </div>
      </section>

      {/* (b) Trajectory */}
      <section className="px-margin py-lg border-y border-outline-variant bg-surface-container-low">
        <div className="mx-auto max-w-4xl">
          <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-lg uppercase tracking-widest">
            Version Trajectory
          </h4>
          <div className="relative flex items-center justify-between">
            <div className="absolute h-1 w-full bg-outline-variant z-0 top-1/2 -translate-y-1/2" />
            <div
              className="absolute h-1 bg-primary z-10 top-1/2 -translate-y-1/2 transition-all motion-reduce:transition-none"
              style={{ width: progressPercent }}
            />
            {VERSIONS.map((v) => {
              const isCurrent = v === userVersion;
              const isPast = VERSIONS.indexOf(v) < userIdx;
              return (
                <div
                  key={v}
                  className="relative z-20 flex flex-col items-center gap-xs"
                >
                  {isCurrent ? (
                    <div className="w-6 h-6 bg-background border-2 border-primary rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-primary rounded-full animate-pulse motion-reduce:animate-none shadow-[0_0_10px_#c5c6ce]" />
                    </div>
                  ) : (
                    <div
                      className={`w-4 h-4 rounded-full ${
                        isPast
                          ? "bg-primary ring-4 ring-primary/20"
                          : "bg-outline-variant"
                      }`}
                    />
                  )}
                  <span
                    className={`font-label-caps text-label-caps mt-base ${
                      isCurrent
                        ? "text-on-surface font-bold"
                        : isPast
                          ? "text-primary"
                          : "text-on-surface-variant opacity-50"
                    }`}
                  >
                    {isCurrent ? `${v} [CURRENT]` : v}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
