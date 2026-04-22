/**
 * useLesson — Fetches or generates a composed lesson payload.
 *
 * Two entry paths:
 *   - generate({ query, sessionId, engine }) — calls the `generateLesson` callable.
 *   - loadById(lessonId) — reads users/{uid}/lessons/{lessonId} from Firestore.
 *
 * Returns { lesson, lessonId, sessionId, loading, error, generate, loadById, reset }.
 */
import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, getDoc } from "firebase/firestore";

import { getFirebaseApp } from "../services/firebaseConfig";
import { getCurrentUser } from "../services/googleAuthService";
import { devLog, devWarn } from "../utils/logger";

export default function useLesson() {
  const [lesson, setLesson] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async ({ query, sessionId: sid, engine } = {}) => {
    if (!query || typeof query !== "string") {
      const msg = "Missing query";
      setError(msg);
      return { ok: false, error: msg };
    }

    setLoading(true);
    setError(null);
    try {
      const app = getFirebaseApp();
      const functions = getFunctions(app, "us-central1");
      const callable = httpsCallable(functions, "generateLesson");
      const payload = { query };
      if (sid) payload.sessionId = sid;
      if (engine) payload.engine = engine;

      const result = await callable(payload);
      const data = result?.data || {};
      if (!data.success || !data.lesson) {
        const msg = data.error || "Lesson generation failed";
        setError(msg);
        return { ok: false, error: msg };
      }
      devLog(`[useLesson] Generated lesson ${data.lessonId}`);
      setLesson(data.lesson);
      setLessonId(data.lessonId || null);
      setSessionId(data.sessionId || sid || null);
      return { ok: true, lessonId: data.lessonId, lesson: data.lesson };
    } catch (err) {
      const msg = err?.message || "Failed to generate lesson";
      devWarn("[useLesson] generate failed:", msg);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const loadById = useCallback(async (id) => {
    if (!id) {
      const msg = "Missing lessonId";
      setError(msg);
      return { ok: false, error: msg };
    }
    const user = getCurrentUser();
    if (!user?.uid) {
      const msg = "Not signed in";
      setError(msg);
      return { ok: false, error: msg };
    }

    setLoading(true);
    setError(null);
    try {
      const app = getFirebaseApp();
      const db = getFirestore(app);
      const ref = doc(db, "users", user.uid, "lessons", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const msg = "Lesson not found";
        setError(msg);
        return { ok: false, error: msg };
      }
      const data = snap.data() || {};
      // Documents may be stored either as the raw lesson shape or wrapped.
      const lessonPayload = data.lesson ? data.lesson : data;
      setLesson(lessonPayload);
      setLessonId(id);
      if (data.sessionId) setSessionId(data.sessionId);
      return { ok: true, lessonId: id, lesson: lessonPayload };
    } catch (err) {
      const msg = err?.message || "Failed to load lesson";
      devWarn("[useLesson] loadById failed:", msg);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLesson(null);
    setLessonId(null);
    setSessionId(null);
    setError(null);
    setLoading(false);
  }, []);

  return { lesson, lessonId, sessionId, loading, error, generate, loadById, reset };
}
