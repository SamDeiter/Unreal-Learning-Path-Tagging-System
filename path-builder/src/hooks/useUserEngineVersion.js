/**
 * useUserEngineVersion — the learner's installed UE version.
 *
 * Persists to localStorage under "ueVersion". Defaults to "5.7" (current
 * team-standard per project memory). Used by EngineDeltaChip to decide
 * which version-deltas apply.
 *
 * Returns: [version: string, setVersion: (next: string) => void]
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ueVersion";
const DEFAULT_VERSION = "5.7";

function readInitial() {
  if (typeof window === "undefined") return DEFAULT_VERSION;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

export function useUserEngineVersion() {
  const [version, setVersionState] = useState(readInitial);

  // Sync across tabs / external writes.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) setVersionState(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setVersion = useCallback((next) => {
    setVersionState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch { /* quota or private mode */ }
  }, []);

  return [version, setVersion];
}
