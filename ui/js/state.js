/* UE5 Learning Path Builder - Centralized Application State
 * All shared mutable state lives here instead of scattered globals.
 * Loaded before all other modules.
 */

const AppState = {
  // Current learning path data (set by api.js, read by app.js)
  currentPath: null,

  // Steps the user has completed (set/read by app.js)
  completedSteps: new Set(),

  // Cached paths index from paths/index.json (set by api.js, read by app.js/basket.js)
  cachedPathsIndex: [],

  // Problem basket ingredients (set/read by basket.js)
  ingredients: [],

  // Currently active input panel (set/read by basket.js)
  currentPanel: null,

  // Current screenshot data (set/read by basket.js)
  currentScreenshot: null,
};
