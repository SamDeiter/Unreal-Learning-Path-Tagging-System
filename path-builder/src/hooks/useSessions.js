/**
 * useSessions — Live list of the signed-in user's saved Problem-First / Goal sessions.
 *
 * Reads users/{uid}/sessions ordered by updatedAt DESC, limit 20, via onSnapshot
 * so resumable sessions appear the instant the backend persists them.
 *
 * Returns: { sessions, loading, error, refetch }
 *   sessions: Array<{ id, uid, mode, query, conversationHistory, result, createdAt, updatedAt }>
 *   refetch:  () => void   // forces a one-shot getDocs to bypass snapshot cache (rare)
 */
import { useState, useEffect, useCallback } from "react";
import {
  getFirestore,
  collection,
  query as fsQuery,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";

import { getFirebaseApp } from "../services/firebaseConfig";
import { onAuthChange } from "../services/googleAuthService";
import { devWarn } from "../utils/logger";

const MAX_SESSIONS = 20;

function normalize(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    uid: data.uid || null,
    mode: data.mode || "problem-first",
    query: data.query || "",
    conversationHistory: Array.isArray(data.conversationHistory) ? data.conversationHistory : [],
    result: data.result || null,
    createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? null,
    updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? null,
  };
}

export default function useSessions() {
  const [uid, setUid] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setUid(user?.uid || null);
      if (!user) {
        setSessions([]);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return undefined;

    let unsub = () => {};
    try {
      const db = getFirestore(getFirebaseApp());
      const q = fsQuery(
        collection(db, "users", uid, "sessions"),
        orderBy("updatedAt", "desc"),
        limit(MAX_SESSIONS)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          setSessions(snap.docs.map(normalize));
          setError(null);
          setLoading(false);
        },
        (err) => {
          devWarn("[useSessions] snapshot error:", err.message);
          setError(err);
          setLoading(false);
        }
      );
    } catch (err) {
      devWarn("[useSessions] init error:", err.message);
      queueMicrotask(() => {
        setError(err);
        setLoading(false);
      });
    }
    return () => unsub();
  }, [uid, refetchTick]);

  const refetch = useCallback(async () => {
    if (!uid) return;
    try {
      const db = getFirestore(getFirebaseApp());
      const q = fsQuery(
        collection(db, "users", uid, "sessions"),
        orderBy("updatedAt", "desc"),
        limit(MAX_SESSIONS)
      );
      const snap = await getDocs(q);
      setSessions(snap.docs.map(normalize));
      setRefetchTick((n) => n + 1);
    } catch (err) {
      devWarn("[useSessions] refetch error:", err.message);
      setError(err);
    }
  }, [uid]);

  return { sessions, loading, error, refetch };
}
