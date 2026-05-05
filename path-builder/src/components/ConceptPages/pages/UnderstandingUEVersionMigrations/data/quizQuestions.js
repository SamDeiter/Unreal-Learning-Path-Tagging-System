/**
 * QUIZ_QUESTIONS — five retrieval-practice questions for the version-migration
 * concept page. Authored from the verified deltas; answers are checked against
 * `correct` (for MC and T/F) or against the canonical pairing (for match).
 *
 * Question shapes:
 *   { kind: "mc",    prompt, options: [{ id, label }], correct, explain }
 *   { kind: "tf",    prompt, correct: true|false, explain }
 *   { kind: "match", prompt, pairs: [{ left, right, explain? }] }
 */
export const QUIZ_QUESTIONS = [
  {
    id: "q1-match-replacements",
    kind: "match",
    prompt:
      "Drag each deprecated 5.6 API to its UE 5.7 replacement. Three pairs.",
    pairs: [
      {
        left: "Get Pixel Density",
        right: "Get HMD Secondary Screen Percentage",
        explain:
          "The legacy Blueprint node returned inconsistent values on modern HMDs; the replacement respects per-eye adaptive resolution.",
      },
      {
        left: "BodyFitOptions",
        right: "ConformBodyParams",
        explain:
          "BodyFitOptions was renamed and restructured for the 5.7 MetaHuman Creator pipeline.",
      },
      {
        left: "UnrealStats",
        right: "UnrealInsights",
        explain:
          "UnrealInsights replaces UnrealStats with a navigable timeline, comparison view, and richer event capture.",
      },
    ],
  },
  {
    id: "q2-mc-deprecated-meaning",
    kind: "mc",
    prompt:
      "When the UE release notes mark something as 'deprecated', what should you assume?",
    options: [
      { id: "a", label: "It was removed in this release; existing code will fail to compile." },
      {
        id: "b",
        label:
          "It still works in this release but is scheduled for removal — migrate before then.",
      },
      { id: "c", label: "It's a bug that will be fixed in a hotfix." },
      { id: "d", label: "It only applies to mobile builds." },
    ],
    correct: "b",
    explain:
      "Deprecated means 'still functional, but on the way out.' Removed (a stronger label) means it's gone. iAD framework, for example, was removed in 5.7 — not just deprecated.",
  },
  {
    id: "q3-mc-most-exposure",
    kind: "mc",
    prompt:
      "Which deprecated 5.6 workflow appears in the most videos across our learning library?",
    options: [
      { id: "a", label: "Legacy Virtual Scouting Tools" },
      { id: "b", label: "MetaHuman Capture Manager" },
      { id: "c", label: "UnrealStats / .uestats workflow" },
      { id: "d", label: "BodyFitOptions class" },
    ],
    correct: "c",
    explain:
      "UnrealStats is referenced in 14 videos — the highest exposure of any verified delta. That's why migrating to UnrealInsights is the highest-leverage upgrade for our content.",
  },
  {
    id: "q4-tf-vreditor-removed",
    kind: "tf",
    prompt:
      "True or false: the VREditor module has been REMOVED in UE 5.7.",
    correct: false,
    explain:
      "False — VREditor is *deprecated* in 5.7, not removed. It still loads, but core scouting tools are gone and the module is scheduled for removal in a future release. The distinction matters: deprecated APIs still work (with a warning); removed APIs fail outright.",
  },
  {
    id: "q5-mc-iad-removal",
    kind: "mc",
    prompt:
      "Why was the iAD framework removed (not just deprecated) in UE 5.7?",
    options: [
      { id: "a", label: "Apple deprecated the underlying advertising service." },
      { id: "b", label: "It was redundant with Steam ads." },
      { id: "c", label: "It conflicted with the new Substrate lighting system." },
      { id: "d", label: "It was a security vulnerability." },
    ],
    correct: "a",
    explain:
      "Apple shut down iAD on its end, so UE removed the framework outright. When upstream platforms remove a service, Epic skips the deprecation period and removes the integration in the next release.",
  },
];
