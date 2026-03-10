/**
 * Centralized course duration calculation.
 *
 * Video data stores duration as `duration_seconds`.
 * Many components previously referenced `duration_minutes` (which doesn't exist),
 * causing every course to fall back to 30 min.
 *
 * This utility:
 * 1. Sums `duration_seconds` across all videos → converts to minutes
 * 2. Falls back to `duration_minutes` at the course level (if set)
 * 3. Uses a sensible per-course fallback (5 min) instead of 30
 */

const DEFAULT_COURSE_MINUTES = 5;

/**
 * Get total duration in minutes for a course.
 * @param {Object} course - Course object from video library
 * @param {number} [fallback=5] - Fallback minutes if no duration data
 * @returns {number} Duration in minutes (rounded)
 */
export function getCourseDurationMinutes(course, fallback = DEFAULT_COURSE_MINUTES) {
  if (!course) return fallback;

  // 1. Sum video durations (stored as duration_seconds)
  if (course.videos?.length) {
    const totalSeconds = course.videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
    if (totalSeconds > 0) return Math.round(totalSeconds / 60);
  }

  // 2. Check course-level duration_minutes (some enriched data may have this)
  if (course.duration_minutes > 0) return course.duration_minutes;

  // 3. Check total_duration_minutes
  if (course.total_duration_minutes > 0) return course.total_duration_minutes;

  return fallback;
}
