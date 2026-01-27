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

// Fetch learning path from cache or API
function fetchPath(query) {
  // First try cached paths (works offline/in LMS)
  const cached = findCachedPath(query);
  if (cached) {
    fetch(`/paths/${cached.file}`)
      .then((r) => r.json())
      .then((data) => {
        document.getElementById("loading").classList.remove("active");
        currentPath = data;
        renderPath(currentPath);
        logQuery(query, true);
        console.log("Loaded from cache:", cached.file);
      })
      .catch(() => tryApiCall(query));
  } else {
    tryApiCall(query);
  }
}

function tryApiCall(query) {
  // Try Cloud Function first (works in production)
  if (typeof firebase !== "undefined" && firebase.functions) {
    const generateLearningPath = firebase
      .functions()
      .httpsCallable("generateLearningPath");

    generateLearningPath({ query: query })
      .then((result) => {
        document.getElementById("loading").classList.remove("active");
        if (result.data.success && result.data.path) {
          currentPath = result.data.path;
          renderPath(currentPath);
          logQuery(query, currentPath.steps && currentPath.steps.length > 0);
        } else {
          throw new Error("No path in response");
        }
      })
      .catch((error) => {
        console.log("Cloud Function failed, trying local API:", error.message);
        tryLocalApi(query);
      });
  } else {
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
      document.getElementById("loading").classList.remove("active");
      // Log the query even if it failed (helps identify trending requests)
      logQuery(query, false);
      alert(
        "This query isn't cached yet. Try one of the common queries like:\n\n• Lumen flickering\n• Packaging error\n• Blueprint accessed none\n\nOr run locally with: python ui/server.py",
      );
    });
}

// Log query to Firestore for analytics (optional - fails gracefully)
function logQuery(query, success) {
  if (typeof firebase !== "undefined" && firebase.firestore) {
    try {
      firebase
        .firestore()
        .collection("query_logs")
        .add({
          query: query.substring(0, 200),
          success: success,
          timestamp: new Date(),
          userAgent: navigator.userAgent.substring(0, 100),
        });
    } catch (e) {
      // Silent fail - analytics are optional
    }
  }
}
