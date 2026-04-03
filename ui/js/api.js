/* UE5 Learning Path Builder - API Module */

// AppState.cachedPathsIndex is now in AppState (state.js)

// Load the paths index on page load
fetch("/paths/index.json")
  .then((r) => r.json())
  .then((data) => {
    AppState.cachedPathsIndex = data;
    populateGallery();
  })
  .catch(() => console.log("No cached paths index"));

// Find best matching cached path
function findCachedPath(query) {
  const q = query.toLowerCase();
  // First try exact match
  let match = AppState.cachedPathsIndex.find((p) => p.query.toLowerCase() === q);
  if (match) return match;
  // Then try partial match (query contains cached query term)
  match = AppState.cachedPathsIndex.find((p) => q.includes(p.query.toLowerCase()));
  if (match) return match;
  // Try if cached query contains search term
  match = AppState.cachedPathsIndex.find((p) =>
    p.query.toLowerCase().includes(q.split(" ")[0]),
  );
  return match;
}

// Fetch learning path - AI FIRST, cache as fallback only
function fetchPath(query) {
  // Always try AI first for fresh, up-to-date content
  tryApiCall(query);
}

function tryApiCall(query) {
  // Try Cloud Function first (works in production)
  console.log("[API] Attempting Cloud Function...");
  if (typeof firebase !== "undefined" && firebase.functions) {
    console.log("[API] Firebase available, calling generateLearningPath...");
    const generateLearningPath = firebase
      .functions()
      .httpsCallable("generateLearningPath");

    generateLearningPath({ query: query })
      .then((result) => {
        console.log("[API] Cloud Function SUCCESS:", result.data);
        document.getElementById("loading").classList.remove("active");
        if (result.data.success && result.data.path) {
          AppState.currentPath = result.data.path;
          // Ensure steps array exists
          AppState.currentPath.steps = AppState.currentPath.steps || [];
          AppState.currentPath.tags = AppState.currentPath.tags || [];
          // Store usage stats for display
          if (result.data.usage) {
            AppState.currentPath.usage = result.data.usage;
          }
          renderPath(AppState.currentPath);
          logQuery(query, AppState.currentPath.steps.length > 0);
        } else {
          throw new Error("No path in response");
        }
      })
      .catch((error) => {
        console.log("[API] Cloud Function FAILED:", error.message);
        tryLocalApi(query);
      });
  } else {
    console.log("[API] Firebase NOT available, trying local API...");
    tryLocalApi(query);
  }
}

function tryLocalApi(query) {
  // Fallback to local Python server (for development)
  fetch(`/api/generate?q=${encodeURIComponent(query)}`)
    .then((response) => {
      if (!response.ok) throw new Error("API error");
      return response.json();
    })
    .then((data) => {
      document.getElementById("loading").classList.remove("active");
      AppState.currentPath = data;
      renderPath(AppState.currentPath);
      logQuery(query, data.steps && data.steps.length > 0);
    })
    .catch((error) => {
      console.log("Local API failed, trying cache:", error.message);
      // Final fallback: try cached paths (for offline/LMS)
      tryCacheFallback(query);
    });
}

// Last resort: use cached paths if all APIs fail
function tryCacheFallback(query) {
  const cached = findCachedPath(query);
  if (cached) {
    fetch(`/paths/${cached.file}`)
      .then((r) => r.json())
      .then((data) => {
        document.getElementById("loading").classList.remove("active");
        AppState.currentPath = data;
        renderPath(AppState.currentPath);
        logQuery(query, true);
        console.log("Loaded from cache (offline fallback):", cached.file);
      })
      .catch(() => showOfflineError(query));
  } else {
    showOfflineError(query);
  }
}

function showOfflineError(query) {
  document.getElementById("loading").classList.remove("active");
  logQuery(query, false);
  alert(
    "Unable to generate path. Check your connection or try a common query like:\\n\\n• Lumen flickering\\n• Packaging error\\n• Blueprint accessed none",
  );
}

// logQuery is defined in index.html (canonical version with rate limiting + sanitization)
