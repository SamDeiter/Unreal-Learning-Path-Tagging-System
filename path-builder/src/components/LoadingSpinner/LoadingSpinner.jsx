import "./LoadingSpinner.css";

export default function LoadingSpinner({ message = "Loading…" }) {
  return (
    <div className="loading-spinner-container" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
