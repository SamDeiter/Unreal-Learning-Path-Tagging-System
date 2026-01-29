// Refresh Modal Functions
function showRefreshModal() {
  document.getElementById("refreshModal").style.display = "flex";
}

function closeRefreshModal() {
  document.getElementById("refreshModal").style.display = "none";
}

function copyCommand() {
  navigator.clipboard.writeText("npm run update").then(() => {
    const code = document.getElementById("updateCmd");
    const original = code.textContent;
    code.textContent = "✓ Copied!";
    code.style.color = "#3fb950";
    setTimeout(() => {
      code.textContent = original;
      code.style.color = "";
    }, 2000);
  });
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.id === "refreshModal") {
    closeRefreshModal();
  }
});

// Global state
let courses = [];
let taxonomy = {};
let selectedPath = JSON.parse(localStorage.getItem("ue5_learning_path") || "[]");
let filters = {
  search: "",
  levels: [],
  topics: [],
  industries: [],
  aiOnly: false,
};

// Chart instances (to destroy before recreating)
let chartInstances = {
  topic: null,
  level: null,
  industry: null,
  status: null,
};

// Load data
async function loadData() {
  try {
    const response = await fetch("content/video_library_enriched.json");
    const data = await response.json();
    window.libraryData = data; // Store for last_updated access
    courses = data.courses;
    taxonomy = data.taxonomy;

    initFilters();
    renderStats(data.statistics);
    renderCourses();
    updateLevelPillCounts(); // M8: show counts on level pills
    renderDashboard(); // Add dashboard rendering
    renderPath(); // Restore saved path UI
    updateTabBadge(); // Show path count in tab
  } catch (err) {
    console.error("Failed to load data:", err);
    document.getElementById("courseGrid").innerHTML =
      '<p style="color: var(--accent-red)">Failed to load course data. Make sure video_library_enriched.json exists.</p>';
  }
}

// Tab switching
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.getElementById("dashboardView").style.display = tab === "dashboard" ? "block" : "none";
  document.getElementById("builderView").style.display = tab === "builder" ? "block" : "none";
  // Remember last tab (Q7)
  localStorage.setItem("ue5_last_tab", tab);
}

