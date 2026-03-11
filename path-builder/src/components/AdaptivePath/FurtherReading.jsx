/**
 * FurtherReading — Source material cards with links for the learning path
 */
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import { fixEpicUrl } from "../../utils/urlHelpers";

export default function FurtherReading({ steps }) {
  return (
    <div className="quiz-phase-container">
      <div className="step-article">
        <h1>📖 Further Reading</h1>
        <p>
          Dive deeper into the topics covered in this path with these source
          materials.
        </p>
        <div
          className="further-reading-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          {steps.map((step, i) => {
            const seg = step.segment || {};
            const isAiGen =
              seg.type === "ai_generated" || seg.source === "ai_generated";

            // Chain through all possible URL sources
            const rawUrl = isAiGen
              ? null
              : seg.videoUrl ||
                seg.url ||
                seg.corpusMatch?.videoUrl ||
                (seg.slug
                  ? `https://dev.epicgames.com/documentation/en-us/unreal-engine/${seg.slug}`
                  : null);
            const url = rawUrl ? fixEpicUrl(rawUrl) : null;

            const title =
              cleanVideoTitle(seg.title || seg.videoTitle) ||
              `Step ${i + 1}`;
            const sourceType = isAiGen
              ? "ai_generated"
              : seg.type || seg.source || "docs";
            const icon = isAiGen
              ? "fa-robot"
              : sourceType === "transcript"
                ? "fa-video"
                : "fa-book-open";
            const typeLabel = isAiGen
              ? "AI-Assisted"
              : sourceType === "transcript"
                ? "Video"
                : sourceType === "epic_learning"
                  ? "Article"
                  : "Docs";
            const Wrapper = url ? "a" : "div";
            const wrapperProps = url
              ? {
                  href: url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                }
              : {};
            return (
              <Wrapper
                key={i}
                {...wrapperProps}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  background: "rgba(88, 166, 255, 0.06)",
                  border: "1px solid var(--border-color, #30363d)",
                  borderRadius: "10px",
                  color: url
                    ? "var(--accent-blue, #58a6ff)"
                    : "var(--text-secondary, #8b949e)",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  fontSize: "0.9rem",
                  cursor: url ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (url)
                    e.currentTarget.style.background = "rgba(88, 166, 255, 0.12)";
                }}
                onMouseLeave={(e) => {
                  if (url)
                    e.currentTarget.style.background = "rgba(88, 166, 255, 0.06)";
                }}
              >
                <i
                  className={`fa-solid ${icon}`}
                  style={{ fontSize: "1.1rem", width: "20px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{title}</div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginTop: "2px",
                    }}
                  >
                    {typeLabel} • Step {i + 1}
                  </div>
                </div>
                {url && (
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    style={{ opacity: 0.5, fontSize: "0.8rem" }}
                  />
                )}
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
