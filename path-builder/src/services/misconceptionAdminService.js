import {
  getFirestore,
  collection,
  query as fsQuery,
  orderBy,
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devWarn } from "../utils/logger";

export async function listMisconceptions({ max = 200 } = {}) {
  try {
    const db = getFirestore(getFirebaseApp());
    const ref = collection(db, "misconceptions");
    const q = fsQuery(ref, orderBy("signalCount", "desc"), fsLimit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    devWarn("[MisconceptionAdmin] list failed:", err.message);
    return [];
  }
}

export async function listRecentSignals({ max = 100 } = {}) {
  try {
    const db = getFirestore(getFirebaseApp());
    const ref = collection(db, "misconceptionSignals");
    const q = fsQuery(ref, orderBy("createdAt", "desc"), fsLimit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    devWarn("[MisconceptionAdmin] signal list failed:", err.message);
    return [];
  }
}

export async function runMining({ maxSignals, minGroupSize, tags } = {}) {
  const functions = getFunctions(getFirebaseApp());
  const callable = httpsCallable(functions, "mineMisconceptions");
  const payload = {};
  if (Number.isFinite(maxSignals)) payload.maxSignals = maxSignals;
  if (Number.isFinite(minGroupSize)) payload.minGroupSize = minGroupSize;
  if (Array.isArray(tags) && tags.length) payload.tags = tags;
  const res = await callable(payload);
  return res.data;
}
