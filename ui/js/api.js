/* UE5 Learning Path Builder - API Module */

// Cached paths index (populated from paths/index.json)
let cachedPathsIndex = [];

// Load the paths index on page load
fetch("/paths/index.json")
  .then((r) => r.json())
  .then((data) => {
    cachedPathsIndex = data;
    populateGallery();
  })
  .catch(() => console.log("No cached paths index"));

// Find best matching cached path
function findCachedPath(query) {
  const q = query.toLowerCase();
  // First try exact match
  let match = cachedPathsIndex.find((p) => p.query.toLowerCase() === q);
  if (match) return match;
  // Then try partial match (query contains cached query term)
  match = cachedPathsIndex.find((p) => q.includes(p.query.toLowerCase()));
  if (match) return match;
  // Try if cached query contains search term
  match = cachedPathsIndex.find((p) =>
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
          currentPath = result.data.path;
          // Ensure steps array exists
          currentPath.steps = currentPath.steps || [];
          currentPath.tags = currentPath.tags || [];
          // Store usage stats for display
          if (result.data.usage) {
            currentPath.usage = result.data.usage;
          }
          renderPath(currentPath);
          logQuery(query, currentPath.steps.length > 0);
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
      currentPath = data;
      renderPath(currentPath);
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
        currentPath = data;
        renderPath(currentPath);
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

// Log query to Firestore for analytics (optional - fails gracefully)
function logQuery(query, success) {
  if (typeof firebase !== "undefined" && firebase.firestore) {
    try {
      // Use serverTimestamp() - required by security rules
      firebase
        .firestore()
        .collection("query_logs")
        .add({
          query: query.substring(0, 200),
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          // Limit to 5 fields max per security rules
          success: success,
        })
        .catch(() => {
          // Silent fail - analytics are optional
        });
    } catch (e) {
      // Silent fail - analytics are optional
    }
  }
}
