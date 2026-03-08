/**
 * urlHelpers.js — URL normalization utilities
 *
 * Shared helpers for fixing known broken patterns in Epic Learning Library URLs.
 */

/**
 * Normalize known broken Epic Learning URL patterns.
 * Epic's URL scheme changed from singular to plural paths at some point,
 * causing old cached/indexed URLs to 404.
 *
 * @param {string} url - The URL to normalize
 * @returns {string} The fixed URL
 */
export function fixEpicUrl(url) {
  if (!url) return url;
  return url
    .replace("/learning/tutorial/", "/learning/tutorials/")
    .replace("/learning/knowledge_base/", "/learning/knowledge-base/")
    .replace("/learning/course/", "/learning/courses/")
    .replace("/learning/talks_and_demos/", "/learning/talks-and-demos/");
}
