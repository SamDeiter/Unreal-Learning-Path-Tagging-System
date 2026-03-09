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
