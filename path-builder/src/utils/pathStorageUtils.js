/**
 * pathStorageUtils.js — Helpers for persisting path data to localStorage
 *
 * Extracted from PathDashboard.jsx to comply with React Fast Refresh
 * (component files must only export components).
 */

const STORAGE_KEY = "ue5_saved_paths";

export function loadSavedPaths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePaths(paths) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/** Save/update a path in localStorage */
export function savePathToStorage(pathData) {
  const paths = loadSavedPaths();
  const idx = paths.findIndex((p) => p.id === pathData.id);
  if (idx >= 0) {
    paths[idx] = { ...paths[idx], ...pathData, updatedAt: new Date().toISOString() };
  } else {
    paths.push({
      ...pathData,
      id: pathData.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    });
  }
  savePaths(paths);
}
