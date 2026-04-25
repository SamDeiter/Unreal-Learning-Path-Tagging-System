/**
 * HowItWorksDiagram — Renders a Mermaid flowchart source string as an SVG.
 *
 * Mermaid is lazy-loaded on first use to keep it out of the initial bundle
 * (mermaid + its tree is ~1.5 MB gzipped). If the source fails to parse,
 * we render nothing — the howItWorks prose above is the accessible
 * equivalent so there's no data loss.
 */

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { devError, devLog } from "../../utils/logger";

let mermaidModulePromise = null;
function loadMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid").then((m) => {
      const mermaid = m.default || m;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        flowchart: {
          curve: "basis",
          // Bumped padding so labels never butt against the rect edge even
          // when the browser's measurement of bold text is a fraction of a
          // pixel wider than Mermaid's prediction.
          padding: 24,
          nodeSpacing: 50,
          rankSpacing: 70,
          // useMaxWidth: true makes Mermaid emit viewBox + width:100%, so the
          // graph scales down to whatever column it's in instead of overflowing.
          useMaxWidth: true,
        },
        // themeCSS is applied INSIDE the SVG before Mermaid measures node
        // bounding boxes. Without it, CSS-forced font-weight:600 + 1.05rem
        // makes painted text wider than the rect Mermaid sized for the
        // default 400-weight 16px font, clipping ends like "PlayerControlle".
        // Match the painting CSS exactly so measurement and render agree.
        themeCSS: `
          .nodeLabel, .nodeLabel * {
            font-size: 17px !important;
            font-weight: 600 !important;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
          }
          .edgeLabel, .edgeLabel * {
            font-size: 15px !important;
            font-weight: 500 !important;
          }
        `,
        themeVariables: {
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          // 17px matches the CSS-rendered label size (1.0625rem). Mermaid
          // uses this for its initial measurement pass; themeCSS above keeps
          // the rendered text in sync.
          fontSize: "17px",
          // Node fill: slightly lighter than page background so nodes pop.
          primaryColor: "#1e293b",
          // Node border: purple accent, matches ue-term highlight color.
          primaryBorderColor: "#8b5cf6",
          // Node text: high-contrast off-white.
          primaryTextColor: "#f8fafc",
          // Edge lines + edge-label text: readable slate, not muted gray.
          lineColor: "#cbd5e1",
          edgeLabelBackground: "#0f172a",
          // Secondary/tertiary fills used by sub-clusters if the model ever emits them.
          secondaryColor: "#312e81",
          tertiaryColor: "#0f172a",
        },
      });
      return mermaid;
    });
  }
  return mermaidModulePromise;
}

// Monotonic id so concurrent renders don't clash inside mermaid's internal cache.
let diagramCounter = 0;

// Flip any LR (left-right) or RL flow direction to TB (top-bottom) before
// handing the source to Mermaid. In an 860px column a 5-node horizontal
// graph scales down to unreadable; stacking vertically uses the column
// shape (tall, not wide) and keeps labels legible. Covers both the `graph`
// and `flowchart` keywords, and the `---` / YAML frontmatter variants.
function forceVerticalOrientation(source) {
  if (!source || typeof source !== "string") return source;
  return source.replace(
    /^(\s*(?:graph|flowchart)\s+)(LR|RL)\b/im,
    (_m, prefix) => `${prefix}TB`
  );
}

export default function HowItWorksDiagram({ source }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!source || typeof source !== "string") return undefined;
    let cancelled = false;
    diagramCounter += 1;
    const id = `how-it-works-diagram-${diagramCounter}`;

    const verticalSource = forceVerticalOrientation(source);
    devLog("[HowItWorksDiagram] mounting with source:", verticalSource.slice(0, 120));
    (async () => {
      try {
        const mermaid = await loadMermaid();
        devLog("[HowItWorksDiagram] mermaid loaded, rendering id=", id);
        const { svg } = await mermaid.render(id, verticalSource);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(false);
      } catch (err) {
        if (cancelled) return;
        // devError always logs (even in prod) so silent parse failures are visible.
        devError(
          "[HowItWorksDiagram] render failed:",
          err?.message || err,
          "\nsource was:",
          verticalSource
        );
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  const openLarger = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;
    const svgMarkup = svgEl.outerHTML;
    const width = Math.min(1200, window.screen.availWidth - 120);
    const height = Math.min(900, window.screen.availHeight - 120);
    const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2));
    const popup = window.open(
      "",
      "howItWorksDiagramPopout",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) return;
    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>How This Works — Diagram</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 32px; box-sizing: border-box; }
  svg { width: 100% !important; height: auto !important; max-width: 100% !important; }
  .nodeLabel, .nodeLabel * { font-size: 1.2rem !important; font-weight: 600;
    color: #f8fafc !important; fill: #f8fafc !important; }
  .edgeLabel, .edgeLabel * { font-size: 1rem !important; color: #f8fafc !important;
    fill: #f8fafc !important; background-color: #0f172a !important;
    padding: 2px 6px !important; border-radius: 4px; }
  .flowchart-link { stroke: #cbd5e1 !important; stroke-width: 1.6px; }
  .node rect, .node polygon, .node circle { stroke-width: 2px; }
</style>
</head>
<body><div class="wrap">${svgMarkup}</div></body>
</html>`);
    popup.document.close();
  };

  if (!source || error) return null;

  return (
    <div className="how-it-works-diagram-shell">
      <div
        ref={containerRef}
        className="how-it-works-diagram"
        role="img"
        aria-label="System diagram illustrating the concepts described above"
      />
      <button
        type="button"
        className="how-it-works-diagram-enlarge"
        onClick={openLarger}
        aria-label="Open diagram in a larger window"
        title="View larger"
      >
        🔍 View larger
      </button>
    </div>
  );
}

HowItWorksDiagram.propTypes = {
  source: PropTypes.string,
};

HowItWorksDiagram.defaultProps = {
  source: "",
};
