/**
 * PathFooter — Prev/next navigation + step status for adaptive path
 */
export default function PathFooter({ expandedStep, setExpandedStep, totalSteps }) {
  return (
    <footer className="epic-footer">
      <button
        className="nav-btn"
        onClick={() => {
          if (expandedStep === -3) {
            setExpandedStep(-2); // Reading → Quiz
          } else if (expandedStep === -2) {
            setExpandedStep(totalSteps - 1); // Quiz → last step
          } else {
            const cur = expandedStep ?? 0;
            if (cur > 0) setExpandedStep(cur - 1);
          }
        }}
        disabled={
          (expandedStep ?? 0) <= 0 &&
          expandedStep !== -2 &&
          expandedStep !== -3
        }
      >
        <i className="fa-solid fa-chevron-left"></i>
      </button>
      <div className="footer-status">
        {expandedStep === -2
          ? "Quiz"
          : expandedStep === -3
            ? "Further Reading"
            : `Step ${Math.min((expandedStep ?? 0) + 1, totalSteps)} of ${totalSteps}`}
      </div>
      <button
        className="nav-btn"
        onClick={() => {
          const cur = expandedStep ?? 0;
          if (cur < totalSteps - 1) {
            setExpandedStep(cur + 1);
          } else if (cur === totalSteps - 1) {
            setExpandedStep(-2); // Last step → quiz
          } else if (expandedStep === -2) {
            setExpandedStep(-3); // Quiz → further reading
          }
        }}
        disabled={expandedStep === -3}
      >
        <i className="fa-solid fa-chevron-right"></i>
      </button>
    </footer>
  );
}
