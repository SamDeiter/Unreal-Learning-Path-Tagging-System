import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/tailwind.css";
import App from "./App.jsx";
import { installGlobalErrorHandlers } from "./services/errorReportingService";
import { applyPrefsToDocument } from "./hooks/useAccessibilityPreferences";

// Install global error monitoring before rendering
installGlobalErrorHandlers();

// Apply UDL/accessibility prefs to <html> BEFORE first paint so the dyslexic
// font and reduced-motion overrides are active on the very first frame.
// Mirrors useAccessibilityPreferences storage shape ("udl-prefs-v1").
try {
  const raw = window.localStorage?.getItem("udl-prefs-v1");
  if (raw) {
    applyPrefsToDocument(JSON.parse(raw));
  }
} catch {
  // ignore — hook will re-apply on mount
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
