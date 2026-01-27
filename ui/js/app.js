/* UE5 Learning Path Builder - Main App */

// Sample learning path data (would come from backend API)
const samplePaths = {
  packaging: {
    title: "Fix UE5 Packaging Errors",
    query: "UE5 packaging error ExitCode 25",
    tags: ["build.packaging", "build.exitcode_25", "build.cooking"],
    steps: [
      {
        number: 1,
        type: "foundations",
        title: "Understand the Build Pipeline",
        description:
          "Learn how UE5 packages and cooks content before diving into fixes.",
        content: [
          {
            type: "video",
            title: "UE5 Packaging Complete Guide",
            url: "https://youtube.com/watch?v=example1",
          },
          {
            type: "docs",
            title: "Cooking Content - Epic Docs",
            url: "https://dev.epicgames.com/documentation",
          },
        ],
      },
      {
        number: 2,
        type: "diagnostics",
        title: "Diagnose Exit Code 25",
        description:
          "Understand what causes Unknown Cook Failure and how to read logs.",
        content: [
          {
            type: "video",
            title: "Reading UE5 Build Logs",
            url: "https://youtube.com/watch?v=example2",
          },
          {
            type: "forum",
            title: "ExitCode 25 Common Causes",
            url: "https://forums.unrealengine.com",
          },
        ],
      },
      {
        number: 3,
        type: "resolution",
        title: "Apply the Fix",
        description:
          "Step-by-step solutions for the most common packaging failures.",
        content: [
          {
            type: "video",
            title: "Fix ExitCode 25 - Complete Solution",
            url: "https://youtube.com/watch?v=example3",
          },
          {
            type: "video",
            title: "Asset Naming Conventions",
            url: "https://youtube.com/watch?v=example4",
          },
        ],
      },
      {
        number: 4,
        type: "prevention",
        title: "Prevent Future Issues",
        description:
          "Best practices to avoid packaging errors in your projects.",
        content: [
          {
            type: "video",
            title: "UE5 Project Organization Tips",
            url: "https://youtube.com/watch?v=example5",
          },
          {
            type: "docs",
            title: "Asset Management Best Practices",
            url: "https://dev.epicgames.com/documentation",
          },
        ],
      },
    ],
  },
};

let currentPath = null;
let completedSteps = new Set();

// Simple markdown to HTML converter
function parseMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // *italic*
    .replace(/\n\n/g, "<br><br>") // paragraphs
    .replace(/⏱️/g, "<br>⏱️"); // line break before timestamp
}

// [REFACTORED] Code from lines 103-167 moved to modules

function setQuery(query) {
  document.getElementById("queryInput").value = query;
}

// Toggle crash log textarea visibility
function toggleCrashLog() {
  const container = document.getElementById("crashlogContainer");
  const isVisible = container.style.display !== "none";
  container.style.display = isVisible ? "none" : "block";
  if (!isVisible) {
    document.getElementById("crashLogInput").focus();
  }
}

// UE5 Error Patterns for parsing crash logs
const UE5_ERROR_PATTERNS = [
  {
    pattern: /ExitCode[=:\s]*(\d+)/i,
    type: "exitcode",
    extract: (m) => `ExitCode ${m[1]}`,
  },
  {
    pattern: /Error[:\s]+([A-Z]+\d+)/i,
    type: "linker",
    extract: (m) => m[1],
  },
  {
    pattern: /ShaderCompileWorker/i,
    type: "shader",
    extract: () => "Shader compilation error",
  },
  {
    pattern: /D3D\s*device\s*lost/i,
    type: "gpu",
    extract: () => "D3D device lost",
  },
  { pattern: /GPU\s*crash/i, type: "gpu", extract: () => "GPU crash" },
  {
    pattern: /Accessed\s*None/i,
    type: "blueprint",
    extract: () => "Blueprint Accessed None",
  },
  {
    pattern: /cook\s*(fail|error)/i,
    type: "cook",
    extract: () => "Cook failure",
  },
  {
    pattern: /packaging\s*(fail|error)/i,
    type: "packaging",
    extract: () => "Packaging error",
  },
  { pattern: /Lumen/i, type: "lumen", extract: () => "Lumen issue" },
  { pattern: /Nanite/i, type: "nanite", extract: () => "Nanite issue" },
  {
    pattern: /replication|multiplayer|net/i,
    type: "network",
    extract: () => "Network/replication",
  },
  {
    pattern: /Fatal\s*error/i,
    type: "fatal",
    extract: () => "Fatal error",
  },
  {
    pattern: /LogCore:\s*Error/i,
    type: "core",
    extract: () => "Core error",
  },
  {
    pattern: /out\s*of\s*(memory|video\s*memory)/i,
    type: "memory",
    extract: () => "Out of memory",
  },
];

