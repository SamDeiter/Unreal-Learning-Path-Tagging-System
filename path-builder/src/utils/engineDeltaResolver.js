/**
 * engineDeltaResolver — sync, client-side delta resolver.
 *
 * Reads the precomputed bundle at path-builder/src/data/engine_ref_mentions_bundle.json
 * (built by scripts/build_engine_ref_mention_bundle.py) and returns the deltas
 * that apply to a given (videoCode | videoTitle, videoVersion, userVersion).
 *
 * Replaces the live-Firestore lookup for v1. Faster and avoids the codeless-step
 * problem in the V1 path renderer (steps strip out videoIds and only carry titles).
 */
import bundle from "../data/engine_ref_mentions_bundle.json";

/** Compare semantic version strings like "5.6" / "5.7". Returns -1/0/1. */
function cmpVersion(a, b) {
  const pa = String(a || "").split(".").map(Number);
  const pb = String(b || "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function changeApplies(change, videoVersion, userVersion) {
  if (!change?.to) return false;
  if (cmpVersion(userVersion, change.to) < 0) return false;
  if (videoVersion && cmpVersion(videoVersion, change.to) >= 0) return false;
  return true;
}

/** Resolve a videoCode from either a code, a title, or both. */
function resolveCode(videoCode, videoTitle) {
  if (videoCode && bundle.byVideoId?.[videoCode]) return videoCode;
  if (videoTitle && bundle.byVideoTitle?.[videoTitle]) {
    return bundle.byVideoTitle[videoTitle];
  }
  return videoCode || null; // may be unresolvable; caller handles []
}

/**
 * @returns {Array<{
 *   mentionId, refId, canonicalName, kind, area,
 *   changeType, severity, summary, replacement,
 *   fromVersion, toVersion, sourceUrl, timestampSec, snippet
 * }>}
 */
export function resolveEngineDeltas({ videoCode, videoTitle, videoVersion, userVersion }) {
  if (!userVersion) return [];
  const code = resolveCode(videoCode, videoTitle);
  if (!code) return [];

  const mentions = bundle.byVideoId?.[code] || [];
  if (mentions.length === 0) return [];

  // Apply same gate the Firestore hook used: if we know the video version,
  // skip when the user is on the same or older version.
  if (videoVersion && cmpVersion(userVersion, videoVersion) <= 0) return [];

  const out = [];
  for (const m of mentions) {
    const ref = bundle.refs?.[m.refId];
    if (!ref) continue;
    if (ref.status !== "verified") continue;
    const change = (ref.changeLog || []).find((c) =>
      changeApplies(c, videoVersion, userVersion),
    );
    if (!change) continue;
    const replacement = ref.versions?.[change.to]?.replacement || null;
    out.push({
      mentionId: m.mentionId,
      refId: m.refId,
      canonicalName: ref.canonicalName,
      kind: ref.kind,
      area: ref.area || null,
      changeType: change.changeType || "deprecated",
      severity: change.severity || "minor",
      summary: change.summary || "",
      replacement,
      fromVersion: change.from,
      toVersion: change.to,
      sourceUrl: change.source?.url || null,
      timestampSec: m.timestampSec ?? null,
      snippet: m.snippet || "",
    });
  }
  out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "breaking" ? -1 : 1;
    return (a.timestampSec ?? 0) - (b.timestampSec ?? 0);
  });
  return out;
}
