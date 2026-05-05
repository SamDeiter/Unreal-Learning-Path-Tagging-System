/**
 * ConceptPageShell — common chrome for every concept page.
 *
 * Renders a hero section (eyebrow + huge title + version pill row) followed
 * by the page body slot. Translated from the approved Stitch mockup
 * (docs/stitch-mockups/migration-hub.html). Uses the Stitch design tokens
 * defined in src/styles/tailwind.css (@theme block).
 *
 * Designed to look right embedded inside the Tutor's Concept section AND on
 * its own standalone route.
 */
import { ArrowRight } from "lucide-react";
import { useUserEngineVersion } from "../../hooks/useUserEngineVersion";

export function ConceptPageShell({
  title,
  subtitle,
  children,
  /** When false, hides the user-version banner. Useful when embedded in
   *  the Tutor where the version is already shown elsewhere. */
  showVersionBanner = true,
}) {
  const [userVersion] = useUserEngineVersion();
  const sourceVersion = "5.6";

  return (
    <article className="bg-background text-on-background font-body-base">
      {/* Hero header */}
      <section
        className="relative w-full overflow-hidden flex flex-col justify-end px-margin py-lg border-b border-outline-variant bg-gradient-to-br from-surface-container-low via-background to-surface-container-low"
        style={{ minHeight: 300 }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-60 z-0"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(99,102,241,0.10), transparent 60%), radial-gradient(ellipse at bottom left, rgba(15,23,42,0.6), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>

        <div className="relative z-20 mx-auto w-full max-w-4xl">
          <p className="font-label-caps text-label-caps text-primary tracking-[0.2em] mb-xs">
            MIGRATION MODULE
          </p>
          <h2 className="font-display-lg text-display-lg max-w-2xl mb-base text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-3xl font-body-base text-body-base text-on-surface-variant mb-md">
              {subtitle}
            </p>
          )}
          {showVersionBanner && (
            <div className="flex items-center gap-base">
              <span className="px-gutter py-xs bg-secondary-container text-on-secondary-container font-label-caps text-label-caps rounded-full">
                v{sourceVersion}
              </span>
              <ArrowRight className="h-4 w-4 text-outline" aria-hidden="true" />
              <span className="px-gutter py-xs bg-primary text-on-primary font-label-caps text-label-caps rounded-full">
                v{userVersion}
              </span>
            </div>
          )}
        </div>
      </section>

      <div>{children}</div>
    </article>
  );
}
