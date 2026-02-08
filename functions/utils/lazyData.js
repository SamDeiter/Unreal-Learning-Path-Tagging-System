/**
 * Lazy Data Loader for Cloud Functions.
 *
 * Phase 8D: Centralized cold-start mitigation — loads JSON data
 * lazily on first request, caches in module-level variables so
 * subsequent invocations on the same instance are instant.
 *
 * Usage:
 *   const { lazyLoad } = require("../utils/lazyData");
 *   const getVideoCatalog = lazyLoad("data/video_catalog.json", d => d.videos || []);
 *   // In handler:
 *   const catalog = getVideoCatalog();
 */

const fs = require("fs");
const path = require("path");

/**
 * Create a lazy-loading accessor for a JSON data file.
 *
 * @param {string} relativePath - Path relative to functions/ directory
 * @param {Function} [transform] - Optional transform applied after JSON.parse
 * @param {*} [fallback=[]] - Fallback value if file can't be loaded
 * @returns {Function} Accessor that returns the cached data
 */
function lazyLoad(relativePath, transform = null, fallback = []) {
  let _cache = null;
  let _loaded = false;

  return function getData() {
    if (_loaded) return _cache;

    const possiblePaths = [
      path.join(__dirname, "..", relativePath),
      path.resolve(__dirname, "..", relativePath),
      `/workspace/functions/${relativePath}`,
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          _cache = transform ? transform(raw) : raw;
          _loaded = true;
          console.log(
            `[lazyData] Loaded ${relativePath} (${Array.isArray(_cache) ? _cache.length + " items" : "object"})`
          );
          return _cache;
        }
      } catch (e) {
        console.warn(`[lazyData] Error loading ${filePath}:`, e.message);
      }
    }

    console.warn(`[lazyData] ${relativePath} not found, using fallback`);
    _cache = fallback;
    _loaded = true;
    return _cache;
  };
}

/**
 * Pre-built accessors for common data files.
 */
const getVideoCatalog = lazyLoad("data/video_catalog.json", (d) => d.videos || [], []);

const getCuratedVideos = lazyLoad("data/curated_videos.json", null, {});

module.exports = {
  lazyLoad,
  getVideoCatalog,
  getCuratedVideos,
};
