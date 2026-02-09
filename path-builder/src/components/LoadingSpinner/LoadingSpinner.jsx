import "./LoadingSpinner.css";

export default function LoadingSpinner({ message = "Loading…" }) {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner" />
      <span>{message}</span>
    </div>
  );
}
