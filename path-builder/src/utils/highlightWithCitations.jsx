/**
 * highlightWithCitations — Extends highlightTerms to make [N] citation
 * references clickable links to the corresponding Vertex AI doc results.
 *
 * Usage:
 *   highlightWithCitations(text, vertexAIDocs?.results)
 *
 * If no docs are provided, falls back to plain highlightTerms.
 */
import React from "react";
import highlightTerms from "./highlightTerms";

const CITATION_RE = /\[(\d+)\]/g;

/**
 * Takes a processed React node array (from highlightTerms) and replaces
 * [N] citation markers in string segments with clickable links.
 */
function processCitations(nodes, docResults) {
  if (!docResults?.length) return nodes;

  const result = [];

  const processNode = (node, idx) => {
    // Only process string segments — React elements stay as-is
    if (typeof node !== "string") {
      result.push(React.cloneElement(node, { key: `node-${idx}` }));
      return;
    }

    let lastIndex = 0;
    let match;
    CITATION_RE.lastIndex = 0;

    while ((match = CITATION_RE.exec(node)) !== null) {
      // Push text before citation
      if (match.index > lastIndex) {
        result.push(node.slice(lastIndex, match.index));
      }

      const citNum = parseInt(match[1], 10);
      const doc = docResults[citNum - 1]; // citations are 1-indexed

      if (doc?.url) {
        result.push(
          <a
            key={`cite-${idx}-${match.index}`}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="citation-link"
            title={doc.title || `Source ${citNum}`}
          >
            [{citNum}]
          </a>
        );
      } else {
        // No matching doc — render as plain text
        result.push(match[0]);
      }

      lastIndex = CITATION_RE.lastIndex;
    }

    // Push remaining text
    if (lastIndex < node.length) {
      result.push(node.slice(lastIndex));
    }
  };

  if (Array.isArray(nodes)) {
    nodes.forEach(processNode);
  } else if (typeof nodes === "string") {
    processNode(nodes, 0);
  } else {
    return nodes; // React element or null — pass through
  }

  return result.length > 0 ? result : nodes;
}

/**
 * Highlight UE5 terms AND make [N] citations clickable.
 *
 * @param {string} text  — raw text from the AI diagnosis
 * @param {Array}  docs  — vertexAIDocs.results array (optional)
 * @returns JSX with highlighted terms and clickable citation links
 */
export default function highlightWithCitations(text, docs) {
  const highlighted = highlightTerms(text);
  return processCitations(highlighted, docs);
}
