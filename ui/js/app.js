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
// --- UI Control Functions ---
window.switchTab = function(tabId) {
  console.log(`Switching to tab: ${tabId}`);
  AppState.currentTab = tabId;
  
  // Update Rail Buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
    if (btn.id === `rail-tab-${tabId}`) btn.classList.add('active');
  });
  
  // Update Tab Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const activePane = document.getElementById(`pane-${tabId}`);
  if (activePane) activePane.classList.add('active');
};

window.toggleInspector = function() {
  const shell = document.querySelector('.app-shell');
  AppState.inspectorOpen = !AppState.inspectorOpen;
  if (AppState.inspectorOpen) {
    shell.classList.remove('nav-collapsed');
  } else {
    shell.classList.add('nav-collapsed');
  }
};


// AppState.currentPath and AppState.completedSteps are now in AppState (state.js)

// Simple markdown to HTML converter
function parseMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // *italic*
    .replace(/\n\n/g, "<br><br>") // paragraphs
    .replace(/⏱️/g, "<br>⏱️"); // line break before timestamp
}

// Toggle watch point checkbox with visual feedback
function toggleWatchPoint(checkbox) {
  const li = checkbox.closest(".watch-point");
  if (checkbox.checked) {
    li.classList.add("watched");
  } else {
    li.classList.remove("watched");
  }
}

// Format action text with interactive checklists
function formatActionText(text) {
  if (!text) return "";

  // Normalize escaped newlines to actual newlines
  let normalizedText = text.replace(/\\n/g, "\n");

  // Split by number pattern (1. 2. 3. etc.) and filter empty parts
  const parts = normalizedText.split(/(?=\d+\.\s)/);
  const items = parts.filter((p) => /^\d+\.\s/.test(p.trim()));

  if (items.length >= 2) {
    // Build checklist HTML
    let checklistHtml = '<ul class="action-checklist">';
    items.forEach((item) => {
      // Parse each item: "1. **Title** Description" or "1. **Title:** Description"
      const match = item.match(/^\d+\.\s*\*{0,2}([^*:]+)\*{0,2}:?\s*(.*)/s);
      if (match) {
        const title = match[1].trim();
        const desc = match[2] ? match[2].trim() : "";
        checklistHtml += `
          <li class="action-item">
            <label>
              <input type="checkbox" class="action-checkbox" onchange="trackCheckbox(this)">
              <span class="action-item-title">${title}</span>
            </label>
            ${desc ? `<p class="action-item-desc">${parseMarkdown(desc)}</p>` : ""}
          </li>`;
      }
    });
    checklistHtml += "</ul>";
    return checklistHtml;
  }

  // If not a numbered list, just return parsed markdown
  return parseMarkdown(normalizedText);
}

