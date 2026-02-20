/**
 * courseToVideos.js — Shared course-matching → path-building → video-flattening pipeline.
 *
 * Used by both useProblemFirst and useExploreFirst to convert diagnosis cartData
 * into a ranked list of drive videos + non-video items.
 *
 * @module services/courseToVideos
 */
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "./firebaseConfig";
import { matchCoursesToCart } from "../domain/courseMatching";
import { flattenCoursesToVideos } from "../domain/videoRanking";
import { buildLearningPath } from "./PathBuilder";
import { getBoostMap } from "./feedbackService";

/**
 * Match courses, build learning path, and flatten to video list.
 *
 * @param {Object} cartData - The diagnosis cart object
 * @param {Array}  courses  - Full course catalog
 * @param {Object} inputData - User input data (query, selectedTagIds, detectedTagIds, errorLog)
 * @param {Array}  semanticResults - Semantic course search results
 * @param {Object} [options]
 * @param {boolean} [options.preferTroubleshooting=false] - Prefer troubleshooting content
 * @param {string}  [options.errorLog=""] - Error log text for course matching
 * @returns {Promise<{matchedCourses: Array, driveVideos: Array, nonVideoItems: Array, allItems: Array}>}
 */
export async function matchAndFlattenToVideos(
  cartData, courses, inputData, semanticResults, options = {}
) {
  const {
    preferTroubleshooting = false,
    errorLog = "",
  } = options;

  // Fetch user's feedback boost map
  const currentUser = getAuth(getFirebaseApp()).currentUser;
  const boostMap = currentUser ? await getBoostMap(currentUser.uid) : null;

  // Match courses
  const matchedCourses = await matchCoursesToCart(
    cartData,
    courses,
    inputData.selectedTagIds || [],
    errorLog,
    semanticResults,
    boostMap
  );
  cartData.matchedCourses = matchedCourses;

  // Build learning path
  const matchedTagIds = [
    ...(cartData.diagnosis?.matched_tag_ids || []),
    ...(inputData.detectedTagIds || []),
    ...(inputData.selectedTagIds || []),
  ];
  const pathResult = buildLearningPath(matchedCourses, matchedTagIds, {
    preferTroubleshooting,
    diversity: true,
    timeBudgetMinutes: 300,
  });

  const roleMap = {};
  for (const item of pathResult.path) {
    roleMap[item.course.code] = {
      role: item.role,
      reason: item.reason,
      estimatedMinutes: item.estimatedMinutes,
    };
  }

  // Flatten to videos
  const allItems = await flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);
  const driveVideos = allItems.filter((v) => !v.type || v.type === "video");
  const nonVideoItems = allItems.filter((v) => v.type === "doc" || v.type === "youtube");

  return { matchedCourses, driveVideos, nonVideoItems, allItems };
}