// Parse crash log and extract key terms
function parseCrashLog() {
  const logInput = document.getElementById("crashLogInput").value.trim();
  if (!logInput) {
    alert("Please paste a crash log or error output first.");
    return;
  }

  const extractedTerms = [];
  const seenTypes = new Set();

  // Run all patterns
  for (const { pattern, type, extract } of UE5_ERROR_PATTERNS) {
    const match = logInput.match(pattern);
    if (match && !seenTypes.has(type)) {
      extractedTerms.push(extract(match));
      seenTypes.add(type);
    }
  }

  // Display extracted tags
  const tagsContainer = document.getElementById("extractedTags");
  if (extractedTerms.length > 0) {
    tagsContainer.innerHTML = extractedTerms
      .map((t) => `<span class="extracted-tag">${t}</span>`)
      .join("");

    // Build query from extracted terms
    const query = extractedTerms.slice(0, 3).join(" ");
    document.getElementById("queryInput").value = query;

    // Auto-generate the path
    generatePath();
  } else {
    tagsContainer.innerHTML =
      '<span class="extracted-tag" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">No patterns found - try describing the issue</span>';
  }
}

// [REFACTORED] Code from lines 284-554 moved to modules

// [REFACTORED] Code from lines 556-581 moved to modules

// Populate the gallery with cached paths
function populateGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  grid.innerHTML = ""; // Clear existing cards

  // Icon mapping based on query keywords
  const getIcon = (query) => {
    const q = query.toLowerCase();
    if (q.includes("lumen")) return "💡";
    if (q.includes("nanite")) return "🔷";
    if (q.includes("blueprint")) return "📘";
    if (q.includes("crash") || q.includes("gpu") || q.includes("d3d"))
      return "💥";
    if (q.includes("packaging") || q.includes("cook")) return "📦";
    if (q.includes("exit")) return "⚠️";
    return "🎯";
  };

  cachedPathsIndex.forEach((path, index) => {
    const card = document.createElement("button");
    card.className = "gallery-card";
    // Use query to generate fresh path instead of loading cached file
    card.onclick = () => loadGalleryPath(path.query);

    const popularBadge =
      index < 3 ? '<span class="popular-badge">🔥 Popular</span>' : "";

    card.innerHTML = `
      <span class="gallery-icon">${getIcon(path.query)}</span>
      <span class="gallery-title">${path.query}</span>
      <span class="gallery-steps">${path.steps} steps</span>
      ${popularBadge}
    `;

    grid.appendChild(card);
  });

  // Show gallery section
  document.getElementById("gallerySection").style.display = "block";
}

// Load a path from the gallery - generates fresh AI path
function loadGalleryPath(query) {
  // Set the query input and trigger fresh generation
  document.getElementById("queryInput").value = query;
  generatePath();
}

