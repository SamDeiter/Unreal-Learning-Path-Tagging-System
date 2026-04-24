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
        flowchart: { curve: "basis", padding: 12 },
        themeVariables: {
          primaryColor: "#1e293b",
          primaryBorderColor: "#475569",
          primaryTextColor: "#e5e7eb",
          lineColor: "#94a3b8",
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