// Toast notification system (M6)
function showToast(message, duration = 2500) {
  // Remove existing toast
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-green, #3fb950);
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    z-index: 10000;
    animation: toastSlideUp 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Update tab badge with path count (Q3)
function updateTabBadge() {
  const builderTab = document.querySelector('[data-tab="builder"]');
  const count = selectedPath.length;
  if (count > 0) {
    builderTab.innerHTML = `🛠️ Path Builder <span class="tab-badge">${count}</span>`;
  } else {
    builderTab.innerHTML = "🛠️ Path Builder";
  }
}

// M8: Add counts to level pills
function updateLevelPillCounts() {
  if (!courses || !courses.length) return;
  const counts = {
    Beginner: courses.filter((c) => c.tags && c.tags.level === "Beginner").length,
    Intermediate: courses.filter((c) => c.tags && c.tags.level === "Intermediate").length,
    Advanced: courses.filter((c) => c.tags && c.tags.level === "Advanced").length,
  };
  document.querySelectorAll(".level-pill").forEach((pill) => {
    const level = pill.dataset.level;
    const count = counts[level] || 0;
    // Preserve the dot and add count
    const dot = pill.querySelector(".pill-dot");
    if (dot) {
      pill.innerHTML = "";
      pill.appendChild(dot);
      pill.insertAdjacentHTML("beforeend", ` ${level} <span class="pill-count">(${count})</span>`);
    }
  });
}

// Save path to localStorage
function savePath() {
  localStorage.setItem("ue5_learning_path", JSON.stringify(selectedPath));
  updateTabBadge();
  updatePathButtons();
}

// Update path button states (Q5)
function updatePathButtons() {
  const exportBtn = document.getElementById("exportPath");
  const clearBtn = document.querySelector(".btn-clear");
  const isEmpty = selectedPath.length === 0;

  if (exportBtn) {
    exportBtn.disabled = isEmpty;
    exportBtn.style.opacity = isEmpty ? "0.5" : "1";
    exportBtn.style.cursor = isEmpty ? "not-allowed" : "pointer";
  }
  if (clearBtn) {
    clearBtn.disabled = isEmpty;
    clearBtn.style.opacity = isEmpty ? "0.5" : "1";
    clearBtn.style.cursor = isEmpty ? "not-allowed" : "pointer";
  }
}

// Render Coverage Dashboard
function renderDashboard() {
  // Show last updated timestamp
  if (window.libraryData && window.libraryData.last_updated) {
    const date = new Date(window.libraryData.last_updated);
    document.getElementById("lastUpdated").textContent =
      `Last updated: ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  }

  // Summary Cards
  const totalVideos = courses.reduce((sum, c) => sum + (c.video_count || 0), 0);
  const aiCount = courses.filter((c) => c.has_ai_tags).length;
  const withVideos = courses.filter((c) => c.video_count > 0).length;

  document.getElementById("dashboardSummary").innerHTML = `
          <div class="summary-card" title="Total number of courses in the learning library">
            <div class="value">${courses.length}</div>
            <div class="label">Total Courses</div>
          </div>
          <div class="summary-card" title="Total video files across all courses">
            <div class="value">${totalVideos}</div>
            <div class="label">Video Files</div>
          </div>
          <div class="summary-card" title="Courses that have at least one video file available">
            <div class="value">${withVideos}</div>
            <div class="label">Courses with Videos</div>
          </div>
          <div class="summary-card" title="Courses processed by AI to extract keywords, concepts, and enriched tags from video transcripts for better search and recommendations">
            <div class="value">${aiCount}</div>
            <div class="label">AI-Enriched</div>
          </div>
        `;

  // Topic Chart
  const topicCounts = {};
  courses.forEach((c) => {
    const topic = c.tags.topic || "Other";
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);

  // Chart.js defaults for dark theme
  Chart.defaults.color = "#8b949e";
  Chart.defaults.borderColor = "#30363d";

  // Topic Horizontal Bar Chart - destroy old instance first
  if (chartInstances.topic) {
    chartInstances.topic.destroy();
  }
  chartInstances.topic = new Chart(document.getElementById("topicChart"), {
    type: "bar",
    data: {
      labels: sortedTopics.map(([t]) => t),
      datasets: [
        {
          data: sortedTopics.map(([, c]) => c),
          backgroundColor: "rgba(88, 166, 255, 0.8)",
          borderColor: "#58a6ff",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#21262d",
          titleColor: "#f0f6fc",
          bodyColor: "#f0f6fc",
          borderColor: "#30363d",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(48, 54, 61, 0.5)" },
          ticks: { stepSize: 5 },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  });

  // Level Doughnut Chart
  const levelCounts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
  courses.forEach((c) => {
    const level = c.tags.level;
    if (levelCounts[level] !== undefined) levelCounts[level]++;
  });

  // Destroy old level chart instance
  if (chartInstances.level) {
    chartInstances.level.destroy();
  }
  chartInstances.level = new Chart(document.getElementById("levelChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(levelCounts),
      datasets: [
        {
          data: Object.values(levelCounts),
          backgroundColor: ["#3fb950", "#d29922", "#f85149"],
          borderColor: "#161b22",
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "60%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip: {
          backgroundColor: "#21262d",
          titleColor: "#f0f6fc",
          bodyColor: "#f0f6fc",
        },
      },
    },
  });

  // Industry Horizontal Bar Chart
  const industryCounts = {};
  courses.forEach((c) => {
    const industry = c.tags.industry || "General";
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
  });
  const sortedIndustries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);

  // Destroy old industry chart instance
  if (chartInstances.industry) {
    chartInstances.industry.destroy();
  }
  chartInstances.industry = new Chart(document.getElementById("industryChart"), {
    type: "bar",
    data: {
      labels: sortedIndustries.map(([i]) => i),
      datasets: [
        {
          data: sortedIndustries.map(([, c]) => c),
          backgroundColor: "rgba(163, 113, 247, 0.8)",
          borderColor: "#a371f7",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: "rgba(48, 54, 61, 0.5)" },
          ticks: { stepSize: 10 },
        },
        y: { grid: { display: false } },
      },
    },
  });

  // Status Doughnut Chart - destroy old instance first
  if (chartInstances.status) {
    chartInstances.status.destroy();
  }
  chartInstances.status = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: ["With Videos", "No Videos", "AI Analyzed", "Needs Analysis"],
      datasets: [
        {
          label: "Videos",
          data: [withVideos, courses.length - withVideos],
          backgroundColor: ["#3fb950", "rgba(139, 148, 158, 0.3)"],
          borderColor: "#161b22",
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
      },
    },
  });

  // Render Tag Cloud - Top 100 Tags
  const allTags = {};
  courses.forEach((c) => {
    // Collect all tag types
    if (c.tags) {
      if (c.tags.topic) allTags[c.tags.topic] = (allTags[c.tags.topic] || 0) + 1;
      if (c.tags.industry) allTags[c.tags.industry] = (allTags[c.tags.industry] || 0) + 1;
      if (c.tags.level) allTags[c.tags.level] = (allTags[c.tags.level] || 0) + 1;
    }
    // AI-generated tags
    if (c.ai_tags) {
      (c.ai_tags.keywords || []).forEach((k) => {
        allTags[k] = (allTags[k] || 0) + 1;
      });
      (c.ai_tags.concepts || []).forEach((k) => {
        allTags[k] = (allTags[k] || 0) + 1;
      });
    }
  });

  // Sort by frequency and take top 100
  const sortedTags = Object.entries(allTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  // Calculate size buckets
  const maxCount = sortedTags[0]?.[1] || 1;
  const getSize = (count) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 5;
    if (ratio > 0.4) return 4;
    if (ratio > 0.2) return 3;
    if (ratio > 0.1) return 2;
    return 1;
  };

  document.getElementById("tagCloud").innerHTML = sortedTags
    .map(
      ([tag, count]) => `
            <span class="cloud-tag size-${getSize(count)}">${tag}<span class="tag-count">(${count})</span></span>
          `
    )
    .join("");

  // Generate Coverage Recommendations
  const recommendations = [];

  // 1. Find topics with too few courses (gaps)
  const avgPerTopic = courses.length / sortedTopics.length;
  sortedTopics
    .filter(([topic, count]) => count < 3)
    .forEach(([topic, count]) => {
      recommendations.push({
        type: "gap",
        title: `${topic}: Low Coverage`,
        desc: `Only ${count} course${count === 1 ? "" : "s"} cover this topic. Consider adding more content.`,
        stat: `${count} courses`,
      });
    });

  // 2. Find missing level combinations
  const levelByTopic = {};
  courses.forEach((c) => {
    const topic = c.tags.topic || "Other";
    const level = c.tags.level;
    if (!levelByTopic[topic]) levelByTopic[topic] = new Set();
    if (level) levelByTopic[topic].add(level);
  });
  sortedTopics.slice(0, 8).forEach(([topic]) => {
    const levels = levelByTopic[topic] || new Set();
    ["Beginner", "Intermediate", "Advanced"].forEach((level) => {
      if (!levels.has(level)) {
        recommendations.push({
          type: "opportunity",
          title: `No ${level} ${topic} Course`,
          desc: `Add a ${level.toLowerCase()}-level course for ${topic} to complete the learning path.`,
          stat: "Missing level",
        });
      }
    });
  });

  // 3. Find courses without videos (needs content)
  const noVideos = courses.filter((c) => c.video_count === 0).length;
  if (noVideos > 0) {
    recommendations.push({
      type: "gap",
      title: `${noVideos} Courses Without Videos`,
      desc: "These courses may need video content added or may be legacy courses to review.",
      stat: `${Math.round((noVideos / courses.length) * 100)}% of library`,
    });
  }

  // 4. Find courses needing AI analysis
  const needsAI = courses.filter((c) => !c.has_ai_tags && c.video_count > 0).length;
  if (needsAI > 0) {
    recommendations.push({
      type: "opportunity",
      title: `${needsAI} Courses Ready for AI Tagging`,
      desc: "These courses have videos but no AI-enriched tags. Run analysis to improve discoverability.",
      stat: "Ready to analyze",
    });
  }

  // 5. Highlight strengths
  const topTopics = sortedTopics.slice(0, 3);
  recommendations.push({
    type: "strength",
    title: "Strong Topic Coverage",
    desc: `Top areas: ${topTopics.map(([t, c]) => `${t} (${c})`).join(", ")}`,
    stat: `${topTopics.reduce((s, [, c]) => s + c, 0)} courses`,
  });

  // Render recommendations (limit to 6)
  document.getElementById("recommendations").innerHTML = recommendations
    .slice(0, 6)
    .map(
      (r) => `
          <div class="recommendation-card ${r.type}">
            <div class="rec-type">${r.type === "gap" ? "⚠️ Gap" : r.type === "opportunity" ? "💡 Opportunity" : "✅ Strength"}</div>
            <div class="rec-title">${r.title}</div>
            <div class="rec-desc">${r.desc}</div>
            <span class="rec-stat">${r.stat}</span>
          </div>
        `
    )
    .join("");

  // Courses Table with pill styling
  document.getElementById("coursesTable").innerHTML = `
          <table class="courses-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Level</th>
                <th>Topic</th>
                <th>Industry</th>
                <th style="text-align:center">Videos</th>
                <th style="text-align:center">AI</th>
              </tr>
            </thead>
            <tbody>
              ${courses
                .map(
                  (c) => `
                <tr>
                  <td><strong>${c.code || "-"}</strong></td>
                  <td>${c.title}</td>
                  <td><span class="level-pill level-${(c.tags.level || "").toLowerCase()}">${c.tags.level || "-"}</span></td>
                  <td>${c.tags.topic || "-"}</td>
                  <td>${c.tags.industry || "-"}</td>
                  <td style="text-align:center"><strong>${c.video_count || 0}</strong></td>
                  <td style="text-align:center">${c.has_ai_tags ? '<span class="ai-check">✓</span>' : '<span style="color:#6e7681">—</span>'}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
}

// Initialize filter chips
function initFilters() {
  // Topic chips
  const topicCounts = {};
  courses.forEach((c) => {
    const topic = c.tags.topic || "Other";
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });

  const sortedTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const topicContainer = document.getElementById("topicChips");
  topicContainer.innerHTML = sortedTopics
    .map(
      ([topic, count]) => `
          <button class="filter-chip" data-type="topics" data-value="${topic}" onclick="toggleChip(this)">
            ${topic}<span class="chip-count">${count}</span>
          </button>
        `
    )
    .join("");

  // Industry chips
  const industryCounts = {};
  courses.forEach((c) => {
    const industry = c.tags.industry || "General";
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
  });

  const industryContainer = document.getElementById("industryChips");
  industryContainer.innerHTML = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([industry, count]) => `
            <button class="filter-chip" data-type="industries" data-value="${industry}" onclick="toggleChip(this)">
              ${industry}<span class="chip-count">${count}</span>
            </button>
          `
    )
    .join("");

  // Search
  document.getElementById("searchInput").addEventListener("input", (e) => {
    filters.search = e.target.value.toLowerCase();
    renderCourses();
    updateActiveFilters();
  });

  // AI only filter
  document.getElementById("aiOnlyFilter").addEventListener("change", (e) => {
    filters.aiOnly = e.target.checked;
    renderCourses();
    updateActiveFilters();
  });
}

// Toggle level pill
function toggleLevelPill(btn) {
  btn.classList.toggle("active");
  const level = btn.dataset.level;
  if (btn.classList.contains("active")) {
    if (!filters.levels.includes(level)) {
      filters.levels.push(level);
    }
  } else {
    filters.levels = filters.levels.filter((l) => l !== level);
  }
  renderCourses();
  updateActiveFilters();
}

// Toggle chip filter
function toggleChip(btn) {
  btn.classList.toggle("active");
  const type = btn.dataset.type;
  const value = btn.dataset.value;
  if (btn.classList.contains("active")) {
    if (!filters[type].includes(value)) {
      filters[type].push(value);
    }
  } else {
    filters[type] = filters[type].filter((v) => v !== value);
  }
  renderCourses();
  updateActiveFilters();
}

// Toggle more filters
function toggleMoreFilters() {
  const expanded = document.getElementById("filterExpanded");
  const icon = document.getElementById("moreFiltersIcon");
  if (expanded.style.display === "none") {
    expanded.style.display = "block";
    icon.textContent = "▲";
  } else {
    expanded.style.display = "none";
    icon.textContent = "▼";
  }
}

// Update active filters display
function updateActiveFilters() {
  const activeFilters = document.getElementById("activeFilters");
  const activeChips = document.getElementById("activeChips");

  const allActive = [
    ...filters.levels.map((l) => ({
      type: "levels",
      value: l,
      label: l,
    })),
    ...filters.topics.map((t) => ({
      type: "topics",
      value: t,
      label: t,
    })),
    ...filters.industries.map((i) => ({
      type: "industries",
      value: i,
      label: i,
    })),
  ];

  if (filters.aiOnly) {
    allActive.push({ type: "ai", value: true, label: "AI Only" });
  }

  if (allActive.length === 0) {
    activeFilters.style.display = "none";
    return;
  }

  activeFilters.style.display = "flex";
  activeChips.innerHTML = allActive
    .map(
      (f) => `
          <span class="active-chip">
            ${f.label}
            <button onclick="removeFilter('${f.type}', '${f.value}')">×</button>
          </span>
        `
    )
    .join("");
}

// Remove a specific filter
function removeFilter(type, value) {
  if (type === "ai") {
    filters.aiOnly = false;
    document.getElementById("aiOnlyFilter").checked = false;
  } else if (type === "levels") {
    filters.levels = filters.levels.filter((l) => l !== value);
    document.querySelector(`.level-pill[data-level="${value}"]`)?.classList.remove("active");
  } else {
    filters[type] = filters[type].filter((v) => v !== value);
    document.querySelector(`.filter-chip[data-value="${value}"]`)?.classList.remove("active");
  }
  renderCourses();
  updateActiveFilters();
}

// Clear all filters
function clearAllFilters() {
  filters.levels = [];
  filters.topics = [];
  filters.industries = [];
  filters.aiOnly = false;
  filters.search = "";

  document.querySelectorAll(".level-pill.active").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".filter-chip.active").forEach((c) => c.classList.remove("active"));
  document.getElementById("aiOnlyFilter").checked = false;
  document.getElementById("searchInput").value = "";

  renderCourses();
  updateActiveFilters();
}

// Legacy support
function updateFilter(filterType, checkbox) {
  toggleChip({
    classList: { toggle: () => {}, contains: () => checkbox.checked },
    dataset: { type: filterType, value: checkbox.value },
  });
}

// Render stats (optional - element may not exist in new layout)
function renderStats(stats) {
  const statsBar = document.getElementById("statsBar");
  if (!statsBar) return; // Stats bar removed in new horizontal layout

  const aiCount = courses.filter((c) => c.has_ai_tags).length;
  const totalVideos = courses.reduce((sum, c) => sum + (c.video_count || 0), 0);
  statsBar.innerHTML = `
        <div class="stat">
          <div class="stat-value">${stats.total_courses}</div>
          <div class="stat-label">Total Courses</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalVideos}</div>
          <div class="stat-label">Video Files</div>
        </div>
        <div class="stat">
          <div class="stat-value">${aiCount}</div>
          <div class="stat-label">AI-Enriched</div>
        </div>
        <div class="stat">
          <div class="stat-value">${Object.keys(stats.by_topic).length}</div>
          <div class="stat-label">Topics</div>
        </div>
      `;
}

// Filter courses
function getFilteredCourses() {
  return courses.filter((course) => {
    // Search filter
    if (filters.search) {
      const searchText =
        `${course.title} ${course.code} ${course.tags.topic} ${course.tags.industry}`.toLowerCase();
      if (!searchText.includes(filters.search)) return false;
    }

    // Level filter
    if (filters.levels.length > 0) {
      if (!filters.levels.includes(course.tags.level)) return false;
    }

    // Topic filter
    if (filters.topics.length > 0) {
      if (!filters.topics.includes(course.tags.topic)) return false;
    }

    // Industry filter
    if (filters.industries.length > 0) {
      if (!filters.industries.includes(course.tags.industry)) return false;
    }

    // AI only filter
    if (filters.aiOnly && !course.has_ai_tags) return false;

    return true;
  });
}

// Render course cards
function renderCourses() {
  const filtered = getFilteredCourses();
  document.getElementById("resultsCount").textContent = `${filtered.length} courses found`;

  const grid = document.getElementById("courseGrid");
  grid.innerHTML = filtered
    .map((course) => {
      const isSelected = selectedPath.find((p) => p.code === course.code);
      return `
          <div class="course-card ${isSelected ? "selected" : ""}">
            <button class="card-add-btn ${isSelected ? "remove" : ""}" onclick="event.stopPropagation(); toggleCourse('${course.code}')" title="${isSelected ? "Remove from path" : "Add to path"}">
              ${isSelected ? "✓" : "+"}
            </button>
            ${course.has_ai_tags ? '<div class="ai-badge" title="AI-enriched: This course has AI-analyzed metadata including keywords, concepts, and learning objectives">AI ✨</div>' : ""}
            <div class="course-code">${course.code || "N/A"}</div>
            <div class="course-title" onclick="openModal('${course.code}')">${course.title}</div>
            <div class="course-tags">
              <span class="tag tag-level">${course.tags.level || "Unknown"}</span>
              <span class="tag tag-topic">${course.tags.topic || "Other"}</span>
            </div>
            <div class="course-meta">
              <span>🎬 ${course.video_count || 0} videos</span>
              <span>📦 ${course.versions?.length || 0} ver</span>
              ${course.has_cc ? "<span>📝 CC</span>" : ""}
            </div>
          </div>
        `;
    })
    .join("");
}

// Toggle course in path
function toggleCourse(code) {
  const course = courses.find((c) => c.code === code);
  if (!course) return;

  const index = selectedPath.findIndex((p) => p.code === code);
  if (index >= 0) {
    selectedPath.splice(index, 1);
    showToast(`✓ Removed: ${course.title.slice(0, 30)}...`);
  } else {
    selectedPath.push(course);
    showToast(`✓ Added: ${course.title.slice(0, 30)}...`);
  }

  savePath(); // C3 - persist to localStorage
  renderPath();
  renderCourses();
}

// Render learning path - Horizontal bar version
function renderPath() {
  const list = document.getElementById("pathList");
  const countEl = document.getElementById("pathCount");
  const count = selectedPath.length;

  // Update count badge
  countEl.textContent = count;
  countEl.classList.toggle("has-items", count > 0);

  if (count === 0) {
    list.innerHTML = `<span class="path-empty-inline">Click <span class="hint-add">+</span> on courses to add</span>`;
    document.getElementById("summaryVideos").textContent = "0";
    document.getElementById("summaryDuration").textContent = "0h";
    updatePathButtons(); // Q5 - disable buttons when empty
    return;
  }

  // Calculate stats
  const totalVideos = selectedPath.reduce((sum, c) => sum + (c.video_count || 0), 0);
  const estHours = Math.round(totalVideos * 0.15);
  document.getElementById("summaryVideos").textContent = totalVideos;
  document.getElementById("summaryDuration").textContent = estHours > 0 ? `~${estHours}h` : "< 1h";

  // Render chips
  list.innerHTML = selectedPath
    .map(
      (course) => `
          <span class="path-chip">
            ${course.code || course.title.slice(0, 15)}
            <button onclick="removeCourse('${course.code}')" title="Remove">×</button>
          </span>
        `
    )
    .join("");
}

// Remove course from path
function removeCourse(code) {
  selectedPath = selectedPath.filter((c) => c.code !== code);
  renderPath();
  renderCourses();
}

// Export path
document.getElementById("exportPath").addEventListener("click", () => {
  if (selectedPath.length === 0) {
    alert("Add courses to your learning path first!");
    return;
  }

  const pathData = {
    name: "My Learning Path",
    created: new Date().toISOString(),
    courses: selectedPath.map((c, i) => ({
      order: i + 1,
      code: c.code,
      title: c.title,
      level: c.tags.level,
      topic: c.tags.topic,
      industry: c.tags.industry,
    })),
  };

  const blob = new Blob([JSON.stringify(pathData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "learning-path.json";
  a.click();
});

// Clear path function (called from inline onclick) - C2 confirmation
function clearPath() {
  if (selectedPath.length === 0) return;
  if (!confirm(`Clear all ${selectedPath.length} courses from your path?`)) return;

  selectedPath = [];
  savePath(); // C3 - persist to localStorage
  showToast("Path cleared");
  renderPath();
  renderCourses();
}

// Export videos list (optional - element may not exist)
document.getElementById("exportVideos")?.addEventListener("click", () => {
  if (selectedPath.length === 0) {
    alert("Add courses to your learning path first!");
    return;
  }

  // Collect all video files from selected courses
  const allVideos = [];
  selectedPath.forEach((course, _courseIndex) => {
    if (course.videos && course.videos.length > 0) {
      course.videos.forEach((video, _videoIndex) => {
        allVideos.push({
          order: allVideos.length + 1,
          course_code: course.code,
          course_title: course.title,
          video_name: video.name,
          video_path: video.path,
          version: video.version,
        });
      });
    }
  });

  if (allVideos.length === 0) {
    alert(
      "No video files found in selected courses.\n\nNote: Video data needs to be refreshed. Run:\nnode scripts/scan_video_library.js"
    );
    return;
  }

  // Create CSV content
  const csvHeader = "Order,Course Code,Course Title,Video Name,Video Path,Version\n";
  const csvRows = allVideos
    .map(
      (v) =>
        `${v.order},"${v.course_code}","${v.course_title}","${v.video_name}","${v.video_path}","${v.version}"`
    )
    .join("\n");
  const csvContent = csvHeader + csvRows;

  // Download CSV
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "learning-path-videos.csv";
  a.click();

  alert(`Exported ${allVideos.length} video files from ${selectedPath.length} courses!`);
});

// Show course detail modal
function showCourseDetail(code) {
  const course = courses.find((c) => c.code === code);
  if (!course) return;

  document.getElementById("modalCode").textContent = course.code || "N/A";
  document.getElementById("modalTitle").textContent = course.title;

  let bodyHTML = `
        <div class="modal-section">
          <h4>Tags</h4>
          <div class="course-tags">
            <span class="tag tag-level">${course.tags.level}</span>
            <span class="tag tag-topic">${course.tags.topic}</span>
            <span class="tag tag-industry">${course.tags.industry}</span>
            <span class="tag" style="background: rgba(88, 166, 255, 0.2); color: var(--accent-blue);">${course.tags.product}</span>
          </div>
        </div>
      `;

  if (course.ai_analysis) {
    const ai = course.ai_analysis;
    bodyHTML += `
          <div class="modal-section">
            <h4>Subtopics (AI)</h4>
            <ul>${ai.subtopics?.map((s) => `<li>${s}</li>`).join("") || "<li>None</li>"}</ul>
          </div>
          <div class="modal-section">
            <h4>UE5 Features (AI)</h4>
            <ul>${ai.ue5_features?.map((f) => `<li>${f}</li>`).join("") || "<li>None</li>"}</ul>
          </div>
          <div class="modal-section">
            <h4>Learning Objectives (AI)</h4>
            <ul>${ai.learning_objectives?.map((o) => `<li>${o}</li>`).join("") || "<li>None</li>"}</ul>
          </div>
          <div class="modal-section">
            <h4>Prerequisites (AI)</h4>
            <ul>${ai.prerequisites?.map((p) => `<li>${p}</li>`).join("") || "<li>None</li>"}</ul>
          </div>
          <div class="modal-section">
            <h4>Difficulty Notes (AI)</h4>
            <p style="font-size: 0.875rem; color: var(--text-secondary);">${ai.difficulty_notes || "No notes"}</p>
          </div>
        `;
  }

  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalOverlay").classList.add("active");

  const addBtn = document.getElementById("modalAddBtn");
  const isInPath = selectedPath.find((p) => p.code === code);
  addBtn.textContent = isInPath ? "Remove from Path" : "Add to Path";
  addBtn.onclick = () => {
    toggleCourse(code);
    closeModal();
  };
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
}

// Close modal on overlay click
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Initialize
loadData();
