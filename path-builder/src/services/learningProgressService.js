/**
 * Learning Progress Service
 * Tracks learner progress via localStorage — foundation for spiral curriculum.
 * Stores completed paths, encountered tags, reflections, and streaks.
 */

const STORAGE_KEY = "ue5_learning_progress";

/**
 * Get the full progress object from localStorage.
 * @returns {Object} progress data
 */
export function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    return { ...getDefaultProgress(), ...JSON.parse(raw) };
  } catch {
    return getDefaultProgress();
  }
}

/**
 * Returns default empty progress structure.
 */
function getDefaultProgress() {
  return {
    completedPaths: [],
    tagsEncountered: {},
    totalVideosWatched: 0,
    reflections: [],
    streak: { lastDate: null, count: 0 },
  };
}

/**
 * Save progress object to localStorage.
 * @param {Object} progress
 */
function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn("[LearningProgress] Failed to save:", e.message);
  }
}

/**
 * Record a completed learning path.
 * Updates tags encountered, video count, streak, and optional reflection.
 *
 * @param {string} pathId - unique ID for this path (e.g. problem summary hash)
 * @param {Array} courses - array of course objects completed
 * @param {string} [reflectionText] - optional learner reflection
 */
export function recordPathCompletion(pathId, courses, reflectionText) {
  const progress = getProgress();
  const today = new Date().toISOString().split("T")[0];

  // Add path if not already recorded
  if (!progress.completedPaths.includes(pathId)) {
    progress.completedPaths.push(pathId);
  }

  // Count tags from all courses
  for (const course of courses) {
    const tags = course.extracted_tags || course.tags || [];
    for (const tag of tags) {
      const tagName = typeof tag === "string" ? tag : tag.name || tag.display_name;
      if (tagName) {
        progress.tagsEncountered[tagName] = (progress.tagsEncountered[tagName] || 0) + 1;
      }
    }
  }

  // Update video count
  progress.totalVideosWatched += courses.length;

  // Update streak
  if (progress.streak.lastDate === today) {
    // Already logged today, no change
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (progress.streak.lastDate === yesterdayStr) {
      progress.streak.count += 1;
    } else {
      progress.streak.count = 1;
    }
    progress.streak.lastDate = today;
  }

  // Save reflection if provided
  if (reflectionText && reflectionText.trim().length > 0) {
    progress.reflections.push({
      date: today,
      pathId,
      text: reflectionText.trim(),
    });
  }

  saveProgress(progress);
  return progress;
}

/**
 * Get current streak info.
 * @returns {{ count: number, isActive: boolean }}
 */
export function getStreakInfo() {
  const progress = getProgress();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const isActive = progress.streak.lastDate === today || progress.streak.lastDate === yesterdayStr;

  return {
    count: isActive ? progress.streak.count : 0,
    isActive,
  };
}

/**
 * Check if a tag has been encountered before.
 * @param {string} tagName
 * @returns {boolean}
 */
export function hasSeenTag(tagName) {
  const progress = getProgress();
  return (progress.tagsEncountered[tagName] || 0) > 0;
}
