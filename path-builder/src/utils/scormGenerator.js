/**
 * SCORM 1.2 Package Generator
 * Creates downloadable SCORM-compliant course packages
 */
import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * Generate and download a SCORM 1.2 package
 * @param {Object} course - Course object with videos and metadata
 */
export async function generateScormPackage(course) {
  const zip = new JSZip();

  // Create imsmanifest.xml
  zip.file("imsmanifest.xml", generateManifest(course));

  // Create shared SCORM API wrapper
  const shared = zip.folder("shared");
  shared.file("scorm_api.js", generateScormApi());
  shared.file("styles.css", generateStyles());

  // Create SCO for each video
  course.videos.forEach((video, index) => {
    const scoFolder = zip.folder(`sco_${String(index + 1).padStart(2, "0")}`);
    scoFolder.file("index.html", generateScoHtml(video));
    scoFolder.file("content.json", JSON.stringify(video, null, 2));
  });

  // Create course overview page
  zip.file("index.html", generateOverviewHtml(course));

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${sanitizeFilename(course.title)}_SCORM.zip`;
  saveAs(blob, filename);

  return filename;
}

/**
 * Generate SCORM 1.2 imsmanifest.xml
 */
function generateManifest(course) {
  const items = course.videos
    .map((video, index) => {
      const scoId = `SCO_${String(index + 1).padStart(3, "0")}`;
      return `
      <item identifier="${scoId}" identifierref="${video.scormResourceId}">
        <title>${escapeXml(video.title)}</title>
      </item>`;
    })
    .join("");

  const resources = course.videos
    .map((video, index) => {
      const scoFolder = `sco_${String(index + 1).padStart(2, "0")}`;
      return `
      <resource identifier="${video.scormResourceId}" type="webcontent" adlcp:scormtype="sco" href="${scoFolder}/index.html">
        <file href="${scoFolder}/index.html"/>
        <file href="${scoFolder}/content.json"/>
        <dependency identifierref="SHARED_FILES"/>
      </resource>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${course.id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  
  <organizations default="ORG_001">
    <organization identifier="ORG_001">
      <title>${escapeXml(course.title)}</title>
      ${items}
    </organization>
  </organizations>
  
  <resources>
    ${resources}
    <resource identifier="SHARED_FILES" type="webcontent" adlcp:scormtype="asset">
      <file href="shared/scorm_api.js"/>
      <file href="shared/styles.css"/>
    </resource>
  </resources>
</manifest>`;
}

/**
 * Generate SCORM API JavaScript wrapper
 */
function generateScormApi() {
  return `/**
 * SCORM 1.2 API Wrapper
 */
var SCORM = {
  api: null,
  
  findAPI: function(win) {
    var attempts = 0;
    while ((!win.API) && (win.parent) && (win.parent != win) && (attempts < 10)) {
      win = win.parent;
      attempts++;
    }
    return win.API || null;
  },
  
  init: function() {
    this.api = this.findAPI(window);
    if (this.api) {
      this.api.LMSInitialize("");
      return true;
    }
    console.warn("SCORM API not found - running standalone");
    return false;
  },
  
  complete: function() {
    if (this.api) {
      this.api.LMSSetValue("cmi.core.lesson_status", "completed");
      this.api.LMSCommit("");
    }
  },
  
  setScore: function(score) {
    if (this.api) {
      this.api.LMSSetValue("cmi.core.score.raw", score);
      this.api.LMSSetValue("cmi.core.score.min", "0");
      this.api.LMSSetValue("cmi.core.score.max", "100");
      this.api.LMSCommit("");
    }
  },
  
  setLocation: function(location) {
    if (this.api) {
      this.api.LMSSetValue("cmi.core.lesson_location", location);
      this.api.LMSCommit("");
    }
  },
  
  getLocation: function() {
    if (this.api) {
      return this.api.LMSGetValue("cmi.core.lesson_location");
    }
    return "";
  },
  
  finish: function() {
    if (this.api) {
      this.api.LMSFinish("");
    }
  }
};

// Initialize on load
window.addEventListener("load", function() {
  SCORM.init();
});

// Finish on unload
window.addEventListener("beforeunload", function() {
  SCORM.finish();
});
`;
}

/**
 * Generate SCO HTML page for a video
 */
function generateScoHtml(video) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(video.title)}</title>
  <link rel="stylesheet" href="../shared/styles.css">
  <script src="../shared/scorm_api.js"></script>
</head>
<body>
  <div class="sco-container">
    <header class="sco-header">
      <h1>${escapeHtml(video.title)}</h1>
      <p class="duration">Duration: ${video.duration}</p>
    </header>
    
    <main class="sco-content">
      <div class="video-placeholder">
        <p>Video: ${escapeHtml(video.title)}</p>
        <p class="video-note">Configure your LMS to embed video content from Google Drive or your video hosting platform.</p>
        <p class="video-id">Video ID: ${video.id}</p>
      </div>
      
      ${video.quiz ? generateQuizHtml(video.quiz) : ""}
    </main>
    
    <footer class="sco-footer">
      <button id="complete-btn" class="btn-complete" onclick="markComplete()">
        Mark as Complete
      </button>
    </footer>
  </div>
  
  <script>
    function markComplete() {
      SCORM.complete();
      document.getElementById('complete-btn').textContent = '✓ Completed';
      document.getElementById('complete-btn').disabled = true;
    }
  </script>
</body>
</html>`;
}

/**
 * Generate quiz HTML if quiz questions exist
 */
function generateQuizHtml(quiz) {
  if (!quiz || quiz.length === 0) return "";

  const questionsHtml = quiz
    .map(
      (q, i) => `
    <div class="quiz-question" data-index="${i}">
      <p class="question-text">${i + 1}. ${escapeHtml(q.question)}</p>
      <div class="options">
        ${q.options
          .map(
            (opt, j) => `
          <label class="option">
            <input type="radio" name="q${i}" value="${j}">
            ${escapeHtml(opt)}
          </label>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("");

  return `
    <section class="quiz-section">
      <h2>Knowledge Check</h2>
      <form id="quiz-form" onsubmit="return checkQuiz(event)">
        ${questionsHtml}
        <button type="submit" class="btn-submit">Submit Answers</button>
      </form>
      <div id="quiz-result" class="quiz-result"></div>
    </section>
  `;
}

/**
 * Generate course overview HTML
 */
function generateOverviewHtml(course) {
  const videoList = course.videos
    .map(
      (v, i) =>
        `<li><a href="sco_${String(i + 1).padStart(2, "0")}/index.html">${escapeHtml(v.title)}</a> (${v.duration})</li>`
    )
    .join("\n");

  const objectives = course.learningObjectives.map((o) => `<li>${escapeHtml(o)}</li>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(course.title)}</title>
  <link rel="stylesheet" href="shared/styles.css">
</head>
<body>
  <div class="course-overview">
    <header>
      <h1>${escapeHtml(course.title)}</h1>
      <p class="meta">
        <span class="difficulty">${course.difficulty}</span> | 
        <span class="duration">${course.totalDuration}</span> |
        <span class="videos">${course.totalVideos} videos</span>
      </p>
    </header>
    
    <section class="description">
      <h2>About This Course</h2>
      <p>${escapeHtml(course.description)}</p>
    </section>
    
    <section class="objectives">
      <h2>Learning Objectives</h2>
      <ul>${objectives}</ul>
    </section>
    
    <section class="content-list">
      <h2>Course Content</h2>
      <ol>${videoList}</ol>
    </section>
    
    <footer>
      <p>Generated: ${new Date(course.createdAt).toLocaleDateString()}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Generate shared CSS styles
 */
function generateStyles() {
  return `/* SCORM Course Styles */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1a1a2e;
  background: #f8f9fa;
}

.sco-container, .course-overview {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.sco-header, header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #4a90d9;
}

h1 { font-size: 1.8rem; color: #1a1a2e; }
h2 { font-size: 1.3rem; color: #4a90d9; margin: 1.5rem 0 0.75rem; }

.duration, .meta { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }

.video-placeholder {
  background: #1a1a2e;
  color: #fff;
  padding: 3rem;
  border-radius: 8px;
  text-align: center;
  margin: 1rem 0;
}

.video-note { color: #aaa; font-size: 0.85rem; margin-top: 1rem; }
.video-id { color: #4a90d9; font-family: monospace; margin-top: 0.5rem; }

.btn-complete, .btn-submit {
  background: #4a90d9;
  color: #fff;
  border: none;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-complete:hover, .btn-submit:hover { background: #3a7bc8; }
.btn-complete:disabled { background: #28a745; cursor: default; }

.sco-footer { margin-top: 2rem; text-align: center; }

/* Quiz Styles */
.quiz-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #ddd; }
.quiz-question { margin: 1.5rem 0; }
.question-text { font-weight: 500; margin-bottom: 0.75rem; }
.options { display: flex; flex-direction: column; gap: 0.5rem; }
.option { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #fff; border-radius: 4px; cursor: pointer; }
.option:hover { background: #e8f4fd; }

/* Overview Styles */
.description, .objectives, .content-list { margin: 1.5rem 0; }
.objectives ul, .content-list ol { margin-left: 1.5rem; }
.objectives li, .content-list li { margin: 0.5rem 0; }
.content-list a { color: #4a90d9; text-decoration: none; }
.content-list a:hover { text-decoration: underline; }

.difficulty {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #4a90d9;
  color: #fff;
  border-radius: 12px;
  font-size: 0.8rem;
  text-transform: capitalize;
}

footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; color: #666; font-size: 0.85rem; }
`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape XML entities
 */
function escapeXml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return String(name)
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
}

export default { generateScormPackage };
