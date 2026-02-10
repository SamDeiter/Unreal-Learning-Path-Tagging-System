/**
 * Dev-only logger — silences console output in production builds.
 * Drop-in replacement for console.log/warn/error.
 *
 * Usage: import { devLog, devWarn, devError } from "../utils/logger";
 */
export const devLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

export const devWarn = (...args) => {
  if (import.meta.env.DEV) console.warn(...args);
};

export const devError = (...args) => {
  // Errors always log — they indicate real problems
  console.error(...args);
};
