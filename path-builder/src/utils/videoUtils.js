/**
 * Video Utilities - helpers for display formatting
 */

/**
 * Parse video filename to human-readable title
 * "219.01_01_Intro_56.mp4" → "Introduction"
 * "311.01_03_WeightMapBasedMaterials_5.00.mp4" → "Weight Map Based Materials"
 */
export function formatVideoName(filename) {
  if (!filename) return "Untitled";

  // Remove extension
  let name = filename.replace(/\.(mp4|mov|mkv|webm)$/i, "");

  // Remove version suffix like _55, _56, _5.00
  name = name.replace(/_[VvUu]?\d+\.?\d*$/, "");

  // Remove course code prefix like "219.01_01_" or "PGT_219.00_01_"
  name = name.replace(/^(PGT_)?\d+\.\d+_\d+_/, "");

  // Split camelCase and underscores
  name = name
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase
    .replace(/_/g, " ") // underscores
    .trim();

  // Capitalize first letter of each word
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format duration in seconds to human-readable
 * 864 → "14 min"
 * 3720 → "1 hr 2 min"
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${minutes} min`;
}

/**
 * Get thumbnail URL from Google Drive video
 */
export function getThumbnailUrl(video, size = 320) {
  const driveId = video?.drive_id || video?.driveId;
  if (!driveId) return null;
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${size}`;
}

/**
 * Get thumbnail for a course (uses first video)
 */
export function getCourseThumbnail(course, size = 320) {
  const firstVideo = course?.videos?.[0];
  return getThumbnailUrl(firstVideo, size);
}

/**
 * Map canonical tags to UE5 documentation URLs
 */
const UE5_DOC_LINKS = {
  "rendering.lumen":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine",
  "rendering.nanite":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine",
  "rendering.material":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-materials",
  "rendering.lighting":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/lighting-the-environment-in-unreal-engine",
  "scripting.blueprint":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine",
  "environment.landscape":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-outdoor-terrain-in-unreal-engine",
  "environment.foliage":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/foliage-mode-in-unreal-engine",
  "procedural.pcg":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview",
  "animation.general":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-animation-system-in-unreal-engine",
  "optimization.profiling":
    "https://dev.epicgames.com/documentation/en-us/unreal-engine/performance-and-profiling-in-unreal-engine",
};

/**
 * Get UE5 doc link for a canonical tag
 */
export function getDocLink(canonicalTag) {
  return UE5_DOC_LINKS[canonicalTag] || null;
}

/**
 * Get all doc links for a course's canonical tags
 */
export function getCourseDocLinks(course) {
  const tags = course?.canonical_tags || [];
  return tags.map((tag) => ({ tag, url: getDocLink(tag) })).filter((item) => item.url !== null);
}
