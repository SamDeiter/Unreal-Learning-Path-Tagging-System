import { useState } from 'react';
import './CollapsibleSection.css';

/**
 * CollapsibleSection - Reusable collapsible wrapper for analytics sections
 */
function CollapsibleSection({ title, icon, children, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`collapsible-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div 
        className="section-toggle" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4 className="section-header">
          {icon && <span className="section-icon">{icon}</span>}
          {title}
        </h4>
        <span className="toggle-indicator">{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
