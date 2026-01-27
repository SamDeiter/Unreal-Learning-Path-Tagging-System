/**
 * Tag Cloud Module
 *
 * Displays a visual cloud of trending tags based on Firestore query frequency.
 * Tags are sized by popularity - more searches = larger tag.
 */

// Fallback trending data when Firestore unavailable
const DEFAULT_TRENDING_TAGS = [
  { term: "Blueprint", weight: 5, canonical: "scripting.blueprint" },
  { term: "Packaging", weight: 4, canonical: "build.packaging" },
  { term: "Lumen", weight: 4, canonical: "rendering.lumen" },
  { term: "ExitCode 25", weight: 3, canonical: "build.exitcode_25" },
  { term: "GPU Crash", weight: 3, canonical: "crash.d3d_device_lost" },
  { term: "Nanite", weight: 3, canonical: "rendering.nanite" },
  { term: "Niagara VFX", weight: 2, canonical: "rendering.niagara" },
  { term: "Multiplayer", weight: 2, canonical: "multiplayer.replication" },
  { term: "Accessed None", weight: 2, canonical: "blueprint.accessed_none" },
  { term: "MetaSounds", weight: 1, canonical: "audio.metasounds" },
  { term: "Control Rig", weight: 1, canonical: "animation.control_rig" },
  { term: "Quest VR", weight: 1, canonical: "platform.quest" },
];

/**
 * Fetch trending tags from Firestore query_logs collection
 * Groups by query term, counts frequency, returns top N with weights
 */
async function fetchTrendingFromFirestore(limit = 15) {
  if (typeof db === "undefined") {
    console.log("Firestore not available, using defaults");
    return DEFAULT_TRENDING_TAGS;
  }

  try {
    // Get queries from last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const snapshot = await db
      .collection("query_logs")
      .where("timestamp", ">=", oneWeekAgo)
      .orderBy("timestamp", "desc")
      .limit(500)
      .get();

    if (snapshot.empty) {
      return DEFAULT_TRENDING_TAGS;
    }

    // Count query frequency
    const counts = {};
    snapshot.forEach((doc) => {
      const query = doc.data().query?.toLowerCase();
      if (query && query.length > 2) {
        counts[query] = (counts[query] || 0) + 1;
      }
    });

    // Sort by frequency, take top N
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (sorted.length === 0) {
      return DEFAULT_TRENDING_TAGS;
    }

    // Calculate weights (1-5 scale)
    const maxCount = sorted[0][1];
    return sorted.map(([term, count]) => ({
      term: term.charAt(0).toUpperCase() + term.slice(1), // Capitalize
      weight: Math.ceil((count / maxCount) * 5),
      count: count,
    }));
  } catch (error) {
    console.log("Error fetching trending:", error.message);
    return DEFAULT_TRENDING_TAGS;
  }
}

/**
 * Render the tag cloud into the DOM
 */
function renderTagCloud(tags, containerId = "tagCloud") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Shuffle tags for visual variety
  const shuffled = [...tags].sort(() => Math.random() - 0.5);

  container.innerHTML = shuffled
    .map((tag, i) => {
      const hotClass = tag.weight >= 4 && i < 3 ? "hot" : "";
      return `<button 
        class="cloud-tag weight-${tag.weight} ${hotClass}" 
        onclick="addTagToBasket('${tag.term}')"
        title="${tag.count ? `${tag.count} searches` : "Popular topic"}"
      >${tag.term}</button>`;
    })
    .join("");
}

/**
 * Add a clicked tag - adds to basket for user refinement
 * Users can combine multiple tags before generating
 */
function addTagToBasket(term) {
  // Show the text input panel and add the term
  if (typeof showInputPanel === "function") {
    showInputPanel("text");
  }

  const textInput = document.getElementById("textInput");
  if (textInput) {
    textInput.value = term;
  }

  // Add to basket using existing function
  if (typeof addTextIngredient === "function") {
    addTextIngredient();
  }

  // Track the click
  if (typeof Tracker !== "undefined") {
    Tracker.trackEvent("tag_cloud_click", {
      term: term,
      action: "add_to_basket",
    });
  }
}

/**
 * Initialize the tag cloud on page load
 */
async function initTagCloud() {
  const tags = await fetchTrendingFromFirestore();
  renderTagCloud(tags);
}

// Auto-init when DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTagCloud);
} else {
  initTagCloud();
}
