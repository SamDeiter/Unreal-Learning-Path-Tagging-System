/**
 * scormExportService.js — SCORM 1.2 Package Generator
 *
 * Generates a downloadable .zip containing:
 *   - imsmanifest.xml (SCORM 1.2 content package manifest)
 *   - shared/scormapi.js (SCORM 1.2 API wrapper — cmi.core tracking)
 *   - shared/style.css (Base styles for SCO pages)
 *   - sco_0.html ... sco_N.html (One HTML SCO per learning path step)
 *   - quiz.html (Optional end-of-path quiz SCO)
 *
 * Usage:
 *   import { exportScormPackage } from "./scormExportService";
 *   await exportScormPackage(pathResult, { includeQuiz: true });
 *
 * The zip is generated client-side with JSZip and triggers a browser download.
 */

import JSZip from "jszip";
import { cleanVideoTitle } from "../utils/cleanVideoTitle";
import { devLog } from "../utils/logger";

// ── SCORM 1.2 API Wrapper (embedded as string) ────────────────────
const SCORM_API_JS = `
// Minimal SCORM 1.2 RTE API Wrapper
// Finds the SCORM API in the opener/parent chain and wraps it.
var API = null;

function findAPI(win) {
  var attempts = 0;
  while (!win.API && win.parent && win.parent !== win && attempts < 10) {
    win = win.parent;
    attempts++;
  }
  return win.API || null;
}

function initSCORM() {
  API = findAPI(window);
  if (!API && window.opener) API = findAPI(window.opener);
  if (API) {
    API.LMSInitialize("");
    API.LMSSetValue("cmi.core.lesson_status", "incomplete");
    API.LMSCommit("");
  }
}

function completeSCORM() {
  if (API) {
    API.LMSSetValue("cmi.core.lesson_status", "completed");
    API.LMSCommit("");
  }
}

function finishSCORM() {
  if (API) {
    API.LMSFinish("");
  }
}

function setScore(score, max) {
  if (API) {
    API.LMSSetValue("cmi.core.score.raw", String(score));
    API.LMSSetValue("cmi.core.score.max", String(max));
    API.LMSSetValue("cmi.core.score.min", "0");
    API.LMSSetValue("cmi.core.lesson_status", score >= max * 0.7 ? "passed" : "failed");
    API.LMSCommit("");
  }
}

window.addEventListener("load", initSCORM);
window.addEventListener("beforeunload", finishSCORM);
`;

// ── Shared SCO stylesheet ──────────────────────────────────────────
const SHARED_CSS = `
:root {
  --bg: #0d1117;
  --card-bg: #161b22;
  --text: #e6edf3;
  --text-secondary: #8b949e;
  --accent: #58a6ff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;
  --border: #30363d;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
}
h1 { font-size: 1.8rem; margin-bottom: 8px; color: var(--accent); }
h2 { font-size: 1.3rem; margin: 24px 0 12px; color: var(--accent-green); }
h3 { font-size: 1.1rem; margin: 16px 0 8px; color: var(--accent-orange); }
p { margin-bottom: 12px; color: var(--text-secondary); }
.step-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}
.step-meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; }
.step-meta span { margin-right: 16px; }
.category-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}
.cat-foundation { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
.cat-fix, .cat-core { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
.cat-transfer, .cat-practice { background: rgba(210, 153, 34, 0.15); color: #d29922; }
.bridge-box {
  background: rgba(88, 166, 255, 0.05);
  border-left: 3px solid var(--accent);
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: var(--text-secondary);
}
.complete-btn {
  display: block;
  margin: 32px auto;
  padding: 12px 32px;
  background: var(--accent-green);
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.complete-btn:hover { opacity: 0.9; }
.complete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nav-row { display: flex; justify-content: space-between; margin-top: 24px; }
.nav-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
}
.nav-link:hover { text-decoration: underline; }
.quiz-q { margin-bottom: 20px; }
.quiz-q label { display: block; padding: 6px 0; cursor: pointer; }
.quiz-q input[type="radio"] { margin-right: 8px; }
`;

// ── Helpers ────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
}

function escapeXml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getCategoryClass(cat) {
  if (!cat) return "";
  const c = cat.toLowerCase();
  if (c.includes("foundation")) return "cat-foundation";
  if (c.includes("fix") || c.includes("core")) return "cat-fix";
  if (c.includes("transfer") || c.includes("practice")) return "cat-transfer";
  return "";
}

// ── SCO HTML Generator ─────────────────────────────────────────────

function generateScoHtml(step, index, totalSteps, bridge, pathTitle) {
  const title = cleanVideoTitle(step.segment?.title || step.title || `Step ${index + 1}`);
  const summary = step.segment?.text || step.segment?.summary || "";
  const category = step.category || "core";
  const catClass = getCategoryClass(category);
  const source = step.segment?.source || step.segment?.type || "";

  const prevLink =
    index > 0 ? `<a class="nav-link" href="sco_${index - 1}.html">← Previous</a>` : "<span></span>";
  const nextLink =
    index < totalSteps - 1
      ? `<a class="nav-link" href="sco_${index + 1}.html">Next →</a>`
      : "<span></span>";

  const bridgeHtml = bridge?.text
    ? `<div class="bridge-box"><strong>Connection:</strong> ${escapeHtml(bridge.text)}</div>`
    : "";

  return (
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"></` +
    `script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${escapeHtml(pathTitle)} — Step ${index + 1} of ${totalSteps}
  </p>
  <h1>${escapeHtml(title)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${catClass}">${escapeHtml(category)}</span>
      ${source ? `<span>Source: ${escapeHtml(source)}</span>` : ""}
    </div>
    <p>${escapeHtml(summary)}</p>
  </div>
  ${bridgeHtml}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${prevLink}
    ${nextLink}
  </div>
</body>
</html>`
  );
}

