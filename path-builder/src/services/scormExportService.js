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
import { cleanTranscriptText } from "../utils/cleanTranscriptText";
import { markdownToHtml } from "../utils/markdownToHtml";
import { devLog } from "../utils/logger";
import { getDisplayName } from "./topicNameService";

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
  const title = getDisplayName(step) || cleanVideoTitle(step.segment?.title || step.title || `Step ${index + 1}`);
  const rawSummary = step.summary || step.segment?.text || step.segment?.summary || "";
  const summary = cleanTranscriptText(rawSummary);
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
    <div class="step-summary">${markdownToHtml(summary)}</div>
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

  // Auto-route to V2 exporter if V2 structured data is present
  if (pathResult?.v2Path) {
    return exportV2ScormPackage(pathResult.v2Path, { includeQuiz, query: pathResult.query });
  }

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

// ── V2 SCO HTML Generator (rich fields) ────────────────────────────

function generateV2ScoHtml(step, index, totalSteps, sectionTitle, pathTitle) {
  const title = step.title || `Step ${index + 1}`;
  const completionType = step.completionType || "watch";
  const completionLabel = { watch: "📺 Watch", do: "🔧 Do", apply: "🎯 Apply", check: "✅ Check" }[completionType] || "✅ Complete";

  let bodyHtml = "";

  // Why This Matters
  if (step.whyThisMatters) {
    bodyHtml += `<div class="v2-section v2-why"><h3>💡 Why This Matters</h3><p>${escapeHtml(step.whyThisMatters)}</p></div>`;
  }

  // What To Do (checklist rendered as static list for SCORM 1.2)
  if (step.whatToDo?.length) {
    const items = step.whatToDo.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    bodyHtml += `<div class="v2-section v2-do"><h3>🔧 What To Do</h3><ol>${items}</ol></div>`;
  }

  // How To Verify
  if (step.howToVerify) {
    bodyHtml += `<div class="v2-section v2-verify"><h3>✅ How To Verify</h3><p>${escapeHtml(step.howToVerify)}</p></div>`;
  }

  // Common Mistake
  if (step.commonMistake) {
    bodyHtml += `<div class="v2-section v2-mistake"><h3>⚠️ Common Mistake</h3><p>${escapeHtml(step.commonMistake)}</p></div>`;
  }

  // Key Takeaway
  if (step.takeaway) {
    bodyHtml += `<div class="v2-section v2-takeaway"><h3>🎯 Key Takeaway</h3><p>${escapeHtml(step.takeaway)}</p></div>`;
  }

  // Fallback: summary if no rich fields
  if (!bodyHtml && step.summary) {
    bodyHtml = `<div class="step-summary">${markdownToHtml(step.summary)}</div>`;
  }

  const prevLink = index > 0 ? `<a class="nav-link" href="sco_${index - 1}.html">← Previous</a>` : "<span></span>";
  const nextLink = index < totalSteps - 1
    ? `<a class="nav-link" href="sco_${index + 1}.html">Next →</a>`
    : "<span></span>";

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
    ${escapeHtml(pathTitle)} — ${escapeHtml(sectionTitle)} — Step ${index + 1} of ${totalSteps}
  </p>
  <h1>${escapeHtml(title)}</h1>
  <div class="step-meta">
    <span class="category-badge cat-${escapeHtml(completionType)}">${completionLabel}</span>
  </div>
  ${bodyHtml}
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

// V2 section header SCO
function generateSectionHeaderHtml(section, sectionIndex, totalSections, pathTitle) {
  const title = section.title || section.phase || `Section ${sectionIndex + 1}`;
  const purpose = section.purpose || "";
  const stepCount = section.steps?.length || 0;

  return (
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"></` +
    `script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${escapeHtml(pathTitle)} — Section ${sectionIndex + 1} of ${totalSections}
  </p>
  <h1>${escapeHtml(title)}</h1>
  ${purpose ? `<p style="font-size:1.05rem;color:var(--text);margin:16px 0;">${escapeHtml(purpose)}</p>` : ""}
  <div class="step-card">
    <p>This section contains <strong>${stepCount}</strong> step${stepCount !== 1 ? "s" : ""}.</p>
    <p>Click "Continue" to begin.</p>
  </div>
  <button class="complete-btn" onclick="this.disabled=true;this.textContent='✅ Ready';completeSCORM();">
    Continue →
  </button>
</body>
</html>`
  );
}

// V2 CSS extensions
const V2_CSS_EXTENSION = `
.v2-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 12px 0;
  border-left: 4px solid var(--border);
}
.v2-section h3 { font-size: 1rem; margin: 0 0 8px; }
.v2-section p { margin: 0; line-height: 1.6; }
.v2-section ol { padding-left: 1.5rem; margin: 8px 0 0; }
.v2-section li { margin-bottom: 6px; color: var(--text); }
.v2-why { border-left-color: var(--accent); }
.v2-why h3 { color: var(--accent); }
.v2-do { border-left-color: var(--accent-green); }
.v2-do h3 { color: var(--accent-green); }
.v2-verify { border-left-color: #8b5cf6; }
.v2-verify h3 { color: #8b5cf6; }
.v2-mistake { border-left-color: var(--accent-orange); background: rgba(210,153,34,0.04); }
.v2-mistake h3 { color: var(--accent-orange); }
.v2-takeaway { border-left-color: #f97583; }
.v2-takeaway h3 { color: #f97583; }
.cat-watch { background: rgba(88,166,255,0.15); color: #58a6ff; }
.cat-do { background: rgba(63,185,80,0.15); color: #3fb950; }
.cat-apply { background: rgba(139,92,246,0.15); color: #8b5cf6; }
.cat-check { background: rgba(210,153,34,0.15); color: #d29922; }
`;

/**
 * Generates and downloads a SCORM 1.2 zip package from a V2 learning path.
 *
 * @param {Object} v2Path - The V2 LearningPath object (sections[].steps[])
 * @param {Object} [options]
 * @param {boolean} [options.includeQuiz=true] - Include quiz SCO
 * @param {string} [options.query] - Original query for title generation
 * @returns {Promise<void>} - Triggers browser download
 */
export async function exportV2ScormPackage(v2Path, options = {}) {
  const { includeQuiz = true, query = "" } = options;

  if (!v2Path?.sections?.length) {
    throw new Error("Cannot export empty V2 path");
  }

  devLog("[SCORM V2] Starting package generation...");

  const pathTitle = v2Path.title || (query ? `UE5 Learning Path: ${query.substring(0, 60)}` : "UE5 Learning Path");

  const zip = new JSZip();

  // 1. Shared resources (base + V2 extension)
  zip.file("shared/scormapi.js", SCORM_API_JS);
  zip.file("shared/style.css", SHARED_CSS + V2_CSS_EXTENSION);

  // 2. Flatten sections into SCOs with section headers
  const scoFiles = [];
  let globalIndex = 0;

  // Count total SCOs for navigation (section headers + steps)
  const totalSections = v2Path.sections.length;
  const totalSteps = v2Path.sections.reduce((sum, s) => sum + (s.steps?.length || 0), 0) + totalSections;

  v2Path.sections.forEach((section, sIdx) => {
    // Section header SCO
    const headerFile = `sco_${globalIndex}.html`;
    zip.file(headerFile, generateSectionHeaderHtml(section, sIdx, totalSections, pathTitle));
    scoFiles.push(headerFile);
    globalIndex++;

    // Step SCOs
    (section.steps || []).forEach((step) => {
      const stepFile = `sco_${globalIndex}.html`;
      const sectionTitle = section.title || section.phase || "";
      zip.file(stepFile, generateV2ScoHtml(step, globalIndex, totalSteps, sectionTitle, pathTitle));
      scoFiles.push(stepFile);
      globalIndex++;
    });
  });

  // 3. Optional quiz SCO (reuse flat steps for question generation)
  const flatSteps = v2Path.sections.flatMap((s) => s.steps || []);
  if (includeQuiz && flatSteps.length >= 2) {
    zip.file("quiz.html", generateQuizHtml(flatSteps, pathTitle));
  }

  // 4. imsmanifest.xml
  zip.file(
    "imsmanifest.xml",
    generateManifest(pathTitle, scoFiles, includeQuiz && flatSteps.length >= 2)
  );

  // 5. Generate & download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `scorm_v2_${sanitizeFilename(query || v2Path.title || "path")}_${Date.now()}.zip`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  devLog(`[SCORM V2] Package downloaded: ${filename} (${scoFiles.length} SCOs)`);
}
