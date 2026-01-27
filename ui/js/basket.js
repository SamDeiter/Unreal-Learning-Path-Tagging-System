/* UE5 Learning Path Builder - Problem Basket Module */

// =====================================================
// PROBLEM BASKET - Ingredient Management
// =====================================================
const MAX_INGREDIENTS = 5; // Limit for focused queries
const ingredients = [];
let currentPanel = null;
let currentScreenshot = null;

function showInputPanel(panelType) {
  const panels = ["text", "log", "screenshot", "tags"];
  const buttons = document.querySelectorAll(".input-method-btn");
  panels.forEach((p, i) => {
    const panel = document.getElementById(p + "Panel");
    const btn = buttons[i];
    if (!panel || !btn) return;
    if (p === panelType && currentPanel !== panelType) {
      panel.style.display = "flex";
      btn.classList.add("active");
      // Update dynamic suggestions when opening tags panel
      if (p === "tags" && typeof updateTagSuggestions === "function") {
        updateTagSuggestions();
      }
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

// UE5 Error Patterns for log parsing
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

// Screenshot handling
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

// Core ingredient management
function addIngredient(type, label, icon, data = null) {
  // Enforce max limit
  if (ingredients.length >= MAX_INGREDIENTS) {
    return; // Silently refuse - UI disables inputs
  }
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
  const atLimit = ingredients.length >= MAX_INGREDIENTS;

  // Disable add buttons when at limit
  document.querySelectorAll(".input-method-btn").forEach((b) => {
    b.style.opacity = atLimit ? "0.5" : "1";
    b.style.pointerEvents = atLimit ? "none" : "auto";
  });

  if (ingredients.length === 0) {
    empty.style.display = "block";
    empty.textContent = "Add up to 5 ingredients to describe your problem";
    chips.innerHTML = "";
    btn.disabled = true;
  } else {
    empty.style.display = atLimit ? "block" : "none";
    if (atLimit) {
      empty.textContent = `✓ Max ${MAX_INGREDIENTS} ingredients reached`;
      empty.style.color = "var(--success)";
    }
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

  // Load trending quick add buttons
  loadTrendingQueries();
});

// Load trending queries from Firestore or fall back to cached paths
async function loadTrendingQueries() {
  const container = document.getElementById("trendingQuickAdd");
  if (!container) return;

  let trendingTerms = [];

  // Try Firestore first (works standalone with Firebase)
  if (typeof firebase !== "undefined" && firebase.firestore) {
    try {
      const db = firebase.firestore();
      // Get queries from last 7 days, group by query, count
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const snapshot = await db
        .collection("query_logs")
        .where("timestamp", ">", oneWeekAgo)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      // Count query frequencies
      const counts = {};
      snapshot.forEach((doc) => {
        const q = doc.data().query;
        if (q && q.length > 2) {
          counts[q] = (counts[q] || 0) + 1;
        }
      });

      // Sort by count and take top 5
      trendingTerms = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term]) => term);
    } catch (e) {
      console.log(
        "Firestore trending fetch failed, using fallback:",
        e.message,
      );
    }
  }

  // Fallback: Use cached paths index (works in LMS without Firebase)
  if (trendingTerms.length === 0 && cachedPathsIndex.length > 0) {
    trendingTerms = cachedPathsIndex.slice(0, 5).map((p) => p.query);
  }

  // Final fallback: Common UE5 issues
  if (trendingTerms.length === 0) {
    trendingTerms = [
      "Packaging error",
      "Lumen flickering",
      "Blueprint Accessed None",
      "GPU crash",
      "Shader compile error",
    ];
  }

  // Render buttons
  container.innerHTML = `
    <span style="color: var(--text-muted); margin-right: 0.5rem">🔥 Trending:</span>
    ${trendingTerms
      .map(
        (term) =>
          `<button class="example-btn" onclick="quickAddIngredient('${term.replace(/'/g, "\\'")}')">${shortenTerm(term)}</button>`,
      )
      .join("")}
  `;
}

// Shorten long query terms for button display
function shortenTerm(term) {
  const words = term.split(" ");
  if (words.length > 3) {
    return words.slice(0, 2).join(" ") + "...";
  }
  return term.length > 20 ? term.substring(0, 18) + "..." : term;
}
