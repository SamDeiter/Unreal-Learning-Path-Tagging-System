/**
 * Input Sanitization & Security Guardrails
 *
 * Three layers of defense for all Gemini API calls:
 * 1. Length + character validation
 * 2. Prompt injection detection
 * 3. Content policy (inappropriate topics)
 */

// --- Layer 1: Input sanitization ---

/**
 * Sanitize raw user input before passing to Gemini.
 * @param {string} rawInput - The raw user query
 * @param {number} maxLength - Maximum allowed length (default 500)
 * @returns {string} Cleaned input
 */
function sanitizeQuery(rawInput, maxLength = 500) {
  if (typeof rawInput !== "string") {
    throw new Error("Invalid input: expected string");
  }

  let clean = rawInput.slice(0, maxLength).trim();

  // Strip HTML tags and template injection chars
  clean = clean.replace(/<[^>]*>/g, "");
  clean = clean.replace(/[{}]/g, "");

  // Collapse whitespace
  clean = clean.replace(/\s+/g, " ");

  // Remove null bytes and control characters (except newlines)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return clean;
}

// --- Layer 2: Prompt injection detection ---

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all|prior)\s+(instructions?|prompts?|rules?|context)/i,
  /disregard\s+(previous|above|all|prior)\s+(instructions?|prompts?)/i,
  /you\s+are\s+now\s+/i,
  /new\s+role\s*:/i,
  /system\s*:\s*/i,
  /\bact\s+as\b/i,
  /\brole\s*:\s*/i,
  /\bforget\s+(everything|your|all|prior)/i,
  /\bpretend\s+(you|to|that)/i,
  /\bnew\s+instructions?\b/i,
  /\bdo\s+not\s+follow\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\boverride\b.*\b(system|safety|filter)/i,
  /\brepeat\s+(back|after|the\s+following)/i,
  /\btranslate\s+.{0,20}\s+to\s+(python|javascript|code|bash|sql)/i,
  /\bprint\s+(your|the|system)\s+(prompt|instructions)/i,
  /\bwhat\s+(are|is)\s+your\s+(instructions|prompt|system)/i,
];

/**
 * Detect prompt injection attempts.
 * @param {string} query - Sanitized user input
 * @returns {boolean} True if injection detected
 */
function detectInjection(query) {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(query));
}

// --- Layer 3: Content policy ---

const BLOCKED_CONTENT_PATTERNS = [
  /\b(porn|xxx|nsfw|nude|naked|sex(ual)?)\b/i,
  /\b(hack(ing)?|exploit(ation)?|crack(ing)?|keygen)\b/i,
  /\b(weapon|bomb|explosive|drug(s)?|narcotic)\b/i,
  /\b(kill|murder|suicide|self[- ]?harm)\b/i,
  /\b(racist|nazi|supremac)/i,
  /\b(pirat(e|ing|ed)|torrent|warez)\b/i,
];

/**
 * Check if content violates policy.
 * @param {string} query - Sanitized user input
 * @returns {boolean} True if inappropriate content detected
 */
function isInappropriate(query) {
  return BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(query));
}

// --- Main entry point ---

/**
 * Validate and sanitize user input. Call this before any Gemini API call.
 *
 * @param {string} rawInput - Raw user query
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ clean: string, blocked: boolean, reason: string|null }}
 */
function sanitizeAndValidate(rawInput, maxLength = 500) {
  // Type check
  if (!rawInput || typeof rawInput !== "string") {
    return {
      clean: "",
      blocked: true,
      reason: "Please enter a valid question about Unreal Engine 5.",
    };
  }

  const clean = sanitizeQuery(rawInput, maxLength);

  // Empty after sanitization
  if (clean.length < 3) {
    return {
      clean: "",
      blocked: true,
      reason: "Your question is too short. Please describe your UE5 problem in more detail.",
    };
  }

  // Prompt injection check
  if (detectInjection(clean)) {
    console.warn(`[SECURITY] Prompt injection detected: "${clean.substring(0, 80)}..."`);
    return {
      clean: "",
      blocked: true,
      reason: "This query could not be processed. Please ask a question about Unreal Engine 5.",
    };
  }

  // Content policy check
  if (isInappropriate(clean)) {
    console.warn(`[SECURITY] Inappropriate content blocked: "${clean.substring(0, 80)}..."`);
    return {
      clean: "",
      blocked: true,
      reason:
        "This query contains inappropriate content. Please ask a question about Unreal Engine 5.",
    };
  }

  return { clean, blocked: false, reason: null };
}

module.exports = {
  sanitizeQuery,
  detectInjection,
  isInappropriate,
  sanitizeAndValidate,
};
