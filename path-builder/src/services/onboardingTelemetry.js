/**
 * onboardingTelemetry.js — Client-side logger for onboarding RAG pipeline events.
 *
 * Calls the `logTelemetry` Cloud Function (server-side) which writes to
 * Firestore `apiUsage` using admin privileges. Direct client-side writes
 * are blocked by Firestore security rules.
 */
import { getFirebaseApp } from "./firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import { devLog, devWarn } from "../utils/logger";

/**
 * Log an onboarding RAG pipeline event via Cloud Function.
 * Fails silently — telemetry should never crash the app.
 *
 * @param {Object} data
 * @param {"rag_success"|"rag_fallback"|"enrichment"} data.outcome
 * @param {string}  [data.archetype]       - Detected user archetype
 * @param {number}  [data.passagesFound]   - Passages retrieved from search
 * @param {number}  [data.modulesReturned] - Modules from assembler
 * @param {number}  [data.modulesEnriched] - Modules matched to real courses
 * @param {number}  [data.modulesTotal]    - Total modules attempted to enrich
 * @param {number}  [data.searchQueries]   - Number of planner search queries
 * @param {number}  [data.pipelineDurationMs] - Total pipeline time
 * @param {string}  [data.errorMessage]    - Error text (fallback only)
 */
export async function logOnboardingRAG(data) {
  try {
    const app = getFirebaseApp();
    const functions = getFunctions(app);
    const logTelemetry = httpsCallable(functions, "logTelemetry");

    await logTelemetry({
      type: "onboarding_rag",
      ...data,
    });

    devLog("[OnboardingTelemetry] Logged:", data.outcome, data);
  } catch (err) {
    // Fail silently — telemetry is non-critical
    devWarn("[OnboardingTelemetry] Failed to log:", err.message);
  }
}
