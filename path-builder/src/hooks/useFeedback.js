/**
 * useFeedback — Thin hook that calls the `submitFeedback` callable.
 *
 * @returns {{
 *   submit: (args: { sessionId: string, signal: string, tagsTouched?: string[], comment?: string }) => Promise<{ok: boolean, feedbackId?: string, error?: string}>,
 *   loading: boolean,
 *   error: string|null,
 *   lastSignal: Record<string, string>,
 * }}
 */
import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

import { getFirebaseApp } from "../services/firebaseConfig";
import { devLog, devWarn } from "../utils/logger";

export default function useFeedback() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSignal, setLastSignal] = useState({});

  const submit = useCallback(async ({ sessionId, signal, tagsTouched, comment }) => {
    if (!sessionId || !signal) {
      const msg = "Missing sessionId or signal";
      setError(msg);
      return { ok: false, error: msg };
    }

    setLoading(true);
    setError(null);
    try {
      const app = getFirebaseApp();
      const functions = getFunctions(app, "us-central1");
      const submitFeedback = httpsCallable(functions, "submitFeedback");
      const payload = { sessionId, signal };
      if (Array.isArray(tagsTouched) && tagsTouched.length) payload.tagsTouched = tagsTouched;
      if (comment) payload.comment = comment;

      const result = await submitFeedback(payload);
      const feedbackId = result?.data?.feedbackId;
      devLog(`[Feedback] Recorded ${signal} for ${sessionId} (${feedbackId})`);
      setLastSignal((prev) => ({ ...prev, [sessionId]: signal }));
      return { ok: true, feedbackId };
    } catch (err) {
      const msg = err?.message || "Failed to submit feedback";
      devWarn("[Feedback] submit failed:", msg);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error, lastSignal };
}
