/**
 * useEngineDeltas — Fetch verified version-deltas for a given video.
 *
 * For a video with `engineVersion` (e.g. "5.6") viewed by a user on a newer
 * UE version (e.g. "5.7"), returns the set of verified engineRefMentions that
 * resolve to changes between those two versions, joined with their parent
 * engineRef so we have canonicalName + changeLog for display.
 *
 * Only verified mentions (refStatus === "verified") are returned — drafts and
 * rejects are filtered server-side via Firestore rules and again here as a
 * defense-in-depth.
 *
 * Returns: { deltas, loading, error }
 *   deltas: Array<{
 *     mentionId, refId, canonicalName, kind, area,
 *     changeType, severity, summary, replacement,
 *     fromVersion, toVersion, sourceUrl,
 *     timestampSec, snippet
 *   }>
 */
import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query as fsQuery,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import { getFirebaseApp } from "../services/firebaseConfig";
import { devWarn } from "../utils/logger";

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

/**
 * Decide whether a changeLog entry is in scope for this learner.
 * A delta applies when the user's version is at-or-past the change's `to`,
 * AND (when known) the video predates the change. For docs / items with no
 * known engineVersion we still surface the change — if the user is on a
 * version where the change has landed, the deprecation is relevant.
 */
function changeApplies(change, videoVersion, userVersion) {
  if (!change?.to) return false;
  if (cmpVersion(userVersion, change.to) < 0) return false;
  if (videoVersion && cmpVersion(videoVersion, change.to) >= 0) return false;
  return true;
}

export function useEngineDeltas(videoCode, videoVersion, userVersion) {
  const [deltas, setDeltas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoCode || !userVersion) {
      setDeltas([]);
      return;
    }
    // videoVersion is allowed to be null for items we can't pin to a UE
    // release (docs, evergreen content). The change-applies check below
    // handles that — see changeApplies().
    if (videoVersion && cmpVersion(userVersion, videoVersion) <= 0) {
      // User is on the same or older version — no deltas to surface.
      setDeltas([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const app = getFirebaseApp();
        if (!app) {
          // E2E stub mode — no Firestore.
          setDeltas([]);
          return;
        }
        const db = getFirestore(app);

        // 1. Query mentions for this video. Rules require refStatus filter.
        const mentionsQ = fsQuery(
          collection(db, "engineRefMentions"),
          where("videoId", "==", videoCode),
          where("refStatus", "==", "verified"),
        );
        const mentionsSnap = await getDocs(mentionsQ);
        if (cancelled) return;
        const mentions = mentionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mentions.length === 0) {
          setDeltas([]);
          return;
        }

        // 2. Fetch parent engineRefs in parallel (deduped by refId).
        const uniqueRefIds = [...new Set(mentions.map((m) => m.refId))];
        const refSnaps = await Promise.all(
          uniqueRefIds.map((rid) => getDoc(doc(db, "engineRefs", rid))),
        );
        if (cancelled) return;
        const refsById = {};
        for (const snap of refSnaps) {
          if (snap.exists()) refsById[snap.id] = snap.data();
        }

        // 3. Join + filter to applicable changes for the user's version.
        const out = [];
        for (const m of mentions) {
          const ref = refsById[m.refId];
          if (!ref) continue;
          if (ref.status !== "verified") continue; // defense-in-depth
          const change = (ref.changeLog || []).find((c) =>
            changeApplies(c, videoVersion, userVersion),
          );
          if (!change) continue;
          const replacement = ref.versions?.[change.to]?.replacement || null;
          out.push({
            mentionId: m.id,
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
        // Sort: breaking first, then by timestamp.
        out.sort((a, b) => {
          if (a.severity !== b.severity) return a.severity === "breaking" ? -1 : 1;
          return (a.timestampSec ?? 0) - (b.timestampSec ?? 0);
        });
        setDeltas(out);
      } catch (e) {
        devWarn?.("useEngineDeltas error:", e);
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoCode, videoVersion, userVersion]);

  return { deltas, loading, error };
}
