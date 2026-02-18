/**
 * buildGuidedCourses — Transform cart items into ordered course array for GuidedPlayer.
 *
 * Groups cart items by type:
 *   - Doc/YouTube items → standalone "reading step" pseudo-courses
 *   - Video items → grouped by courseCode with videos sorted by original index
 *
 * Pinned intro courses (100.01, 100.02) are always first.
 *
 * @param {Array} cart - Array of cart items (video, doc, or youtube)
 * @param {Array} allCourses - Full course catalog
 * @param {Array|null} microLessonSteps - Optional quick-fix steps from AI micro-lesson
 * @returns {Array} Ordered array of course objects ready for GuidedPlayer
 */
export function buildGuidedCourses(cart, allCourses, microLessonSteps = null) {
  const courseGroups = new Map(); // courseCode → { course, videos[] }
  const orderedKeys = []; // preserve first-seen order

  for (const item of cart) {
    const itemType = item.type || "video";

    // Doc or YouTube → reading step pseudo-course (standalone)
    if (itemType === "doc" || itemType === "youtube") {
      const isFirstDoc =
        orderedKeys.filter((k) => k.startsWith("_doc_")).length === 0;
      const key = `_doc_${item.itemId || item.url || item.driveId}`;
      orderedKeys.push(key);
      courseGroups.set(key, {
        course: {
          code: item.itemId || item.driveId || `${itemType}_${item.url}`,
          title: item.title,
          _readingStep: true,
          _resourceType: itemType,
          _description: item.description || "",
          _keySteps:
            isFirstDoc && microLessonSteps?.length > 0
              ? microLessonSteps
              : item.keyTakeaways || item.keySteps || [],
          _seeAlso: item.seeAlso || [],
          _url: item.url,
          _tier: item.tier,
          _channel: item.channel || item.channelName,
          _channelTrust: item.channelTrust,
          _subsystem: item.subsystem,
          _topics: item.topics || [],
          _sections: item.sections || [],
          _chapters: item.chapters || [],
          _readTimeMinutes: item.readTimeMinutes || item.durationMinutes || 10,
          videos: [],
        },
      });
      continue;
    }

    // Video → group by courseCode
    const cKey = item.courseCode;
    if (!courseGroups.has(cKey)) {
      const fullCourse = allCourses.find((c) => c.code === cKey);
      orderedKeys.push(cKey);
      courseGroups.set(cKey, {
        course: fullCourse
          ? { ...fullCourse, videos: [] }
          : { code: cKey, title: item.courseName, videos: [] },
        videos: [],
      });
    }
    courseGroups.get(cKey).videos.push({
      drive_id: item.driveId,
      title: item.title,
      duration_seconds: item.duration,
      _videoIndex: item.videoIndex ?? 999,
    });
  }

  // Sort videos within each course by original index, then attach
  const result = orderedKeys.map((key) => {
    const group = courseGroups.get(key);
    if (group.videos?.length > 0) {
      group.videos.sort((a, b) => a._videoIndex - b._videoIndex);
      group.course.videos = group.videos;
    }
    return group.course;
  });

  // Pin intro courses (100.01, 100.02) first — foundational content
  const INTRO_CODES = new Set(["100.01", "100.02"]);
  const intro = result.filter((c) => INTRO_CODES.has(c.code));
  const rest = result.filter((c) => !INTRO_CODES.has(c.code));
  return [...intro, ...rest];
}