function generatePath() {
  const query = document.getElementById("queryInput").value.trim();
  if (!query) return;

  // Show loading
  document.getElementById("loading").classList.add("active");
  document.getElementById("pathSection").classList.remove("active");
  document.getElementById("gallerySection").style.display = "none";

  // Try to find matching cached path
  const cached = findCachedPath(query);

  if (cached) {
    fetch(`/paths/${cached.file}`)
      .then((response) => {
        if (!response.ok) throw new Error("Cache miss");
        return response.json();
      })
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

// [REFACTORED] Code from lines 680-728 moved to modules

function renderPath(path) {
  document.getElementById("pathTitle").textContent = "🎯 Your Learning Path";

  // Build query display with AI info
  let queryHtml = `<strong>Problem:</strong> "${path.query}"`;
  if (path.ai_summary) {
    queryHtml += `<br><br>📝 <strong>What's happening:</strong> ${path.ai_summary}`;
  }
  if (path.ai_root_cause) {
    queryHtml += `<br><br>🔍 <strong>Root cause:</strong> ${path.ai_root_cause}`;
  }
  if (path.ai_estimated_time || path.ai_difficulty) {
    queryHtml += `<br><br>`;
    if (path.ai_estimated_time) queryHtml += `⏱️ ${path.ai_estimated_time} `;
    if (path.ai_difficulty) queryHtml += `| 📊 ${path.ai_difficulty}`;
  }
  if (path.ai_hint) {
    queryHtml += `<br><br>💡 <strong>Tip:</strong> ${path.ai_hint}`;
  }
  if (path.ai_what_you_learn && path.ai_what_you_learn.length > 0) {
    queryHtml += `<br><br><strong>What you'll learn:</strong><ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-muted);">`;
    path.ai_what_you_learn.forEach((item) => {
      queryHtml += `<li>${item}</li>`;
    });
    queryHtml += `</ul>`;
  }

  // Add rating buttons
  queryHtml += `
    <div class="path-rating" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
      <span style="color: var(--text-muted); margin-right: 0.5rem;">Was this helpful?</span>
      <button class="rate-btn" onclick="ratePath('up')" title="Helpful">👍</button>
      <button class="rate-btn" onclick="ratePath('down')" title="Not helpful">👎</button>
      <span id="ratingFeedback" style="margin-left: 0.5rem; color: var(--success);"></span>
    </div>
  `;

  document.getElementById("pathQuery").innerHTML = queryHtml;

  // Render tags (with fallback for empty/missing)
  const tagsContainer = document.getElementById("pathTags");
  const tags = path.tags || [];
  tagsContainer.innerHTML = tags
    .map((t) => `<span class="tag">${t}</span>`)
    .join("");

  // Render steps (with fallback for empty/missing)
  const stepsContainer = document.getElementById("stepsContainer");
  const steps = path.steps || [];
  if (steps.length === 0) {
    stepsContainer.innerHTML =
      '<p style="color: var(--text-muted);">No steps generated. Try a more specific query.</p>';
    return;
  }
  stepsContainer.innerHTML = steps
    .map(
      (step) => `
          <div class="step-card" id="step-${step.number}" data-type="${step.type}">
              <div class="step-header" onclick="toggleStep(${step.number})">
                  <div class="step-number"><span>${step.number}</span></div>
                  <span class="step-type ${step.type}">${step.type}</span>
                  <span class="step-title">${step.title}</span>
                  <span class="step-toggle">▼</span>
              </div>
              <div class="step-content">
                  <p class="step-description">${step.description.split("\n\n👉")[0]}</p>
                  <div class="content-list">
                      ${step.content
                        .map((c) => {
                          const safeDesc = encodeURIComponent(
                            c.description || "",
                          );
                          return `
                          <div class="content-item" data-url="${c.url}" data-desc="${safeDesc}">
                              ${c.thumbnail_url ? `<img src="${c.thumbnail_url}" alt="" class="content-thumbnail" onclick="playVideoFromCard(this.closest('.content-item'))">` : ""}
                              <div class="content-details">
                                  <div class="content-type">${c.type}</div>
                                  <div class="content-title">${c.title}</div>
                                  ${c.description ? `<p class="content-description">${parseMarkdown(c.description)}</p>` : ""}
                                  <div class="content-actions">
                                      ${c.type.toLowerCase() === "video" ? `<button class="watch-btn" onclick="playVideoFromCard(this.closest('.content-item'))">▶ Watch</button>` : ""}
                                      <a href="${c.url}" target="_blank" class="content-link">Open Resource ↗</a>
                                  </div>
                              </div>
                          </div>`;
                        })
                        .join("")}
                  </div>
                  ${
                    step.action
                      ? `
                  <div class="action-box" style="margin-top: 1rem;">
                      <span class="action-icon">👉</span>
                      <div>
                          <div class="action-label">Your Action</div>
                          <div class="action-text">${step.action}</div>
                      </div>
                  </div>
                  `
                      : ""
                  }
                  <button class="complete-btn" onclick="completeStep(${step.number})"
                          id="complete-${step.number}" style="margin-top: 1rem;">
                      ✓ Mark Complete
                  </button>
              </div>
          </div>
      `,
    )
    .join("");

  document.getElementById("pathSection").classList.add("active");
  updateProgress();
}

function toggleStep(num) {
  const card = document.getElementById(`step-${num}`);
  card.classList.toggle("expanded");
}

function completeStep(num) {
  completedSteps.add(num);
  const card = document.getElementById(`step-${num}`);
  card.classList.add("completed");
  const btn = document.getElementById(`complete-${num}`);
  btn.textContent = "✓ Completed";
  btn.disabled = true;
  btn.classList.add("completed");
  updateProgress();
}

function updateProgress() {
  if (!currentPath) return;
  const total = currentPath.steps.length;
  const completed = completedSteps.size;
  const percent = (completed / total) * 100;

  document.getElementById("progressText").textContent =
    `Progress: ${completed}/${total} steps`;
  document.getElementById("progressFill").style.width = percent + "%";
}

function sharePath() {
  const pathId = currentPath?.path_id || "";
  const query = currentPath?.query || "";

  // Use path_id for exact path sharing, fallback to query
  const shareUrl = pathId
    ? `${window.location.origin}${window.location.pathname}?pathId=${encodeURIComponent(pathId)}`
    : `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(query)}`;

  navigator.clipboard
    .writeText(shareUrl)
    .then(() => {
      alert(
        "Link copied to clipboard! 🔗\n\nShare this URL with others:\n" +
          shareUrl,
      );
    })
    .catch(() => {
      prompt("Copy this URL to share:", shareUrl);
    });
}

function goBackToSearch() {
  // Clear URL params
  window.history.pushState({}, "", window.location.pathname);

  // Hide path section
  document.getElementById("pathSection").classList.remove("active");

  // Show gallery
  document.getElementById("gallerySection").style.display = "block";

  // Clear search input
  document.getElementById("queryInput").value = "";

  // Track navigation if available
  if (typeof Tracker !== "undefined") {
    Tracker.trackEvent("navigation", { action: "back_to_search" });
  }
}

// Rate the current learning path (thumbs up/down)
function ratePath(rating) {
  if (!currentPath) return;

  const feedback = document.getElementById("ratingFeedback");

  // 1. Log to Firestore (primary analytics)
  if (typeof firebase !== "undefined" && firebase.firestore) {
    firebase
      .firestore()
      .collection("path_ratings")
      .add({
        path_id: currentPath.path_id || currentPath.query,
        query: currentPath.query,
        rating: rating, // 'up' or 'down'
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(() => {
        console.log("Rating logged to Firestore:", rating);
      })
      .catch((e) => {
        console.log("Firestore rating log failed:", e.message);
      });
  }

  // 2. Log to xAPI (LMS analytics - for SCORM integration)
  if (typeof xAPIWrapper !== "undefined" && xAPIWrapper.sendStatement) {
    const statement = {
      verb: {
        id:
          rating === "up"
            ? "http://adlnet.gov/expapi/verbs/liked"
            : "http://adlnet.gov/expapi/verbs/disliked",
        display: { "en-US": rating === "up" ? "liked" : "disliked" },
      },
      object: {
        id: `ue5-path:${currentPath.path_id || currentPath.query}`,
        definition: {
          name: { "en-US": currentPath.title || currentPath.query },
          type: "http://adlnet.gov/expapi/activities/assessment",
        },
      },
      result: {
        response: rating,
        success: rating === "up",
      },
    };
    xAPIWrapper.sendStatement(statement);
    console.log("Rating logged to xAPI:", rating);
  }

  // 3. Log to internal Tracker (if available)
  if (typeof Tracker !== "undefined") {
    Tracker.trackEvent("path_rating", {
      path_id: currentPath.path_id || currentPath.query,
      rating: rating,
    });
  }

  // Update UI
  if (rating === "up") {
    feedback.textContent = "Thanks for the feedback! 🎉";
    feedback.style.color = "var(--success)";
  } else {
    feedback.textContent = "We'll work on improving this.";
    feedback.style.color = "var(--text-muted)";
  }

  // Disable buttons after rating
  document.querySelectorAll(".rate-btn").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
  });
}

// Enter key support
document
  .getElementById("queryInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") generatePath();
  });
