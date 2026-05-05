/**
 * ConceptPages registry — maps a topic slug to a lazy-loaded React component.
 *
 * A "concept page" is a hand-crafted, interactive explainer for a single UE
 * topic. The Tutor can embed one at the top of its Concept section when the
 * learner's question matches a known topic; pages are also addressable
 * directly via hash route #/concept/<slug> for deep reads.
 *
 * To add a new concept page:
 *   1. Author a component at ./pages/<TopicName>.jsx using the shared
 *      <ConceptPageShell> + primitives in ./primitives/.
 *   2. Lazy-import it below and add the entry with slug + topic tags.
 *   3. The registry's resolveByTags() function will surface it to the Tutor
 *      whenever an answer carries one of those tags.
 */
import { lazy } from "react";

const UnderstandingUEVersionMigrations = lazy(() =>
  import("./pages/UnderstandingUEVersionMigrations.jsx").then((m) => ({
    default: m.UnderstandingUEVersionMigrations,
  })),
);

export const CONCEPT_PAGES = [
  {
    slug: "understanding-ue-version-migrations",
    title: "Understanding UE Version Migrations",
    summary: "What your 5.6 tutorials don't say — 10 verified deltas in 5.7.",
    component: UnderstandingUEVersionMigrations,
    // Tutor matches on these tags. Loose union — any tag overlap counts.
    topicTags: [
      "version-migration",
      "deprecation",
      "ue-5.7",
      "ue-5.6",
      "engine-update",
      "release-notes",
      "what-changed",
    ],
  },
];

/** Look up a page by its slug (used by the hash route). */
export function resolveBySlug(slug) {
  return CONCEPT_PAGES.find((p) => p.slug === slug) || null;
}

/** Pick the highest-overlap page for a set of topic tags. Returns null if none. */
export function resolveByTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const wanted = new Set(tags.map((t) => String(t).toLowerCase()));
  let best = null;
  let bestScore = 0;
  for (const page of CONCEPT_PAGES) {
    const overlap = page.topicTags.reduce(
      (n, t) => (wanted.has(t.toLowerCase()) ? n + 1 : n),
      0,
    );
    if (overlap > bestScore) {
      best = page;
      bestScore = overlap;
    }
  }
  return best;
}
