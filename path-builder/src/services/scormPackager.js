/**
 * scormPackager.js — SCORM 1.2 Content Package Builder
 *
 * Assembles course content (videos, study guides, quizzes)
 * into a SCORM 1.2-compliant package with manifest and SCOs.
 *
 * Outputs a ZIP file via JSZip that can be uploaded to any LMS.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cleanTranscriptText } from "../utils/cleanTranscriptText";
import { markdownToHtml } from "../utils/markdownToHtml";

// ── Constants ──────────────────────────────────────────────────────

const SCORM_VERSION = "1.2";
const SCORM_SCHEMA = "ADL SCORM";
const SCHEMA_VERSION = "1.2";

// ── Manifest Generation ────────────────────────────────────────────

/**
 * Generate imsmanifest.xml for SCORM 1.2 package.
 *
 * @param {Object} config — Package configuration
 * @param {string} config.title — Course title
 * @param {string} config.identifier — Unique package ID
 * @param {Array}  config.scos — Shareable Content Objects
 * @param {string} [config.description] — Course description
 * @returns {string} — XML manifest string
 */
export function generateManifest(config) {
  const { title, identifier, scos, description = "" } = config;

  const organizationItems = scos
    .map(
      (sco, idx) => `
      <item identifier="ITEM_${idx}" identifierref="RES_${idx}">
        <title>${escapeXml(sco.title)}</title>
      </item>`
    )
    .join("");

  const resources = scos
    .map(
      (sco, idx) => `
      <resource identifier="RES_${idx}" type="webcontent" adlcp:scormtype="sco" href="${sco.href}">
        ${(sco.files || [sco.href]).map((f) => `<file href="${f}" />`).join("\n        ")}
      </resource>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(identifier)}"
          version="${SCORM_VERSION}"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>${SCORM_SCHEMA}</schema>
    <schemaversion>${SCHEMA_VERSION}</schemaversion>
  </metadata>
  <organizations default="ORG_1">
    <organization identifier="ORG_1">
      <title>${escapeXml(title)}</title>
      ${description ? `<metadata><description>${escapeXml(description)}</description></metadata>` : ""}
      ${organizationItems}
    </organization>
  </organizations>
  <resources>
    ${resources}
  </resources>
</manifest>`;
}

// ── SCO HTML Template ──────────────────────────────────────────────

/**
 * Generate a SCORM 1.2 SCO HTML page.
 *
 * @param {Object} sco — SCO configuration
 * @param {string} sco.title — Page title
 * @param {string} sco.content — HTML content body
 * @param {boolean} [sco.hasQuiz=false] — Whether this SCO has a quiz
 * @returns {string} — Complete HTML page with SCORM API integration
 */
export function generateScoHtml(sco) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(sco.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 0.5rem; }
    .quiz-section { background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
    .quiz-question { margin-bottom: 1rem; }
    .quiz-option { display: block; padding: 0.5rem 1rem; margin: 0.25rem 0; cursor: pointer; border: 1px solid #dee2e6; border-radius: 4px; }
    .quiz-option:hover { background: #e9ecef; }
    .nav-buttons { display: flex; gap: 1rem; margin-top: 2rem; }
    .nav-btn { padding: 0.75rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    .nav-btn.primary { background: #e94560; color: white; }
    .nav-btn.secondary { background: #6c757d; color: white; }
  </style>
</head>
<body>
  <h1>${escapeXml(sco.title)}</h1>
  <div id="content">
    ${sco.content}
  </div>
  <div class="nav-buttons">
    <button class="nav-btn secondary" onclick="goBack()">← Previous</button>
    <button class="nav-btn primary" onclick="markComplete()">Complete & Continue →</button>
  </div>

  <script>
    // SCORM 1.2 API Integration
    var API = null;
    function findAPI(win) {
      var tries = 0;
      while (!win.API && win.parent !== win && tries < 10) {
        win = win.parent;
        tries++;
      }
      return win.API || null;
    }

    function initSCORM() {
      API = findAPI(window);
      if (API) {
        API.LMSInitialize("");
        API.LMSSetValue("cmi.core.lesson_status", "incomplete");
        API.LMSCommit("");
      }
    }

    function markComplete() {
      if (API) {
        API.LMSSetValue("cmi.core.lesson_status", "completed");
        API.LMSSetValue("cmi.core.score.raw", "100");
        API.LMSCommit("");
        API.LMSFinish("");
      }
      // Navigate to next SCO if available
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: "sco_complete" }, "*");
      }
    }

    function goBack() {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: "sco_previous" }, "*");
      }
    }

    initSCORM();
  </script>
</body>
</html>`;
}

// ── Package Assembly ───────────────────────────────────────────────

/**
 * Build a complete SCORM 1.2 ZIP package.
 *
 * @param {Object} config — Package configuration
 * @param {string} config.title — Course title
 * @param {string} [config.description] — Course description
 * @param {Array<{ title: string, htmlContent: string, files?: Object }>} config.modules
 * @returns {Promise<Blob>} — ZIP file blob
 */
export async function buildScormPackage(config) {
  const { title, description = "", modules } = config;
  const identifier = `PKG_${Date.now()}`;

  const zip = new JSZip();

  // Build SCOs and add HTML files
  const scos = modules.map((mod, idx) => {
    const filename = `sco_${idx}.html`;
    const html = generateScoHtml({
      title: mod.title,
      content: mod.htmlContent,
    });
    zip.file(filename, html);

    // Add any additional files (images, audio, etc.)
    const files = [filename];
    if (mod.files) {
      Object.entries(mod.files).forEach(([path, content]) => {
        zip.file(path, content);
        files.push(path);
      });
    }

    return { title: mod.title, href: filename, files };
  });

  // Generate and add manifest
  const manifest = generateManifest({ title, identifier, scos, description });
  zip.file("imsmanifest.xml", manifest);

  return zip.generateAsync({ type: "blob" });
}

/**
 * Build and download a SCORM package.
 *
 * @param {Object} config — Same as buildScormPackage
 * @param {string} [filename] — Download filename
 */
export async function downloadScormPackage(config, filename) {
  const blob = await buildScormPackage(config);
  const name = filename || `${config.title.replace(/\s+/g, "_")}_SCORM.zip`;
  saveAs(blob, name);
  return { success: true, filename: name };
}

/**
 * Preview a SCORM package in a new browser tab.
 * Renders rich step content with segment text, categories, and bridges.
 *
 * @param {Object} pathResult — The full pathResult from path generation
 */
export async function previewScormPackage(pathResult) {
  if (!pathResult?.path?.length) throw new Error("No path to preview");

  const pathTitle = pathResult.query
    ? `UE5 Learning Path: ${pathResult.query.substring(0, 60)}`
    : "Learning Path";
  const steps = pathResult.path;
  const bridges = pathResult.bridges || [];

  // Build rich SCO pages using the same data the download export uses
  const scos = steps.map((step, idx) => {
    const title = step.segment?.title || step.title || `Step ${idx + 1}`;
    const rawSummary =
      step.gemini_enriched?.one_sentence_summary ||
      step.summary ||              // AI-generated mini-lesson from pathSequencer
      step.segment?.summary ||
      step.segment?.text ||
      step.description ||
      "";
    let summary = cleanTranscriptText(rawSummary);

    // If cleaning wiped the text (version-selector-only, truncated garbage, etc.)
    // generate a useful fallback from the title + source metadata.
    if (!summary) {
      const docSection = step.doc_meta?.section || "";
      const sourceLabel = step.source === "epic_docs"
        ? "Official Unreal Engine documentation"
        : "Reference material";
      summary = docSection
        ? `${sourceLabel} covering ${docSection.replace(/-/g, " ")}.`
        : `${sourceLabel} for ${title}.`;
    }
    const category = step.category || "core";
    const source = step.segment?.source || step.segment?.type || "";
    const bridge = bridges[idx] || null;
    const bridgeText = bridge?.text || bridge?.narration || "";

    // Extract video embed URL — check multiple possible locations
    const candidateUrls = [
      step.segment?.videoUrl,
      step.segment?.url,
      step._url,
      step.url,
      step.code,  // course codes are often raw YouTube video IDs (e.g. DEfJEVcQ-eQ)
    ].filter(Boolean);
    // Also check for videos array on the step (library courses store drive_id here)
    const firstVideo = step.videos?.[0] || step.segment?.videos?.[0];

    let driveId = null;
    let youtubeId = null;

    // Check explicit drive_id fields first
    if (firstVideo?.drive_id) {
      driveId = firstVideo.drive_id;
    } else if (step.segment?.drive_id) {
      driveId = step.segment.drive_id;
    } else if (step.drive_id) {
      driveId = step.drive_id;
    }

    // Try to extract from URLs
    if (!driveId && !youtubeId) {
      for (const videoUrl of candidateUrls) {
        if (!videoUrl) continue;
        // Google Drive URL
        const driveMatch = videoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || videoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveMatch) { driveId = driveMatch[1]; break; }
        // YouTube URL
        try {
          const vUrl = new URL(videoUrl);
          if (vUrl.hostname.includes("youtube.com")) { youtubeId = vUrl.searchParams.get("v"); break; }
          if (vUrl.hostname.includes("youtu.be")) { youtubeId = vUrl.pathname.slice(1); break; }
        } catch { /* not a URL, check if raw YouTube ID */ }
        // Raw YouTube ID (11 chars, alphanumeric + dash/underscore)
        if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) { youtubeId = videoUrl; break; }
      }
    }

    // Last resort: check if segment.title contains a known YouTube ID pattern
    // (some paths store the video ID in unusual fields)
    if (!driveId && !youtubeId && step.segment?.videoId) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(step.segment.videoId)) {
        youtubeId = step.segment.videoId;
      }
    }
    const startSec = Math.round(step.segment?.startTime || 0);
    const endSec = Math.round(step.segment?.endTime || 0);
    const videoTitle = step.segment?.videoTitle || "";
    const fmtTime = (s) => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");

    // Build video embed HTML as a separate string (avoids nested template literal issues)
    let videoHtml = "";
    if (driveId) {
      videoHtml = '<div class="video-section"><h2>\ud83c\udfac Video Reference</h2>'
        + '<div class="video-embed"><iframe src="https://drive.google.com/file/d/' + driveId + '/preview" allow="autoplay" allowfullscreen></iframe></div>'
        + '<div class="video-meta">'
        + (videoTitle ? '<span>' + escapeXml(videoTitle) + '</span>' : '')
        + ((startSec || endSec) ? '<span class="timestamp-badge">\u23f1 ' + fmtTime(startSec) + ' \u2013 ' + fmtTime(endSec) + '</span>' : '')
        + '<a href="https://drive.google.com/file/d/' + driveId + '/view" target="_blank" rel="noopener noreferrer">Open in Drive \u2197</a>'
        + '</div></div>';
    } else if (youtubeId) {
      const startParam = startSec ? "&start=" + startSec : "";
      videoHtml = '<div class="video-section"><h2>\ud83c\udfac Video Reference</h2>'
        + '<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + youtubeId + '?rel=0&modestbranding=1' + startParam + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
        + '<div class="video-meta">'
        + (videoTitle ? '<span>' + escapeXml(videoTitle) + '</span>' : '')
        + ((startSec || endSec) ? '<span class="timestamp-badge">\u23f1 ' + fmtTime(startSec) + ' \u2013 ' + fmtTime(endSec) + '</span>' : '')
        + '<a href="https://www.youtube.com/watch?v=' + youtubeId + (startSec ? '&t=' + startSec : '') + '" target="_blank" rel="noopener noreferrer">Watch on YouTube \u2197</a>'
        + '</div></div>';
    }

    // Category CSS class
    const catLower = category.toLowerCase();
    const catClass = catLower.includes("foundation") ? "cat-foundation"
      : (catLower.includes("transfer") || catLower.includes("practice")) ? "cat-transfer"
      : "cat-core";

    // Build rich HTML for this SCO
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)}</title>
  <style>
    :root { --bg: #0d1117; --card-bg: #161b22; --text: #e6edf3; --text-secondary: #8b949e; --accent: #58a6ff; --accent-green: #3fb950; --accent-orange: #d29922; --border: #30363d; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; color: var(--accent); }
    h2 { font-size: 1.3rem; margin: 24px 0 12px; color: var(--accent-green); }
    p { margin-bottom: 12px; color: var(--text-secondary); }
    .step-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .step-meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; display: flex; gap: 16px; align-items: center; }
    .category-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .cat-foundation { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
    .cat-core { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
    .cat-transfer, .cat-practice { background: rgba(210, 153, 34, 0.15); color: #d29922; }
    .bridge-box { background: rgba(88, 166, 255, 0.05); border-left: 3px solid var(--accent); padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-style: italic; color: var(--text-secondary); }
    .nav-buttons { display: flex; gap: 1rem; margin-top: 24px; }
    .nav-btn { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; }
    .nav-btn.primary { background: var(--accent-green); color: #000; }
    .nav-btn.secondary { background: #30363d; color: var(--text); }
    .nav-btn:hover { opacity: 0.9; }
    .breadcrumb { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; }
    .video-section { margin: 20px 0; }
    .video-section h2 { font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .video-embed { position: relative; width: 100%; padding-bottom: 56.25%; border-radius: 8px; overflow: hidden; background: #000; }
    .video-embed iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
    .video-meta { display: flex; gap: 16px; align-items: center; margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary); }
    .video-meta a { color: var(--accent); text-decoration: none; }
    .video-meta a:hover { text-decoration: underline; }
    .timestamp-badge { background: rgba(88, 166, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <p class="breadcrumb">${escapeXml(pathTitle)} — Step ${idx + 1} of ${steps.length}</p>
  <h1>${escapeXml(title)}</h1>
  ${bridgeText ? `<div class="bridge-box"><strong>Connection:</strong> ${escapeXml(bridgeText)}</div>` : ""}
  ${videoHtml}
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${catClass}">${escapeXml(category)}</span>
      ${source ? `<span>Source: ${escapeXml(source)}</span>` : ""}
    </div>
    ${summary ? `<div class="step-summary">${markdownToHtml(summary)}</div>` : "<p><em>No content summary available for this step.</em></p>"}
  </div>
  <div class="nav-buttons">
    <button class="nav-btn secondary" onclick="if(window.parent)window.parent.postMessage({type:'sco_previous'},'*')">← Previous</button>
    <button class="nav-btn primary" onclick="if(window.parent)window.parent.postMessage({type:'sco_complete'},'*')">Complete & Continue →</button>
  </div>
</body>
</html>`;

    return { title, html };
  });

  // Encode SCO data as base64 to avoid script injection issues
  const scosJson = JSON.stringify(scos.map((s) => ({ title: s.title, html: s.html })));
  const scosBase64 = btoa(unescape(encodeURIComponent(scosJson)));

  // Build viewer HTML page with sidebar nav + iframe
  const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SCORM Preview — ${escapeXml(pathTitle)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; height: 100vh; background: #0d1117; color: #c9d1d9; }
    .sidebar { width: 280px; background: #161b22; border-right: 1px solid #30363d; overflow-y: auto; padding: 1rem 0; flex-shrink: 0; }
    .sidebar h2 { padding: 0 1rem 0.75rem; font-size: 0.85rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
    .sidebar .title { padding: 0 1rem 1rem; font-size: 1.1rem; color: #f0f6fc; border-bottom: 1px solid #30363d; margin-bottom: 0.5rem; }
    .nav-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; cursor: pointer; transition: background 0.15s; font-size: 0.9rem; }
    .nav-item:hover { background: #21262d; }
    .nav-item.active { background: #1f6feb22; border-left: 3px solid #58a6ff; color: #58a6ff; }
    .nav-item .num { width: 22px; height: 22px; border-radius: 50%; background: #30363d; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; }
    .nav-item.active .num { background: #1f6feb; color: #fff; }
    .content { flex: 1; display: flex; flex-direction: column; }
    .toolbar { height: 42px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; padding: 0 1rem; gap: 0.75rem; font-size: 0.85rem; color: #8b949e; }
    .toolbar .badge { background: #238636; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    iframe { flex: 1; border: none; background: #fff; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="title">${escapeXml(pathTitle)}</div>
    <h2>📦 SCORM Preview</h2>
    <div id="nav"></div>
  </div>
  <div class="content">
    <div class="toolbar">
      <span class="badge">SCORM 1.2</span>
      <span>Learner Preview — <span id="current-title"></span></span>
    </div>
    <iframe id="viewer"></iframe>
  </div>
  <script id="sco-data" type="application/json">${scosBase64}${'<'}/script>
  <script>
    var raw = document.getElementById('sco-data').textContent;
    var scos = JSON.parse(decodeURIComponent(escape(atob(raw))));
    var nav = document.getElementById('nav');
    var viewer = document.getElementById('viewer');
    var currentTitle = document.getElementById('current-title');
    var activeIdx = 0;

    function loadSco(idx) {
      activeIdx = idx;
      var blob = new Blob([scos[idx].html], { type: 'text/html' });
      viewer.src = URL.createObjectURL(blob);
      currentTitle.textContent = scos[idx].title;
      document.querySelectorAll('.nav-item').forEach(function(el, i) {
        el.classList.toggle('active', i === idx);
      });
    }

    scos.forEach(function(sco, idx) {
      var item = document.createElement('div');
      item.className = 'nav-item' + (idx === 0 ? ' active' : '');
      item.innerHTML = '<span class="num">' + (idx + 1) + '</span><span>' + sco.title + '</span>';
      item.onclick = function() { loadSco(idx); };
      nav.appendChild(item);
    });

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'sco_complete' && activeIdx < scos.length - 1) loadSco(activeIdx + 1);
      if (e.data && e.data.type === 'sco_previous' && activeIdx > 0) loadSco(activeIdx - 1);
    });

    if (scos.length > 0) loadSco(0);
  ${'<'}/script>
</body>
</html>`;

  // Open in new tab
  const blob = new Blob([viewerHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ── Helpers ────────────────────────────────────────────────────────


/**
 * @private — Escape XML special characters.
 */
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}




