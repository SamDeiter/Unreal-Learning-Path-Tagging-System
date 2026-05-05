/**
 * SIMULATOR_SCRIPTS — hand-authored "watch a 5.6 tutorial in 5.7" walk-throughs.
 *
 * Each script is a sequence of paired panels: what the tutorial says (left)
 * vs. what actually happens in 5.7 (right). The Simulator section steps
 * through these with arrow keys / next-button.
 *
 * outcome legend:
 *   "ok"     — works the same; no action needed
 *   "warn"   — works but emits deprecation banner; safe but flagged
 *   "broken" — fails outright (compile error, missing menu, removed feature)
 *   "fixed"  — recommended replacement; the path forward
 */
export const SIMULATOR_SCRIPTS = [
  {
    id: "unrealstats-to-insights",
    refId: "ref_workflow_step_unrealstats",
    title: "Profiling with UnrealStats",
    subtitle: "5.6 tutorials → UE 5.7 reality",
    summary:
      "UnrealStats is deprecated in 5.7. Most legacy commands still respond, but the dedicated tool is gone and you should be using UnrealInsights for any new work.",
    steps: [
      {
        tutorial: {
          heading: "Open the Tools menu and select UnrealStats",
          body: "5.6 tutorial assumes the dedicated profiler window is one click away.",
        },
        reality: {
          heading: "UnrealStats has been removed from the Tools menu",
          body: "The menu entry no longer exists. UnrealInsights (Window → Developer Tools → Insights) replaces it.",
          outcome: "broken",
        },
      },
      {
        tutorial: {
          heading: "Run `stat unit` in the console",
          body: "Tutorial expects the in-viewport overlay to appear with frame timing.",
        },
        reality: {
          heading: "Command still works, but emits a deprecation banner",
          body: "`stat unit`, `stat fps`, and other legacy commands continue to function in 5.7. Console logs a one-line warning each session.",
          outcome: "warn",
        },
      },
      {
        tutorial: {
          heading: "Save the trace as a `.uestats` file",
          body: "Tutorial points to File → Save Stats and walks through the binary format.",
        },
        reality: {
          heading: ".uestats files are no longer written",
          body: "The save dialog has been removed. Use UnrealInsights' `.utrace` capture instead — it includes everything `.uestats` did plus a navigable timeline.",
          outcome: "broken",
        },
      },
      {
        tutorial: {
          heading: "Compare frame times across runs",
          body: "Tutorial demonstrates side-by-side comparison via overlay screenshots.",
        },
        reality: {
          heading: "UnrealInsights gives you a real diff view",
          body: "Open two `.utrace` files in Insights and use the Comparison tool — same data, much better surface.",
          outcome: "fixed",
        },
      },
    ],
  },
  {
    id: "get-pixel-density-vr",
    refId: "ref_blueprint_node_get_pixel_density",
    title: "Reading HMD pixel density in Blueprints",
    subtitle: "VR setup tutorials → UE 5.7 reality",
    summary:
      "The 'Get Pixel Density' Blueprint node returns inconsistent values on modern HMDs. It's deprecated in 5.7; use 'Get HMD Secondary Screen Percentage' for accurate values.",
    steps: [
      {
        tutorial: {
          heading: "Drag a Get Pixel Density node into your VR pawn",
          body: "Tutorial wires it to a render target scaling parameter to maintain a target framerate.",
        },
        reality: {
          heading: "Node appears but is marked deprecated",
          body: "The palette still shows it under XR → HMD, but the node renders with a strikethrough and a tooltip pointing to the replacement.",
          outcome: "warn",
        },
      },
      {
        tutorial: {
          heading: "Connect output to a Set Screen Percentage call",
          body: "Tutorial expects a 0.0–1.0 float driving viewport scale.",
        },
        reality: {
          heading: "Compile succeeds, but values drift on most HMDs",
          body: "On Meta Quest, Vision Pro, and Index, the deprecated node returns the *primary* density, not the secondary. Render target scales incorrectly under load.",
          outcome: "warn",
        },
      },
      {
        tutorial: {
          heading: "Replace with Get HMD Secondary Screen Percentage",
          body: "Drop in the new node, hook the same downstream pin.",
          recommended: true,
        },
        reality: {
          heading: "Returns correct, per-eye-aware density",
          body: "The replacement is dimensionless (multiply by your base scale) and respects the HMD's adaptive resolution settings introduced in 5.6.",
          outcome: "fixed",
        },
      },
    ],
  },
  {
    id: "legacy-vr-scouting",
    refId: "ref_workflow_step_legacy_virtual_scouting_tools",
    title: "Setting up Virtual Scouting",
    subtitle: "5.4–5.5 virtual production tutorials → UE 5.7 reality",
    summary:
      "Legacy VR Scouting tools were removed in 5.7. The VREditor module is also being deprecated. Use the Virtual Scouting Toolset shipped in 5.6+.",
    steps: [
      {
        tutorial: {
          heading: "Enable the VR Editor plugin",
          body: "Tutorial enables 'VR Editor' in Plugins, then restarts the editor.",
        },
        reality: {
          heading: "Plugin still loads but core scouting tools are missing",
          body: "VREditor module is deprecated alongside legacy VR Scouting. Toolbar entries for the legacy walkthrough/measure tools are gone.",
          outcome: "broken",
        },
      },
      {
        tutorial: {
          heading: "Use the legacy walkthrough widget to scout the scene",
          body: "Tutorial spawns the walkthrough actor and binds it to the VR controller.",
        },
        reality: {
          heading: "Walkthrough actor class no longer exists",
          body: "Spawning fails silently in PIE; the BP node throws a 'class not found' on compile.",
          outcome: "broken",
        },
      },
      {
        tutorial: {
          heading: "Switch to the Virtual Scouting Toolset (5.6+)",
          body: "Open Window → Virtual Production → Scouting and use the modern toolset.",
          recommended: true,
        },
        reality: {
          heading: "Modern toolset has parity + new tools",
          body: "The new Toolset includes everything the legacy walkthrough offered plus shot-list integration, timecode-aware bookmarks, and stage-monitor sync.",
          outcome: "fixed",
        },
      },
    ],
  },
];