// ── Quiz SCO Generator ─────────────────────────────────────────────

function generateQuizHtml(steps, pathTitle) {
  // Generate simple review questions (one per step)
  const questions = steps.slice(0, 10).map((step, i) => {
    const title = cleanVideoTitle(step.segment?.title || step.title || `Step ${i + 1}`);
    return { question: `What is the main topic covered in "${title}"?`, stepTitle: title };
  });

  const questionsHtml = questions
    .map(
      (q, i) => `
    <div class="quiz-q">
      <p><strong>Q${i + 1}:</strong> ${escapeHtml(q.question)}</p>
      <label><input type="radio" name="q${i}" value="correct"> ${escapeHtml(q.stepTitle)}</label>
      <label><input type="radio" name="q${i}" value="wrong1"> Unrelated Topic A</label>
      <label><input type="radio" name="q${i}" value="wrong2"> Unrelated Topic B</label>
    </div>
  `
    )
    .join("\n");

  return (
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Knowledge Check</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"></` +
    `script>
</head>
<body>
  <h1>Knowledge Check</h1>
  <p>Review your understanding of the concepts from "${escapeHtml(pathTitle)}".</p>
  <form id="quiz-form">
    ${questionsHtml}
    <button type="submit" class="complete-btn">Submit Answers</button>
  </form>
  <div id="result" style="display:none;text-align:center;margin-top:24px;"></div>
  <script>
    document.getElementById('quiz-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var total = ${questions.length};
      var correct = 0;
      for (var i = 0; i < total; i++) {
        var sel = document.querySelector('input[name="q' + i + '"]:checked');
        if (sel && sel.value === 'correct') correct++;
      }
      var pct = Math.round((correct / total) * 100);
      document.getElementById('result').style.display = 'block';
      document.getElementById('result').innerHTML =
        '<h2>Score: ' + correct + '/' + total + ' (' + pct + '%)</h2>' +
        '<p>' + (pct >= 70 ? '✅ Passed!' : '❌ Try again — 70% required to pass.') + '</p>';
      setScore(correct, total);
      this.querySelector('button').disabled = true;
    });
  </` +
    `script>
</body>
</html>`
  );
}

// ── imsmanifest.xml Generator ──────────────────────────────────────

function generateManifest(pathTitle, scoFiles, includeQuiz) {
  const orgId = "ORG-001";
  const manifestId = "MANIFEST-UE5-" + Date.now();

  const resourcesXml = scoFiles
    .map(
      (f, i) => `
    <resource identifier="RES-${i}" type="webcontent" adlcp:scormtype="sco" href="${f}">
      <file href="${f}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`
    )
    .join("\n");

  const quizResource = includeQuiz
    ? `
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`
    : "";

  const itemsXml = scoFiles
    .map(
      (f, i) => `
      <item identifier="ITEM-${i}" identifierref="RES-${i}">
        <title>${escapeXml(`Step ${i + 1}`)}</title>
      </item>`
    )
    .join("\n");

  const quizItem = includeQuiz
    ? `
      <item identifier="ITEM-QUIZ" identifierref="RES-QUIZ">
        <title>Knowledge Check</title>
      </item>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${orgId}">
    <organization identifier="${orgId}">
      <title>${escapeXml(pathTitle)}</title>
      ${itemsXml}
      ${quizItem}
    </organization>
  </organizations>
  <resources>
    ${resourcesXml}
    ${quizResource}
  </resources>
</manifest>`;
}

// ── Main Export Function ───────────────────────────────────────────

/**
 * Generates and downloads a SCORM 1.2 zip package from a pathResult.
 *
 * @param {Object} pathResult - The generated learning path object
 * @param {Object} [options]
 * @param {boolean} [options.includeQuiz=true] - Include a quiz SCO
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportScormPackage(pathResult, options = {}) {
  const { includeQuiz = true } = options;

  if (!pathResult?.path?.length) {
    throw new Error("Cannot export empty path");
  }

  devLog("[SCORM] Starting package generation...");

  const pathTitle = pathResult.query
    ? `UE5 Learning Path: ${pathResult.query.substring(0, 60)}`
    : "UE5 Learning Path";

  const zip = new JSZip();

  // 1. Shared resources
  zip.file("shared/scormapi.js", SCORM_API_JS);
  zip.file("shared/style.css", SHARED_CSS);

  // 2. One SCO per step
  const scoFiles = [];
  pathResult.path.forEach((step, i) => {
    const filename = `sco_${i}.html`;
    const bridge = pathResult.bridges?.[i] || null;
    const html = generateScoHtml(step, i, pathResult.path.length, bridge, pathTitle);
    zip.file(filename, html);
    scoFiles.push(filename);
  });

  // 3. Optional quiz SCO
  if (includeQuiz && pathResult.path.length >= 2) {
    zip.file("quiz.html", generateQuizHtml(pathResult.path, pathTitle));
  }

  // 4. imsmanifest.xml
  zip.file(
    "imsmanifest.xml",
    generateManifest(pathTitle, scoFiles, includeQuiz && pathResult.path.length >= 2)
  );

  // 5. Generate & download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `scorm_${sanitizeFilename(pathResult.query || "path")}_${Date.now()}.zip`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  devLog(`[SCORM] Package downloaded: ${filename} (${scoFiles.length} SCOs)`);
}
