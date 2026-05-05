/**
 * ConceptPageRoute — hash-route handler for the ConceptPages library.
 *
 * Mounted by TabRouter when activeTab starts with "concept/". Resolves the
 * trailing slug against the registry, lazy-loads the matching page, and
 * renders it inside a Suspense boundary.
 */
import { Suspense } from "react";
import { resolveBySlug } from "./registry";

export default function ConceptPageRoute({ slug }) {
  const page = resolveBySlug(slug);
  if (!page) {
    return (
      <div className="dashboard-layout">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 p-8 text-zinc-300">
          <h1 className="text-2xl font-semibold text-zinc-50">
            Concept page not found
          </h1>
          <p className="text-zinc-400">
            No page registered for slug <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-sm">{slug}</code>.
          </p>
          <p className="text-sm text-zinc-500">
            Check the registry at <code className="font-mono">src/components/ConceptPages/registry.js</code>.
          </p>
        </div>
      </div>
    );
  }
  const Page = page.component;
  return (
    <div className="dashboard-layout bg-background">
      <Suspense
        fallback={
          <div className="py-16 text-center text-on-surface-variant">Loading concept page…</div>
        }
      >
        <Page />
      </Suspense>
    </div>
  );
}
