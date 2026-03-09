/**
 * voiceCloneService.js — Voice Cloning API Client
 *
 * Manages voice profile creation and text-to-speech generation
 * using ElevenLabs API. Instructor's existing audio samples
 * are used to create a voice clone for new generated content.
 *
 * NOTE: All API calls go through our Cloud Functions proxy
 * to keep the API key server-side. See /functions/voiceClone.
 */

// ── Constants ──────────────────────────────────────────────────────

const CLOUD_FUNCTION_BASE = "/api/voice-clone";
const MIN_SAMPLE_DURATION_SEC = 30;
const MAX_SAMPLES = 25;

// ── Voice Profile Management ───────────────────────────────────────

/**
 * Create a voice profile from instructor audio samples.
 *
 * @param {string} instructorId — Unique instructor identifier
 * @param {Array<Blob|File>} audioSamples — Audio files (WAV/MP3)
 * @param {Object} [opts] — Options
 * @param {string} [opts.name] — Display name for the voice
 * @param {string} [opts.description] — Voice description
 * @returns {Promise<{ voiceId: string, name: string, status: string }>}
 */
export async function createVoiceProfile(instructorId, audioSamples, opts = {}) {
  validateSamples(audioSamples);

  const formData = new FormData();
  formData.append("instructor_id", instructorId);
  formData.append("name", opts.name || `Instructor ${instructorId}`);
  formData.append("description", opts.description || "Auto-generated voice clone");

  audioSamples.slice(0, MAX_SAMPLES).forEach((sample, idx) => {
    formData.append(`sample_${idx}`, sample);
  });

  const response = await fetch(`${CLOUD_FUNCTION_BASE}/create-profile`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voice profile creation failed: ${err}`);
  }

  return response.json();
}

/**
 * Check the status of a voice profile.
 *
 * @param {string} voiceId — Voice profile ID
 * @returns {Promise<{ voiceId: string, status: string, readyAt: string|null }>}
 */
export async function getVoiceProfileStatus(voiceId) {
  const response = await fetch(`${CLOUD_FUNCTION_BASE}/status/${voiceId}`);
  if (!response.ok) throw new Error("Failed to check voice profile status");
  return response.json();
}

// ── Text-to-Speech Generation ──────────────────────────────────────

/**
 * Generate speech audio from text using a cloned voice.
 *
 * @param {string} voiceId — Cloned voice profile ID
 * @param {string} text — Text to convert to speech
 * @param {Object} [opts] — Options
 * @param {number} [opts.stability=0.5] — Voice stability (0-1)
 * @param {number} [opts.similarityBoost=0.75] — Similarity boost (0-1)
 * @param {string} [opts.outputFormat="mp3_44100_128"] — Audio format
 * @returns {Promise<Blob>} — Audio blob
 */
export async function generateSpeech(voiceId, text, opts = {}) {
  if (!voiceId) throw new Error("voiceId is required");
  if (!text?.trim()) throw new Error("text is required");

  const response = await fetch(`${CLOUD_FUNCTION_BASE}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: voiceId,
      text: text.trim(),
      stability: opts.stability ?? 0.5,
      similarity_boost: opts.similarityBoost ?? 0.75,
      output_format: opts.outputFormat || "mp3_44100_128",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Speech synthesis failed: ${err}`);
  }

  return response.blob();
}

/**
 * Generate narration for a study guide section.
 *
 * @param {string} voiceId — Cloned voice ID
 * @param {Array<{ heading: string, content: string }>} sections
 * @param {Function} [onProgress] — Progress callback (percent)
 * @returns {Promise<Array<{ heading: string, audioBlob: Blob }>>}
 */
export async function generateStudyGuideNarration(voiceId, sections, onProgress) {
  const results = [];

  for (let i = 0; i < sections.length; i++) {
    const { heading, content } = sections[i];
    const narrationText = `${heading}. ${content}`;

    const audioBlob = await generateSpeech(voiceId, narrationText);
    results.push({ heading, audioBlob });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / sections.length) * 100));
    }
  }

  return results;
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * @private — Validate audio samples meet minimum requirements.
 */
function validateSamples(samples) {
  if (!samples || samples.length === 0) {
    throw new Error("At least one audio sample is required");
  }
  if (samples.length > MAX_SAMPLES) {
    throw new Error(`Maximum ${MAX_SAMPLES} samples allowed`);
  }

  // Note: Duration validation happens server-side since we can't
  // easily check audio duration from a Blob in the browser.
  // MIN_SAMPLE_DURATION_SEC is enforced by the Cloud Function.
}

// ── Export Constants for Tests ──────────────────────────────────────

export const CONFIG = {
  CLOUD_FUNCTION_BASE,
  MIN_SAMPLE_DURATION_SEC,
  MAX_SAMPLES,
};
