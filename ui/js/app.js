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

// Extract video ID from YouTube URL
function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Play video in modal
function playVideo(url, description) {
  const videoId = getYouTubeId(url);
  if (!videoId) {
    window.open(url, "_blank");
    return;
  }

  // Try to extract START timestamp from description
  let startTime = 0;
  if (description) {
    // Check for explicit "beginning" or "0:00"
    if (/start\s*(?:at\s*)?(?:the\s*)?beginning/i.test(description)) {
      startTime = 0;
    }
    // Look for explicit "Start at X:XX" or "from X:XX"
    else {
      const startMatch = description.match(
        /(?:start|from)\s*(?:at\s*)?(\d{1,2}):(\d{2})/i,
      );
      if (startMatch) {
        startTime = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
      }
      // Fallback: look for any X:XX pattern
      else {
        const anyTimeMatch = description.match(/(\d{1,2}):(\d{2})/);
        if (anyTimeMatch) {
          startTime =
            parseInt(anyTimeMatch[1]) * 60 + parseInt(anyTimeMatch[2]);
        }
      }
    }
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${startTime}`;
  document.getElementById("videoFrame").src = embedUrl;
  document.getElementById("videoModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

// Helper to play video from content card (uses data attributes)
function playVideoFromCard(card) {
  const url = card.dataset.url;
  const desc = card.dataset.desc ? decodeURIComponent(card.dataset.desc) : "";
  playVideo(url, desc);
}

// Close video modal
function closeVideo(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("videoFrame").src = "";
  document.getElementById("videoModal").classList.remove("active");
  document.body.style.overflow = "";
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeVideo();
});

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

// =====================================================
// PROBLEM BASKET - Ingredient Management
// =====================================================
const ingredients = [];
let currentPanel = null;
let currentScreenshot = null;

function showInputPanel(panelType) {
  const panels = ["text", "log", "screenshot"];
  const buttons = document.querySelectorAll(".input-method-btn");
  panels.forEach((p, i) => {
    const panel = document.getElementById(p + "Panel");
    const btn = buttons[i];
    if (p === panelType && currentPanel !== panelType) {
      panel.style.display = "flex";
      btn.classList.add("active");
    } else {
      panel.style.display = "none";
      btn.classList.remove("active");
    }
  });
  currentPanel = currentPanel === panelType ? null : panelType;
  if (currentPanel === "text") document.getElementById("textInput").focus();
  else if (currentPanel === "log") document.getElementById("logInput").focus();
}

function addTextIngredient() {
  const input = document.getElementById("textInput");
  const text = input.value.trim();
  if (!text) return;
  addIngredient("text", text, "📝");
  input.value = "";
}

const UE5_PATTERNS = [
  { pattern: /ExitCode[=:\s]*(\d+)/i, extract: (m) => `ExitCode ${m[1]}` },
  { pattern: /ShaderCompileWorker/i, extract: () => "Shader error" },
  { pattern: /D3D\s*device\s*lost/i, extract: () => "D3D device lost" },
  { pattern: /Accessed\s*None/i, extract: () => "Accessed None" },
  { pattern: /Lumen/i, extract: () => "Lumen" },
  { pattern: /Nanite/i, extract: () => "Nanite" },
  { pattern: /packaging\s*(fail|error)/i, extract: () => "Packaging error" },
  { pattern: /Fatal\s*error/i, extract: () => "Fatal error" },
];

function addLogIngredient() {
  const textarea = document.getElementById("logInput");
  const log = textarea.value.trim();
  if (!log) return;
  const found = new Set();
  for (const { pattern, extract } of UE5_PATTERNS) {
    const match = log.match(pattern);
    if (match) found.add(extract(match));
  }
  if (found.size > 0) found.forEach((term) => addIngredient("log", term, "📋"));
  else addIngredient("log", log.split("\n")[0].substring(0, 40), "📋");
  textarea.value = "";
}

function handleScreenshotSelect(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    currentScreenshot = { data: e.target.result, name: file.name };
    document.getElementById("dropzoneContent").style.display = "none";
    document.getElementById("screenshotPreview").style.display = "block";
    document.getElementById("previewImage").src = currentScreenshot.data;
    document.getElementById("addScreenshotBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearScreenshotPreview() {
  currentScreenshot = null;
  document.getElementById("screenshotInput").value = "";
  document.getElementById("dropzoneContent").style.display = "flex";
  document.getElementById("screenshotPreview").style.display = "none";
  document.getElementById("addScreenshotBtn").disabled = true;
}

function addScreenshotIngredient() {
  if (!currentScreenshot) return;
  addIngredient("screenshot", "Screenshot", "📷", currentScreenshot.data);
  clearScreenshotPreview();
}

function addIngredient(type, label, icon, data = null) {
  const id = Date.now() + Math.random();
  ingredients.push({ id, type, label, icon, data });
  renderBasket();
}

function removeIngredient(id) {
  const idx = ingredients.findIndex((i) => i.id === id);
  if (idx !== -1) {
    ingredients.splice(idx, 1);
    renderBasket();
  }
}

function quickAddIngredient(text) {
  addIngredient("text", text, "📝");
}

function renderBasket() {
  const empty = document.getElementById("basketEmpty");
  const chips = document.getElementById("ingredientChips");
  const btn = document.getElementById("generateBtn");
  if (ingredients.length === 0) {
    empty.style.display = "block";
    chips.innerHTML = "";
    btn.disabled = true;
  } else {
    empty.style.display = "none";
    chips.innerHTML = ingredients
      .map(
        (ing) =>
          `<div class="ingredient-chip ${ing.type}-chip"><span>${ing.icon} ${ing.label}</span><button class="chip-remove" onclick="removeIngredient(${ing.id})">✕</button></div>`,
      )
      .join("");
    btn.disabled = false;
  }
}

function generateFromBasket() {
  if (ingredients.length === 0) return;
  const query = ingredients
    .filter((i) => i.type !== "screenshot")
    .map((i) => i.label)
    .join(" ");
  document.getElementById("queryInput").value = query;
  generatePath();
}

// Drag and drop for screenshots
document.addEventListener("DOMContentLoaded", () => {
  const dz = document.getElementById("screenshotDropzone");
  if (dz) {
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleScreenshotSelect({ target: { files: [file] } });
    });
  }

  // Clipboard paste support for screenshots
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Open screenshot panel if not already open
          if (currentPanel !== "screenshot") {
            showInputPanel("screenshot");
          }
          // Process the pasted image
          const reader = new FileReader();
          reader.onload = (ev) => {
            currentScreenshot = {
              data: ev.target.result,
              name: "pasted-image.png",
            };
            document.getElementById("dropzoneContent").style.display = "none";
            document.getElementById("screenshotPreview").style.display =
              "block";
            document.getElementById("previewImage").src =
              currentScreenshot.data;
            document.getElementById("addScreenshotBtn").disabled = false;
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  });
});

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
    card.onclick = () => loadGalleryPath(path.file);

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

// Load a path from the gallery
function loadGalleryPath(filename) {
  document.getElementById("loading").classList.add("active");
  document.getElementById("gallerySection").style.display = "none";

  fetch(`/paths/${filename}`)
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("loading").classList.remove("active");
      currentPath = data;
      renderPath(currentPath);
      if (typeof Tracker !== "undefined") {
        Tracker.trackEvent("path_started", {
          pathId: data.path_id,
          title: data.title,
        });
      }
    })
    .catch((err) => {
      document.getElementById("loading").classList.remove("active");
      alert("Failed to load path: " + err.message);
    });
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

function tryApiCall(query) {
  // Cache miss - try API (works only with local server)
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

function renderPath(path) {
  document.getElementById("pathTitle").textContent = "🎯 Your Learning Path";

  // Build query display with AI info
  let queryHtml = `<strong>Problem:</strong> "${path.query}"`;
  if (path.ai_summary) {
    queryHtml += `<br><br>📝 <strong>What's happening:</strong> ${path.ai_summary}`;
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
  document.getElementById("pathQuery").innerHTML = queryHtml;

  // Render tags
  const tagsContainer = document.getElementById("pathTags");
  tagsContainer.innerHTML = path.tags
    .map((t) => `<span class="tag">${t}</span>`)
    .join("");

  // Render steps
  const stepsContainer = document.getElementById("stepsContainer");
  stepsContainer.innerHTML = path.steps
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
  btn.style.background = "var(--success)";
  btn.style.opacity = "0.8";
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

// Enter key support
document
  .getElementById("queryInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") generatePath();
  });
