/**
 * Security Guardrails for Bespoke Learning Paths
 *
 * Guard 1: Input Sanitization — strip HTML, limit length, block injection
 * Guard 2: Rate Limiting — 20 paths per session, 3s cooldown
 * Guard 3: XSS Prevention — sanitize AI output before rendering
 */

const MAX_QUERY_LENGTH = 500;
const MAX_PATHS_PER_SESSION = 20;
const SESSION_COUNTER_KEY = "bespoke_session_count";
const COOLDOWN_MS = 3000;

let lastQueryTime = 0;

// ── Guard 1: Input Sanitization ────────────────────────

/**
 * Strip HTML tags, script injections, and markdown formatting.
 * Returns clean, safe text.
 */
function stripDangerous(input) {
  return (
    input
      // Remove HTML/XML tags
      .replace(/<[^>]*>/g, "")
      // Remove script: protocol
      .replace(/javascript:/gi, "")
      // Remove on* event handlers
      .replace(/\bon\w+\s*=/gi, "")
      // Remove markdown code blocks that might hide injection
      .replace(/```[\s\S]*?```/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Sanitize and validate user input.
 * Returns { valid, sanitized, error }.
 */
export function sanitizeQuery(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return { valid: false, sanitized: "", error: "Please enter a question." };
  }

  // Length check
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return { valid: false, sanitized: "", error: "Please enter a question." };
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      valid: false,
      sanitized: "",
      error: `Question is too long (${trimmed.length}/${MAX_QUERY_LENGTH} characters). Please shorten it.`,
    };
  }

  // Minimum word check (too vague)
  const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) {
    return {
      valid: false,
      sanitized: "",
      error: "Can you be more specific? Try something like: 'Why is my Lumen lighting flickering?'",
    };
  }

  // Strip dangerous content
  const sanitized = stripDangerous(trimmed);

  // If stripping removed most content, it was likely injection
  if (sanitized.length < trimmed.length * 0.5) {
    console.warn("[BESPOKE] safety_filter reason=suspicious_content");
    return {
      valid: false,
      sanitized: "",
      error: "We couldn't process that question. Please rephrase it.",
    };
  }

  return { valid: true, sanitized, error: null };
}

// ── Guard 2: Rate Limiting ─────────────────────────────

/**
 * Check if user is within rate limits.
 * Returns { allowed, error, remaining }.
 */
export function checkRateLimit() {
  // Cooldown check
  const now = Date.now();
  if (now - lastQueryTime < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - lastQueryTime)) / 1000);
    return {
      allowed: false,
      error: `Please wait ${waitSec}s before searching again.`,
      remaining: getRemaining(),
    };
  }

  // Session counter
  const count = getSessionCount();
  if (count >= MAX_PATHS_PER_SESSION) {
    console.warn(`[BESPOKE] rate_limit queries=${count}`);
    return {
      allowed: false,
      error:
        "You've explored a lot today! Take some time to review your learning paths, and come back when you're ready for more.",
      remaining: 0,
    };
  }

  return { allowed: true, error: null, remaining: MAX_PATHS_PER_SESSION - count };
}

/**
 * Record a query for rate limiting purposes.
 */
export function recordQuery() {
  lastQueryTime = Date.now();
  const count = getSessionCount();
  try {
    sessionStorage.setItem(SESSION_COUNTER_KEY, String(count + 1));
  } catch {
    // sessionStorage unavailable
  }
}

function getSessionCount() {
  try {
    return parseInt(sessionStorage.getItem(SESSION_COUNTER_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function getRemaining() {
  return Math.max(0, MAX_PATHS_PER_SESSION - getSessionCount());
}

// ── Guard 3: Output Sanitization ───────────────────────

/**
 * Sanitize AI-generated text before rendering.
 * React already escapes JSX output, but this adds an extra layer
 * for any text used in attributes or non-JSX contexts.
 */
export function sanitizeOutput(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize AI-generated narration text.
 * Less aggressive than sanitizeOutput — preserves basic formatting
 * but removes script injections.
 */
export function sanitizeNarration(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .trim();
}

// ── Exports for admin ──────────────────────────────────

export function getRateLimitStats() {
  return {
    sessionCount: getSessionCount(),
    remaining: getRemaining(),
    maxPerSession: MAX_PATHS_PER_SESSION,
    cooldownMs: COOLDOWN_MS,
    maxQueryLength: MAX_QUERY_LENGTH,
  };
}
