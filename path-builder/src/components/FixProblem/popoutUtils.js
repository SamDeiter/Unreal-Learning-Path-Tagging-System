/**
 * Utility functions for AnswerView popouts and formatting.
 */

// Stable-ish session key so refreshing mid-troubleshoot keeps progress,
// but a fresh question re-keys and starts over.
export function fixStepsKey(cause, steps) {
  if (!steps?.length) return null;
  const sig = `${cause || ""}::${steps.length}::${(steps[0] || "").slice(0, 40)}`;
  let h = 5381;
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) | 0;
  return `fixSteps:${h}`;
}

// Claude often prefixes list items with a markdown-bold title like
// `**Check Project Settings for Jump Action Mapping:** Go to ...`.
// Rendering that inline just makes each item visually heavier; splitting
// it into a title + body block gives the list real hierarchy.
export function splitTitle(text) {
  if (!text || typeof text !== "string") return { title: null, body: text };
  const m = text.match(/^\s*\*\*([^*\n]+?)\*\*\s*/);
  if (!m) return { title: null, body: text };
  let title = m[1].trim();
  title = title.replace(/^\d+\.\s*/, ""); // drop "N. " — the list already numbers
  title = title.replace(/[:：]\s*$/, ""); // drop trailing colon, ASCII or full-width
  return { title, body: text.slice(m[0].length) };
}

export function loadCheckedSteps(key) {
  if (!key || typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

// Popup-only renderer for the Fix Steps checklist. Opens a compact window
// sized to fit the list; checkboxes postMessage back to the opener so
// sessionStorage state stays synced with the main view.
export function openFixStepsPopout({ steps, checked }) {
  if (typeof window === "undefined") return null;
  const estimatedHeight = Math.min(820, 160 + steps.length * 78);
  const width = 560;
  // Right-edge anchored, roughly vertically centered on the current screen.
  // Chrome ignores size hints unless `popup=yes` is present — without it the
  // window reopens in whatever state the last browser window was in (often
  // maximized), which is why this opened full-screen before.
  const left = Math.max(0, (window.screen.availWidth || 1280) - width - 40);
  const top = Math.max(0, Math.floor(((window.screen.availHeight || 800) - estimatedHeight) / 2));
  const popup = window.open(
    "",
    "fixStepsPopout",
    `popup=yes,width=${width},height=${estimatedHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  if (!popup) return null;

  const splitSteps = steps.map(splitTitle);
  // Security: Escape < as \u003c to prevent </script> injection
  const stepsJSON = JSON.stringify(splitSteps).replace(/</g, "\\u003c");
  const checkedJSON = JSON.stringify([...checked]).replace(/</g, "\\u003c");

  popup.document.open();
  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Fix Steps</title>
<style>
  :root { color-scheme: dark; }
  body {
    background: #0f172a;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0;
    padding: 18px 20px;
  }
  h1 {
    font-size: 1rem;
    margin: 0 0 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  h1 .progress {
    margin-left: auto;
    font-size: 0.78rem;
    font-weight: 500;
    color: #94a3b8;
    background: rgba(148,163,184,0.08);
    padding: 2px 10px;
    border-radius: 10px;
  }
  ul { list-style: none; padding: 0; margin: 0; }
  li {
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: opacity 0.2s ease;
  }
  li:last-child { border-bottom: none; }
  label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 4px;
    cursor: pointer;
    user-select: none;
  }
  input[type="checkbox"] {
    margin: 3px 0 0;
    width: 16px;
    height: 16px;
    accent-color: #8b5cf6;
    cursor: pointer;
    flex-shrink: 0;
  }
  .num {
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    min-width: 18px;
    padding-top: 1px;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }
  .title {
    font-size: 0.92rem;
    font-weight: 600;
    color: #f3f4f6;
    line-height: 1.3;
  }
  .text {
    font-size: 0.88rem;
    line-height: 1.5;
    color: rgba(229,231,235,0.85);
    transition: color 0.2s ease;
  }
  li.checked { opacity: 0.7; }
  li.checked .title,
  li.checked .text {
    text-decoration: line-through;
    text-decoration-color: rgba(107,114,128,0.6);
    color: #6b7280;
  }
  li.checked .num { color: #4b5563; }
</style>
</head>
<body>
<h1><span>🔧</span><span>Fix Steps</span><span class="progress" id="progress"></span></h1>
<ul id="list"></ul>
<script>
const steps = ${stepsJSON};
const checked = new Set(${checkedJSON});
const list = document.getElementById('list');
const progress = document.getElementById('progress');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

function render() {
  list.innerHTML = steps.map((step, i) => {
    const isChecked = checked.has(i);
    const titleHtml = step.title
      ? '<strong class="title">' + escapeHtml(step.title) + '</strong>'
      : '';
    return '<li class="' + (isChecked ? 'checked' : '') + '">'
      + '<label>'
      + '<input type="checkbox" data-i="' + i + '"' + (isChecked ? ' checked' : '') + '/>'
      + '<span class="num">' + (i + 1) + '</span>'
      + '<div class="content">'
      + titleHtml
      + '<span class="text">' + escapeHtml(step.body) + '</span>'
      + '</div>'
      + '</label></li>';
  }).join('');
  progress.textContent = checked.size + ' of ' + steps.length + ' done';
}

list.addEventListener('change', (e) => {
  const i = Number(e.target.dataset.i);
  if (Number.isNaN(i)) return;
  if (checked.has(i)) checked.delete(i); else checked.add(i);
  render();
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: 'fixStepsToggle', index: i }, '*');
  }
});

// Opener can push state changes back so this view doesn't go stale.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'fixStepsSync' || !Array.isArray(d.checked)) return;
  checked.clear();
  d.checked.forEach(i => checked.add(i));
  render();
});

render();

// Auto-fit window to actual content once laid out.
window.addEventListener('load', () => {
  const contentHeight = document.documentElement.scrollHeight;
  const chrome = window.outerHeight - window.innerHeight;
  const target = Math.min(contentHeight + chrome + 8, screen.availHeight - 40);
  window.resizeTo(window.outerWidth, target);
});
</script>
</body>
</html>`);
  popup.document.close();
  return popup;
}
