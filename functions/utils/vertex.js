/**
 * vertex.js — shared Vertex AI client for Gemini calls.
 *
 * Wraps Vertex AI's REST endpoints with ADC auth so every Gemini call in the
 * codebase routes through the Epic GCP project (development-317819) instead of
 * a personal AI Studio API key.
 *
 * The response shape is preserved from the previous generativelanguage.googleapis.com
 * endpoints (candidates[0].content.parts[0].text, embedding.values, usageMetadata),
 * so call sites only swap the URL+auth — they don't need to reshape downstream
 * parsing.
 *
 * Auth: ADC. Locally that's `gcloud auth application-default login`; in Cloud
 * Functions it's the runtime service account, which has roles/aiplatform.user
 * granted on development-317819.
 */

const { GoogleAuth } = require("google-auth-library");

const PROJECT_ID = process.env.VERTEX_PROJECT_ID || "development-317819";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const API_HOST = `https://${LOCATION}-aiplatform.googleapis.com`;

let _auth = null;
function getAuth() {
  if (!_auth) {
    _auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return _auth;
}

let _tokenCache = { token: null, expiresAt: 0 };
async function getAccessToken() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt - 30_000) {
    return _tokenCache.token;
  }
  const client = await getAuth().getClient();
  const res = await client.getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) throw new Error("Failed to obtain ADC access token");
  _tokenCache = { token, expiresAt: now + 55 * 60 * 1000 };
  return token;
}

function modelPath(model) {
  return `${API_HOST}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}`;
}

async function vertexFetch(url, body, { signal } = {}) {
  const token = await getAccessToken();
  const fetchFn =
    typeof fetch === "function"
      ? fetch
      : (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const resp = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  return resp;
}

/**
 * Call generateContent on a Gemini model via Vertex AI.
 *
 * @param {string} model              e.g. "gemini-2.0-flash", "gemini-2.5-flash"
 * @param {object} body               Request body (contents, generationConfig, tools, systemInstruction)
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal] Abort signal
 * @returns {Promise<Response>}       Raw fetch Response — caller handles .ok / .json()
 *                                    (preserved to keep call-site error handling identical)
 */
async function generateContent(model, body, opts = {}) {
  return vertexFetch(`${modelPath(model)}:generateContent`, body, opts);
}

/**
 * Embed text via Vertex AI's :predict endpoint.
 *
 * Vertex doesn't expose `:embedContent` for `gemini-embedding-001` — embeddings
 * go through `:predict` with a different request/response shape than the AI
 * Studio API. This helper accepts the AI-Studio-shaped legacy body
 * (`{ content: { parts: [{text}] }, taskType, outputDimensionality }`) for
 * call-site compatibility, transforms it into the predict shape, calls the
 * API, and returns a Response-like object whose `.json()` resolves to the
 * legacy shape `{ embedding: { values: [...] } }`. So existing callers don't
 * need to reshape parsing.
 *
 * @param {string} model  e.g. "gemini-embedding-001"
 * @param {object} body   AI-Studio-shaped embedding body
 * @param {object} [opts]
 * @returns {Promise<{ok: boolean, status?: number, json: () => Promise<object>, text: () => Promise<string>}>}
 */
async function embedContent(model, body, opts = {}) {
  const text = body?.content?.parts?.[0]?.text || "";
  const predictBody = {
    instances: [
      {
        task_type: body?.taskType || "RETRIEVAL_QUERY",
        content: text,
      },
    ],
    parameters: {
      ...(body?.outputDimensionality
        ? { outputDimensionality: body.outputDimensionality }
        : {}),
    },
  };
  const resp = await vertexFetch(`${modelPath(model)}:predict`, predictBody, opts);
  if (!resp.ok) {
    return resp;
  }
  const raw = await resp.json();
  const values = raw?.predictions?.[0]?.embeddings?.values;
  // Return a Response-like wrapper so call sites can keep using
  // `await result.json()` and expect `{ embedding: { values } }`.
  return {
    ok: true,
    status: 200,
    json: async () => ({ embedding: { values } }),
    text: async () => JSON.stringify(raw),
  };
}

module.exports = {
  generateContent,
  embedContent,
  getAccessToken,
  PROJECT_ID,
  LOCATION,
};
