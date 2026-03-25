/**
 * retryWithBackoff — Exponential backoff retry wrapper for Cloud Function calls.
 *
 * Only retries on transient errors (429, 503, resource-exhausted, unavailable,
 * network failures). Non-retryable errors are thrown immediately.
 *
 * @param {Function} fn     — Async function to execute (should return a Promise)
 * @param {Object}  [opts]  — Configuration options
 * @param {number}  [opts.maxRetries=3]   — Maximum retry attempts
 * @param {number}  [opts.baseDelayMs=1000] — Initial delay before first retry
 * @param {string}  [opts.label='']       — Label for debug logging
 * @returns {Promise<*>} — Result of the function call
 */
export async function retryWithBackoff(fn, opts = {}) {
  const { maxRetries = 3, baseDelayMs = 1000, label = "" } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryableError(error) || isLastAttempt) {
        throw error;
      }

      // Exponential backoff with jitter: base * 2^attempt * (0.5 – 1.5)
      const jitter = 0.5 + Math.random();
      const delay = baseDelayMs * Math.pow(2, attempt) * jitter;

      if (label) {
        console.warn(
          `[retryWithBackoff] ${label} attempt ${attempt + 1}/${maxRetries} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`
        );
      }

      await sleep(delay);
    }
  }
}

/**
 * Determines if an error is transient and worth retrying.
 *
 * Retries on:
 * - HTTP 429 (Too Many Requests)
 * - HTTP 503 (Service Unavailable)
 * - Firebase "resource-exhausted" error code
 * - Firebase "unavailable" error code
 * - Network / fetch failures
 */
export function isRetryableError(error) {
  // Firebase Cloud Function error codes
  const retryableCodes = ["resource-exhausted", "unavailable", "deadline-exceeded"];
  if (error?.code && retryableCodes.includes(error.code)) return true;

  // Firebase httpsCallable wraps the code in error.code as a string like
  // "functions/resource-exhausted"
  if (typeof error?.code === "string" && retryableCodes.some((c) => error.code.includes(c)))
    return true;

  // HTTP status codes embedded in error messages
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("429") || msg.includes("503") || msg.includes("too many requests")) return true;
  if (msg.includes("rate limit")) return true;

  // Network failures (exclude App Check fetch-status-error as it is usually a config/403 issue)
  if (msg.includes("appcheck") && msg.includes("fetch-status")) return false;
  
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnreset")) return true;
  if (error?.name === "TypeError" && msg.includes("failed to fetch")) return true;

  return false;
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
