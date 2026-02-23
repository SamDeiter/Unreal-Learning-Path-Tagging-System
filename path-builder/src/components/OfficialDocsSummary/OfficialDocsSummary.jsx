/**
 * OfficialDocsSummary — Displays Vertex AI Search results with AI-generated summary.
 *
 * Shows grounded official UE5 documentation results alongside local video search.
 * Features: AI summary with citations, collapsible result list, loading/error states.
 */
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "./OfficialDocsSummary.css";

export default function OfficialDocsSummary({ data, isLoading, error }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isLoading && !error && (!data || (!data.summary && data.results?.length === 0))) {
    return null;
  }

  return (
    <div className="official-docs-summary">
      <button
        className="official-docs-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="official-docs-title">
          <BookOpen size={18} />
          <span>Official UE5 Documentation</span>
          {data?.results?.length > 0 && (
            <span className="docs-count">{data.results.length} results</span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="official-docs-body">
          {isLoading && (
            <div className="docs-loading">
              <Loader2 size={18} className="docs-spinner" />
              <span>Searching official documentation…</span>
            </div>
          )}

          {error && (
            <div className="docs-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && data && (
            <>
              {data.summary && (
                <div className="docs-ai-summary">
                  <div className="summary-badge">
                    <Sparkles size={14} />
                    <span>AI Summary</span>
                  </div>
                  <p className="summary-text">{data.summary}</p>
                  {data.references?.length > 0 && (
                    <div className="summary-sources">
                      <span className="sources-label">Sources:</span>
                      {data.references.map((ref, i) => (
                        <a
                          key={i}
                          href={ref.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                          title={ref.title}
                        >
                          {ref.title || `Source ${i + 1}`}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {data.results?.length > 0 && (
                <div className="docs-results">
                  {data.results.map((result, i) => (
                    <a
                      key={i}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-result-card"
                    >
                      <div className="doc-result-title">
                        {result.title || "Untitled"}
                        <ExternalLink size={12} />
                      </div>
                      {result.snippet && (
                        <p
                          className="doc-result-snippet"
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      )}
                      <span className="doc-result-url">{result.url}</span>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
