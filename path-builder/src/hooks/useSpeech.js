/**
 * useSpeech — thin wrapper around Web Speech API `window.speechSynthesis`.
 *
 * Module-level singleton ensures only ONE utterance plays globally across the
 * whole app — calling speak() from any component cancels any prior utterance
 * first. All subscribers share the same "state" so buttons reflect the
 * currently-speaking block correctly.
 *
 * Returns { speak, pause, resume, cancel, state, currentId }
 *   state ∈ "idle" | "speaking" | "paused" | "unsupported"
 *   currentId — optional string caller passed to speak(); null when idle.
 *
 * Callers typically pass a stable id (e.g. message.id) so they can tell
 * whether *their* block is the active one: `state === "speaking" && currentId === myId`.
 *
 * Fails silently if speechSynthesis is unavailable (state stays "unsupported").
 */
import { useCallback, useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────────────
// Module-level singleton — one utterance globally.
// ──────────────────────────────────────────────────────────────────────
const listeners = new Set();

let moduleState = isSupported() ? "idle" : "unsupported";
let currentId = null;
let currentUtterance = null;

function isSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

function notify() {
  for (const fn of listeners) {
    try {
      fn({ state: moduleState, currentId });
    } catch {
      // ignore listener errors
    }
  }
}

function setState(next, id = null) {
  moduleState = next;
  currentId = id;
  notify();
}

function doSpeak(text, id = null, opts = {}) {
  if (!isSupported() || !text || typeof text !== "string") return false;
  const synth = window.speechSynthesis;
  // Cancel any existing utterance first — one voice globally.
  try {
    synth.cancel();
  } catch {
    // ignore
  }
  const utter = new window.SpeechSynthesisUtterance(text);
  if (typeof opts.rate === "number") utter.rate = opts.rate;
  if (typeof opts.pitch === "number") utter.pitch = opts.pitch;
  if (typeof opts.lang === "string") utter.lang = opts.lang;

  utter.onstart = () => setState("speaking", id);
  utter.onresume = () => setState("speaking", id);
  utter.onpause = () => setState("paused", id);
  utter.onend = () => {
    if (currentUtterance === utter) {
      currentUtterance = null;
      setState("idle", null);
    }
  };
  utter.onerror = () => {
    if (currentUtterance === utter) {
      currentUtterance = null;
      setState("idle", null);
    }
  };

  currentUtterance = utter;
  // Optimistically set speaking — some browsers delay onstart.
  setState("speaking", id);
  try {
    synth.speak(utter);
  } catch {
    currentUtterance = null;
    setState("idle", null);
    return false;
  }
  return true;
}

function doPause() {
  if (!isSupported()) return;
  try {
    window.speechSynthesis.pause();
    setState("paused", currentId);
  } catch {
    // ignore
  }
}

function doResume() {
  if (!isSupported()) return;
  try {
    window.speechSynthesis.resume();
    setState("speaking", currentId);
  } catch {
    // ignore
  }
}

function doCancel() {
  if (!isSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
  currentUtterance = null;
  setState("idle", null);
}

// ──────────────────────────────────────────────────────────────────────
// React hook — subscribes to the singleton state.
// ──────────────────────────────────────────────────────────────────────
export default function useSpeech() {
  const [snap, setSnap] = useState({ state: moduleState, currentId });

  useEffect(() => {
    const fn = (next) => setSnap(next);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const speak = useCallback((text, id = null, opts = {}) => doSpeak(text, id, opts), []);
  const pause = useCallback(() => doPause(), []);
  const resume = useCallback(() => doResume(), []);
  const cancel = useCallback(() => doCancel(), []);

  return {
    speak,
    pause,
    resume,
    cancel,
    state: snap.state,
    currentId: snap.currentId,
    supported: snap.state !== "unsupported",
  };
}

// Exported for tests — allows resetting between specs.
export function __resetSpeechForTests() {
  listeners.clear();
  currentUtterance = null;
  moduleState = isSupported() ? "idle" : "unsupported";
  currentId = null;
}
