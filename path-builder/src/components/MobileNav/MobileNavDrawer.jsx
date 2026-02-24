import { useEffect, useRef } from "react";
import "./MobileNav.css";

/**
 * MobileNavDrawer — slide-out navigation for mobile viewports.
 * Renders a full-height overlay with large touch targets.
 *
 * Props:
 *   tabs       — array of { key, label, icon, adminOnly? }
 *   activeTab  — currently selected tab key
 *   onSelect   — callback(tabKey)
 *   isOpen     — boolean controlling visibility
 *   onClose    — callback to close drawer
 */
export default function MobileNavDrawer({ tabs, activeTab, onSelect, isOpen, onClose }) {
  const drawerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="mobile-nav-overlay" onClick={onClose}>
      <nav className="mobile-nav-drawer" ref={drawerRef} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-title">Navigation</span>
          <button className="mobile-nav-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        <ul className="mobile-nav-list">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <button
                className={`mobile-nav-item ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => {
                  onSelect(tab.key);
                  onClose();
                }}
              >
                <span className="mobile-nav-icon">{tab.icon}</span>
                <span className="mobile-nav-label">{tab.label}</span>
                {activeTab === tab.key && <span className="mobile-nav-active-dot" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
