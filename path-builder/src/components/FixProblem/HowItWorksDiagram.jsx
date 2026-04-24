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
          padding: 18,
          nodeSpacing: 50,
          rankSpacing: 70,
          // useMaxWidth: true makes Mermaid emit viewBox + width:100%, so the
          // graph scales down to whatever column it's in instead of overflowing.
          useMaxWidth: true,
        },
        themeVariables: {
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          // Kept close to the CSS-forced label size (1.05rem ≈ 17px). Previously
          // 26px made Mermaid lay out oversized nodes that then scaled down and
          // left wasted whitespace inside each box.
          fontSize: "16px",
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

export default function HowItWorksDiagram({ source }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!source || typeof source !== "string") return undefined;
    let cancelled = false;
    diagramCounter += 1;
    const id = `how-it-works-diagram-${diagramCounter}`;

    devLog("[HowItWorksDiagram] mounting with source:", source.slice(0, 120));
    (async () => {
      try {
        const mermaid = await loadMermaid();
        devLog("[HowItWorksDiagram] mermaid loaded, rendering id=", id);
        const { svg } = await mermaid.render(id, source);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(false);
      } catch (err) {
        if (cancelled) return;
        // devError always logs (even in prod) so silent parse failures are visible.
        devError("[HowItWorksDiagram] render failed:", err?.message || err, "\nsource was:", source);
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source || error) return null;

  return (
    <div
      ref={containerRef}
      className="how-it-works-diagram"
      role="img"
      aria-label="System diagram illustrating the concepts described above"
    />
  );
}

HowItWorksDiagram.propTypes = {
  source: PropTypes.string,
};

HowItWorksDiagram.defaultProps = {
  source: "",
};
