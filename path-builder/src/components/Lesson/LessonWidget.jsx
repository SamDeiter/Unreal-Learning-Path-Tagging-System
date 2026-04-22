/**
 * LessonWidget — Renders AI-generated widget HTML inside a sandboxed iframe.
 *
 * Security: `html` is untrusted AI output. The sandbox iframe is the boundary.
 * Sandbox attributes are deliberately minimal: "allow-scripts" only — no
 * same-origin, no forms, no top-navigation. Never inject `html` via
 * dangerouslySetInnerHTML outside the iframe.
 *
 * Optional auto-resize: if the embedded page posts { type: "resize", height }
 * via window.parent.postMessage, the frame grows to fit.
 */
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

const DEFAULT_HEIGHT = 500;

export default function LessonWidget({ html, title = "Interactive lesson widget" }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    if (!html) return undefined;
    const handler = (event) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (data && data.type === "resize" && typeof data.height === "number") {
        const clamped = Math.max(200, Math.min(2000, Math.round(data.height)));
        setHeight(clamped);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [html]);

  if (!html) {
    return (
      <div className="lesson-widget lesson-widget--empty" role="note">
        Interactive demo unavailable for this lesson.
      </div>
    );
  }

  return (
    <div className="lesson-widget">
      <iframe
        ref={iframeRef}
        className="lesson-widget__frame"
        title={title}
        sandbox="allow-scripts"
        srcDoc={html}
        style={{ height: `${height}px` }}
        loading="lazy"
      />
    </div>
  );
}

LessonWidget.propTypes = {
  html: PropTypes.string,
  title: PropTypes.string,
};