// Track checkbox progress
function trackCheckbox(checkbox) {
  if (typeof Tracker !== "undefined") {
    Tracker.trackEvent("action_checkbox", { checked: checkbox.checked });
  }
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

// UE5_ERROR_PATTERNS and escapeHtml are defined in ue5Patterns.js

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
      .map((t) => `<span class="extracted-tag">${escapeHtml(t)}</span>`)
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

  AppState.cachedPathsIndex.forEach((path, index) => {
    const card = document.createElement("button");
    card.className = "gallery-card";
    // Use query to generate fresh path instead of loading cached file
    card.onclick = () => loadGalleryPath(path.query);

    const popularBadge =
      index < 3 ? '<span class="popular-badge">🔥 Popular</span>' : "";

    card.innerHTML = `
      <span class="gallery-icon">${getIcon(path.query)}</span>
      <span class="gallery-title">${escapeHtml(path.query)}</span>
      <span class="gallery-steps">${escapeHtml(String(path.steps))} steps</span>
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
        AppState.AppState.currentPath = data;
        renderPath(AppState.AppState.currentPath);
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
  document.getElementById("pathTitle").textContent = "Operational Path Blueprint";

  // Build query display with AI info
  let queryHtml = `<strong>Problem:</strong> "${escapeHtml(path.query)}"`;
  if (path.ai_summary) {
    queryHtml += `<br><br>📝 <strong>What's happening:</strong> ${escapeHtml(path.ai_summary)}`;
  }
  if (path.ai_root_cause) {
    queryHtml += `<br><br>🔍 <strong>Root cause:</strong> ${escapeHtml(path.ai_root_cause)}`;
  }
  if (path.ai_estimated_time || path.ai_difficulty) {
    queryHtml += `<br><br>`;
    if (path.ai_estimated_time) queryHtml += `⏱️ ${escapeHtml(path.ai_estimated_time)} `;
    if (path.ai_difficulty) queryHtml += `| 📊 ${escapeHtml(path.ai_difficulty)}`;
  }
  if (path.ai_hint) {
    queryHtml += `<br><br>💡 <strong>Tip:</strong> ${escapeHtml(path.ai_hint)}`;
  }
  if (path.ai_what_you_learn && path.ai_what_you_learn.length > 0) {
    queryHtml += `<br><br><strong>What you'll learn:</strong><ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-muted);">`;
    path.ai_what_you_learn.forEach((item) => {
      queryHtml += `<li>${escapeHtml(item)}</li>`;
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

  // Add usage stats if available
  if (path.usage) {
    const u = path.usage;
    queryHtml += `
    <div class="usage-stats" style="margin-top: 0.75rem; padding: 0.5rem; background: var(--surface); border-radius: 6px; font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 1rem; flex-wrap: wrap;">
      <span title="Tokens used">🔢 ${u.totalTokens.toLocaleString()} tokens</span>
      <span title="Estimated API cost">💰 $${u.totalCost}</span>
      <span title="Energy used">⚡ ${u.energyKwh} kWh</span>
      <span title="CO2 equivalent">🌱 ${u.co2Grams}g CO₂</span>
    </div>
    `;
  }

  document.getElementById("pathQuery").innerHTML = queryHtml;

  // Render tags (with fallback for empty/missing)
  const tagsContainer = document.getElementById("pathTags");
  const tags = path.tags || [];
  tagsContainer.innerHTML = tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
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
          <div class="step-card" id="step-${step.number}" data-type="${escapeHtml(step.type)}">
              <div class="step-header" onclick="toggleStep(${step.number})">
                  <div class="step-number"><span>${step.number}</span></div>
                  <span class="step-type ${escapeHtml(step.type)}">${escapeHtml(step.type)}</span>
                  <span class="step-title">${escapeHtml(step.title)}</span>
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
                              ${c.thumbnail_url ? `<img src="${c.thumbnail_url}" alt="" class="content-thumbnail" onclick="playVideoFromCard(this.closest('.content-item'))" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect fill=%22%232a2a3e%22 width=%22320%22 height=%22180%22/><text x=%22160%22 y=%2290%22 text-anchor=%22middle%22 fill=%22%237a7a8a%22 font-size=%2232%22>▶ Video</text></svg>'">` : ""}
                              <div class="content-details">
                                  <div class="content-type">${escapeHtml(c.type)}</div>
                                  <div class="content-title">${escapeHtml(c.title)}</div>
                                  ${c.description ? `<p class="content-description">${parseMarkdown(c.description)}</p>` : ""}
                                  ${
                                    c.watch_points && c.watch_points.length > 0
                                      ? `
                                  <div class="watch-points">
                                      <div class="watch-points-label">📍 Key Sections to Watch:</div>
                                      <ul class="watch-points-list">
                                          ${c.watch_points
                                            .map(
                                              (wp, idx) => `
                                              <li class="watch-point">
                                                  <label class="wp-checkbox-label">
                                                      <input type="checkbox" class="wp-checkbox" onchange="toggleWatchPoint(this)">
                                                      <span class="wp-time" onclick="playVideoAtTime('${c.url}', '${wp.time}')">${wp.time}</span>
                                                      <span class="wp-label">${escapeHtml(wp.label)}</span>
                                                  </label>
                                                  ${wp.keywords ? `<span class="wp-keywords">${wp.keywords.join(", ")}</span>` : ""}
                                              </li>
                                          `,
                                            )
                                            .join("")}
                                      </ul>
                                  </div>`
                                      : ""
                                  }
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
                          <div class="action-text">${formatActionText(step.action)}</div>
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
  document.getElementById("pathSection").style.display = "block";
  renderStepTree(steps); // Populate sidebar step tree
  updateProgress();
}

function toggleStep(num) {
  const card = document.getElementById(`step-${num}`);
  card.classList.toggle("expanded");
}

function completeStep(num) {
  AppState.completedSteps.add(num);
  const card = document.getElementById(`step-${num}`);
  card.classList.add("completed");
  card.classList.remove("expanded"); // Auto-collapse on completion
  const btn = document.getElementById(`complete-${num}`);
  btn.textContent = "✓ Completed";
  btn.disabled = true;
  btn.classList.add("completed");
  updateProgress();

  // Auto-expand and scroll to next uncompleted step
  const nextStep = num + 1;
  const nextCard = document.getElementById(`step-${nextStep}`);
  if (nextCard && !AppState.completedSteps.has(nextStep)) {
    nextCard.classList.add("expanded");
    // Smooth scroll to the next step after a brief delay
    setTimeout(() => {
      nextCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }
}

function updateProgress() {
  if (!AppState.currentPath) return;
  const total = AppState.currentPath.steps.length;
  const completed = AppState.completedSteps.size;
  const percent = (completed / total) * 100;

  // Update progress bar and text (both desktop sidebar and mobile)
  const progressFill = document.getElementById("progressFill");
  const progressFillMobile = document.getElementById("progressFillMobile");
  const progressCount = document.getElementById("progressCount");
  const progressTextMobile = document.getElementById("progressTextMobile");

  if (progressFill) progressFill.style.width = percent + "%";
  if (progressFillMobile) progressFillMobile.style.width = percent + "%";
  if (progressCount) progressCount.textContent = `${completed}/${total}`;
  if (progressTextMobile)
    progressTextMobile.textContent = `Progress: ${completed}/${total} steps`;

  // Update step tree items
  AppState.currentPath.steps.forEach((step) => {
    const treeItem = document.getElementById(`tree-step-${step.number}`);
    if (treeItem) {
      treeItem.classList.toggle("completed", AppState.completedSteps.has(step.number));
      const indicator = treeItem.querySelector(".tree-indicator");
      if (indicator && AppState.completedSteps.has(step.number)) {
        indicator.textContent = "✓";
      }
    }
  });
}

// Render the step tree in the sidebar
function renderStepTree(steps) {
  const tree = document.getElementById("stepTree");
  if (!tree) return;

  tree.innerHTML = steps
    .map(
      (step) => `
      <div class="step-tree-item" id="tree-step-${step.number}" onclick="jumpToStep(${step.number})">
        <span class="tree-indicator">${step.number}</span>
        <span class="tree-label">${escapeHtml(step.title)}</span>
      </div>
    `,
    )
    .join("");
}

// Jump to a specific step
function jumpToStep(num) {
  const card = document.getElementById(`step-${num}`);
  if (card) {
    card.classList.add("expanded");
    card.scrollIntoView({ behavior: "smooth", block: "start" });

    // Highlight active in tree
    document.querySelectorAll(".step-tree-item").forEach((item) => {
      item.classList.remove("active");
    });
    const treeItem = document.getElementById(`tree-step-${num}`);
    if (treeItem) treeItem.classList.add("active");
  }
}

function sharePath() {
  const pathId = AppState.currentPath?.path_id || "";
  const query = AppState.currentPath?.query || "";

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
  const results = document.getElementById('path-results');
  const diagnostic = document.querySelector('.diagnostic-console');
  
  if (results) results.style.display = 'none';
  if (diagnostic) diagnostic.style.display = 'block';
}, "", window.location.pathname);

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
  if (!AppState.currentPath) return;

  const feedback = document.getElementById("ratingFeedback");

  // 1. Log to Firestore (primary analytics)
  if (typeof firebase !== "undefined" && firebase.firestore) {
    firebase
      .firestore()
      .collection("path_ratings")
      .add({
        path_id: AppState.currentPath.path_id || AppState.currentPath.query,
        query: AppState.currentPath.query,
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
        id: `ue5-path:${AppState.currentPath.path_id || AppState.currentPath.query}`,
        definition: {
          name: { "en-US": AppState.currentPath.title || AppState.currentPath.query },
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
      path_id: AppState.currentPath.path_id || AppState.currentPath.query,
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

/** 
 * UI Shell Controls 
 */
function switchTab(tabId) {
    AppState.currentTab = tabId;
    
    // Update Nav Rail UI
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    // Toggle Content Sections
    const sessionSection = document.querySelector('.search-section');
    const librarySection = document.getElementById('gallerySection');
    const activePathSection = document.getElementById('pathSection');
    
    // Default Hide
    if (sessionSection) sessionSection.style.display = 'none';
    if (librarySection) librarySection.style.display = 'none';
    if (activePathSection) activePathSection.style.display = 'none';

    if (tabId === 'session') {
        if (AppState.currentPath) {
            activePathSection.style.display = 'block';
        } else {
            sessionSection.style.display = 'block';
        }
    } else if (tabId === 'library') {
        librarySection.style.display = 'block';
    } else if (tabId === 'ops') {
        // Ops view - could show system metrics or patterns
        alert('System Heuristics: Monitoring UE5 Pattern Matching Engine...');
    }
}

function toggleInspector() {
    AppState.inspectorOpen = !AppState.inspectorOpen;
    const shell = document.getElementById('appShell');
    if (AppState.inspectorOpen) {
        shell.classList.remove('nav-collapsed');
    } else {
        shell.classList.add('nav-collapsed');
    }
}

// Ensure inspector elements are moved to the inspector panel
function moveSidebarToInspector() {
    const sidebar = document.getElementById('progressSidebar');
    const inspectorContent = document.getElementById('inspectorContent');
    if (sidebar && inspectorContent) {
        // Remove from original flow and move to inspector
        inspectorContent.appendChild(sidebar);
        sidebar.style.display = 'block';
        sidebar.style.position = 'static'; // Unglue from sticky
        sidebar.style.width = '100%';
    }
}

// Run on load
window.addEventListener('DOMContentLoaded', () => {
    moveSidebarToInspector();
    // Default to session tab
    switchTab('session');
    
    // Custom Terminology updates for dynamically rendered items
    const loaderText = document.querySelector('.loading-text');
    if (loaderText) loaderText.textContent = 'System Heuristics Running...';
});
\nfunction renderProgressSidebar(data) {
  const tree = document.getElementById('step-tree');
  if (!tree) return;
  
  tree.innerHTML = data.steps.map(step => `
    <div class="step-tree-item" onclick="document.getElementById('step-${step.number}').scrollIntoView({behavior: 'smooth'})">
      <span class="tree-indicator">${step.number}</span>
      <span class="tree-label">${step.title}</span>
    </div>
  `).join('');
}