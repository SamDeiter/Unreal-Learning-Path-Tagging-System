/**
 * markdownToHtml.js — Shared markdown-to-HTML converter for SCORM display.
 *
 * Converts basic markdown (headers, bold, italic, lists, code, links)
 * into inline-styled HTML suitable for embedding in SCORM SCO pages.
 *
 * @param {string} text — Raw markdown text
 * @returns {string} — HTML string with inline styles
 */
export function markdownToHtml(text) {
  if (!text || typeof text !== "string") return text;

  let html = text;

  // Escape HTML entities first (but preserve markdown syntax)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // Headers (### h3, ## h2, # h1) — order matters: longest prefix first
  html = html.replace(/^### (.+)$/gm, '<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>');

  // Unordered lists (- item)
  html = html.replace(/^- (.+)$/gm, '<li style="margin: 4px 0; margin-left: 20px;">$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>');

  // Links [text](url) with protocol validation
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // Block dangerous protocols (javascript:, data:, vbscript:)
    const isDangerous = /^\s*(javascript|data|vbscript):/i.test(url);
    const safeUrl = isDangerous ? "#" : url;
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">${text}</a>`;
  });

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">');

  // Single newlines → <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}
