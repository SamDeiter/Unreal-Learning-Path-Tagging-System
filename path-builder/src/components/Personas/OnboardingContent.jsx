/**
 * Onboarding content sub-components: Docs, YouTube, and role-grouped videos.
 * Extracted from Personas.jsx for maintainability.
 */
import React from "react";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import { ONBOARDING_ROLE_SECTIONS } from "./onboardingQuestions";

// ─────────── Inline doc + YouTube section components ───────────
export function OnboardingDocsSection({ docs, isInCart, addToCart, removeFromCart }) {
  if (!docs?.length) return null;
  return (
    <div className="blended-section">
      <div className="blended-section-header">
        <h2 className="blended-section-title">📚 Recommended Reading</h2>
        <p className="blended-section-desc">
          Official Unreal Engine documentation related to your learning path.
        </p>
      </div>
      <div className="doc-cards-grid">
        {docs.map((d, i) => {
          const docId = `doc_${d.key || i}`;
          const inCart = isInCart(docId);
          return (
            <div key={d.key || i} className={`doc-card ${inCart ? "doc-card-added" : ""}`}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="doc-card-header">
                  <span className={`tier-badge tier-${d.tier || "intermediate"}`}>
                    {d.tier || "intermediate"}
                  </span>
                  {d.subsystem && <span className="subsystem-tag">{d.subsystem}</span>}
                </div>
                <h4 className="doc-card-title">{d.label}</h4>
                {d.description && <p className="doc-card-desc">{d.description}</p>}
                <div className="doc-card-footer">
                  <span className="doc-source-badge">📄 Epic Docs</span>
                  <span className="doc-read-time">{d.readTimeMinutes || 10} min read</span>
                </div>
              </a>
              <button
                className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                onClick={() => {
                  if (inCart) {
                    removeFromCart(docId);
                  } else {
                    addToCart({
                      type: "doc",
                      itemId: docId,
                      title: d.label,
                      description: d.description || "",
                      keySteps: d.keySteps || [],
                      seeAlso: d.seeAlso || [],
                      sections: d.sections || [],
                      url: d.url,
                      tier: d.tier || "intermediate",
                      subsystem: d.subsystem,
                      readTimeMinutes: d.readTimeMinutes || 10,
                    });
                  }
                }}
                title={inCart ? "Remove from path" : "Add to learning path"}
              >
                {inCart ? "✓ Added" : "➕ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OnboardingYouTubeSection({ youtube, isInCart, addToCart, removeFromCart }) {
  if (!youtube?.length) return null;
  return (
    <div className="blended-section">
      <div className="blended-section-header">
        <h2 className="blended-section-title">📺 Official Epic YouTube</h2>
        <p className="blended-section-desc">Official Unreal Engine tutorials from Epic Games.</p>
      </div>
      <div className="doc-cards-grid">
        {youtube.map((yt) => {
          const ytId = yt.id || `yt_${yt.url}`;
          const inCart = isInCart(ytId);
          const vidMatch = yt.url?.match(/[?&]v=([^&]+)/);
          const vidId = vidMatch ? vidMatch[1] : null;
          return (
            <div
              key={yt.id}
              className={`doc-card yt-card-with-thumb ${inCart ? "doc-card-added" : ""}`}
            >
              <a
                href={yt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                {vidId && (
                  <div className="yt-thumb-wrapper">
                    <img
                      className="yt-thumb-img"
                      src={`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`}
                      alt={yt.title}
                      loading="lazy"
                    />
                    <span className="yt-thumb-duration">{yt.durationMinutes} min</span>
                    <span className="yt-thumb-play">▶</span>
                  </div>
                )}
                <div className="doc-card-header">
                  <span className={`tier-badge tier-${yt.tier || "intermediate"}`}>
                    {yt.tier || "intermediate"}
                  </span>
                  <span className="external-badge">Official • YouTube</span>
                </div>
                <h4 className="doc-card-title">{yt.title}</h4>
                <div className="doc-card-footer">
                  <span className="doc-source-badge">📺 {yt.channelName}</span>
                  <span className="doc-read-time">{yt.durationMinutes} min</span>
                </div>
              </a>
              <button
                className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                onClick={() => {
                  if (inCart) {
                    removeFromCart(ytId);
                  } else {
                    addToCart({
                      type: "youtube",
                      itemId: ytId,
                      title: yt.title,
                      description: yt.description || "",
                      keyTakeaways: yt.keyTakeaways || [],
                      chapters: yt.chapters || [],
                      topics: yt.topics || [],
                      url: yt.url,
                      channelName: yt.channelName,
                      channelTrust: yt.channelTrust,
                      tier: yt.tier || "intermediate",
                      durationMinutes: yt.durationMinutes || 15,
                    });
                  }
                }}
                title={inCart ? "Remove from path" : "Add to learning path"}
              >
                {inCart ? "✓ Added" : "➕ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Industries allowed per persona industry — courses outside these are filtered out
const INDUSTRY_ALLOW_MAP = {
  games:         ["games", "simulation", "general", ""],
  animation:     ["animation", "media & entertainment", "simulation", "general", ""],
  vfx:           ["animation", "media & entertainment", "simulation", "general", ""],
  architecture:  ["architecture", "simulation", "general", ""],
  automotive:    ["automotive", "simulation", "general", ""],
  simulation:    ["simulation", "general", ""],
  visualization: ["visualization", "simulation", "general", ""],
};

// Title-based exclusions as a safety net (industry tag might be wrong/missing)
const FILM_ONLY_TITLE_KEYWORDS = [
  "virtual production", "composure", "icvfx",
  "linear content", "datasmith", "digital twin",
  "for aec", "for architecture", "for automotive",
  "broadcast", "ndisplay", "stage operator",
];

export function OnboardingVideosByRole({
  courses,
  isInCart,
  addToCart,
  removeFromCart,
  userQuery,
  experience,
  persona,
}) {
  // Filter courses to only those relevant to the user's industry
  const pIndustry = (persona?.industry || "general").toLowerCase();
  const allowedIndustries = INDUSTRY_ALLOW_MAP[pIndustry] || null;

  const filteredCourses = allowedIndustries
    ? courses.filter((c) => {
        const cIndustry = (c.tags?.industry || "general").toLowerCase();
        const t = (c.title || c.name || "").toLowerCase();
        // Must be in allowed industry list
        if (!allowedIndustries.includes(cIndustry)) return false;
        // Safety net: also exclude by title keywords for edge cases
        if (FILM_ONLY_TITLE_KEYWORDS.some((kw) => t.includes(kw)) && pIndustry === "games")
          return false;
        return true;
      })
    : courses;
  // Build video result objects from courses — never filter out, just assign roles
  const videoResults = filteredCourses.map((course) => {
    // Clean up raw course titles for display
    let title = (course.title || course.name || "")
      .replace(/_/g, " - ")                             // underscores → dashes
      .replace(/\s*-\s*/g, " - ")                       // normalize all dashes
      .replace(/Niagar\b/gi, "Niagara")                 // fix typo
      .replace(/^(.+?) - (?:Introduction to |Quickstart )\1$/i, (_, t) => `Introduction to ${t}`)
      .replace(/^(.+?) - Introduction$/i, (_, t) => `Introduction to ${t}`)
      .replace(/^(.+?) - Quickstart (.+)$/i, (_, prefix, rest) => `${prefix} - ${rest} Quickstart`)
      .trim();

    // Defensive guard: never show a bare numeric course code as a title
    if (/^\d{3}\.\d{2}$/.test(title)) {
      const topic = course.tags?.topic || "Unreal Engine";
      title = `${topic} - Course ${title}`;
    }

    const titleLower = title.toLowerCase();
    const driveId =
      course.videos?.[0]?.drive_id || course.driveId || course.code || `course-${course.order}`;

    // Hard-filter: executive/leadership content should never show for non-exec personas
    if (
      (titleLower.includes("executive") || titleLower.includes("leadership")) &&
      !titleLower.includes("unreal") // safety: don't filter if somehow part of a real course
    ) {
      return null; // filtered out below
    }

    // Only UE5-GENERAL intros are prerequisites — topic-specific intros are core content
    const isFoundation =
      course.code?.startsWith("100") ||
      (titleLower.includes("quickstart") && !titleLower.includes("landscape") && !titleLower.includes("niagara") && !titleLower.includes("control rig")) ||
      titleLower.includes("introduction to unreal") ||
      titleLower.includes("intro to unreal") ||
      titleLower.includes("getting started") ||
      (titleLower.includes("your first") && titleLower.includes("project"));
    const role = isFoundation ? "prerequisite" : course.quickWin ? "core" : "supplemental";

    return {
      course,
      video: {
        title,
        duration: (course.duration || 45) * 60,
        driveId,
        courseCode: course.code,
        role,
        reason: course.learningOutcome || "",
        matchPercent: course.matchScore || 75,
        matchedTags: course.matchedTags || [],
      },
    };
  }).filter(Boolean);

  // Experience-aware topic priority — beginners see "Intro to UE5" first,
  // experienced users see it later (they already know the basics)
  const isBeginner = !experience || experience === "beginner";

  const topicPriority = (title) => {
    const t = title.toLowerCase();
    // Filter out executive/management content — should never be a prerequisite
    if (t.includes("executive") || t.includes("leadership") || t.includes("management overview"))
      return 99;

    if (isBeginner) {
      // Beginners: Intro to UE5 → QuickStart project → Editor → Blueprint → world-building → specialized
      if (
        t.includes("introduction to unreal") ||
        t.includes("intro to unreal") ||
        t.includes("getting started")
      )
        return 0;
      if (t.includes("quickstart") || t.includes("your first") || t.includes("first project"))
        return 1;
      if (t.includes("editor") || t.includes("viewport") || t.includes("navigate")) return 2;
      if (t.includes("blueprint") || t.includes("visual script")) return 3;
    } else {
      // Experienced: skip basic intros, lead with topic-specific content
      if (t.includes("quickstart") || t.includes("your first") || t.includes("first project"))
        return 12;
      if (
        t.includes("introduction to unreal") ||
        t.includes("intro to unreal") ||
        t.includes("getting started")
      )
        return 13;
      if (t.includes("editor") || t.includes("viewport") || t.includes("navigate")) return 11;
      if (t.includes("blueprint") || t.includes("visual script")) return 3;
    }
    // Shared ordering for all experience levels
    if (
      t.includes("landscape") ||
      t.includes("terrain") ||
      t.includes("foliage") ||
      t.includes("environment")
    )
      return 4;
    if (t.includes("material") || t.includes("texture") || t.includes("shader")) return 5;
    if (t.includes("lighting") || t.includes("lumen")) return 6;
    if (t.includes("static mesh") || t.includes("import")) return 7;
    if (t.includes("animation") || t.includes("sequencer")) return 8;
    if (t.includes("niagara") || t.includes("particle") || t.includes("vfx")) return 9;
    if (t.includes("control rig") || t.includes("rigging") || t.includes("retarget")) return 10;
    if (t.includes("metahuman") || t.includes("character")) return 11;
    return 8; // default: between general and specialized
  };

  // Group by role — with _other catch-all (matching Fix a Problem pattern)
  const grouped = {};
  for (const section of ONBOARDING_ROLE_SECTIONS) grouped[section.key] = [];
  grouped._other = [];
  for (const item of videoResults) {
    const role = item.video.role || "_other";
    (grouped[role] || grouped._other).push(item);
  }

  // Sub-sort each group: prerequisites by topic generality, others by match score
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      if (key === "prerequisite") {
        return topicPriority(a.video.title) - topicPriority(b.video.title);
      }
      return (b.video.matchPercent || 0) - (a.video.matchPercent || 0);
    });
  }

  const totalCount = videoResults.length;

  return (
    <>
      <h2 className="results-title">🎬 Videos for You ({totalCount})</h2>
      {ONBOARDING_ROLE_SECTIONS.filter((s) => grouped[s.key].length > 0).map((section) => (
        <div key={section.key} className="role-section">
          <div className="role-section-header">
            <h3 className="role-section-title">
              {section.icon} {section.label}
              <span className="role-section-count">{grouped[section.key].length}</span>
            </h3>
            <p className="role-section-desc">{section.desc}</p>
          </div>
          <div className="video-results-grid">
            {grouped[section.key].map(({ course, video }) => (
              <div
                key={video.driveId}
                className="video-result-wrapper"
                id={`video-${video.driveId}`}
              >
                <VideoResultCard
                  video={video}
                  isAdded={isInCart(video.driveId)}
                  onToggle={(v) => {
                    if (isInCart(v.driveId)) {
                      removeFromCart(v.driveId);
                    } else {
                      addToCart({
                        ...course,
                        driveId: v.driveId,
                        itemId: v.driveId,
                        title: v.title,
                        duration: v.duration,
                        type: "video",
                      });
                    }
                  }}
                  userQuery={userQuery}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {grouped._other.length > 0 && (
        <div className="role-section">
          <div className="role-section-header">
            <h3 className="role-section-title">
              📎 Related <span className="role-section-count">{grouped._other.length}</span>
            </h3>
            <p className="role-section-desc">
              Additional videos that may be relevant to your learning goals.
            </p>
          </div>
          <div className="video-results-grid">
            {grouped._other.map(({ course, video }) => (
              <div
                key={video.driveId}
                className="video-result-wrapper"
                id={`video-${video.driveId}`}
              >
                <VideoResultCard
                  video={video}
                  isAdded={isInCart(video.driveId)}
                  onToggle={(v) => {
                    if (isInCart(v.driveId)) {
                      removeFromCart(v.driveId);
                    } else {
                      addToCart({
                        ...course,
                        driveId: v.driveId,
                        itemId: v.driveId,
                        title: v.title,
                        duration: v.duration,
                        type: "video",
                      });
                    }
                  }}
                  userQuery={userQuery}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
