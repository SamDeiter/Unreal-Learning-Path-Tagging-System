/**
 * Scan Video Library and Build Tag Database
 *
 * Scans the Google Drive video folder structure and maps
 * each course to the official LMS tag taxonomy.
 */

const fs = require("fs");
const path = require("path");

// ============================================
// OFFICIAL LMS TAG TAXONOMY
// ============================================

const TAG_TAXONOMY = {
  audience: ["Academic", "Partners", "Professional Training"],

  level: ["Advanced", "Beginner", "Intermediate"],

  product: [
    "MetaHuman",
    "RealityCapture",
    "Twinmotion",
    "Unreal Engine",
    "UEFN",
  ],

  industry: [
    "Architecture",
    "Automotive",
    "Games",
    "General",
    "Media & Entertainment",
    "Other",
  ],

  topic: [
    "AI Systems",
    "Animation",
    "Audio",
    "Avalanche",
    "Blueprints",
    "Chaos",
    "Control Rig",
    "Data Pipeline",
    "Final Output",
    "Foundation",
    "Geometry/Modeling",
    "Grooming",
    "Landscape",
    "Lighting",
    "Materials",
    "Niagara",
    "Optimization",
    "Programming",
    "Sequencer",
    "Stage",
    "UE Tools",
    "Unreal Motion Graphics",
    "World Building",
  ],
};

// ============================================
// FOLDER-TO-TAG MAPPING RULES
// ============================================

// Map folder names to Topics
const FOLDER_TO_TOPIC = {
  "00-Intro": "Foundation",
  "01-Material": "Materials",
  "02-Blueprint": "Blueprints",
  "03-Lighting": "Lighting",
  "04-Optimization": "Optimization",
  "05-Sequencer": "Sequencer",
  "06-Data Pipeline": "Data Pipeline",
  "07-Animation": "Animation",
  "08-Control Rig": "Control Rig",
  "09-Final Output": "Final Output",
  "10-Niagara": "Niagara",
  "11-Landscape": "Landscape",
  "12-Twinmotion": "Foundation", // Product tag will be Twinmotion
  "13-MetaHuman": "Foundation", // Product tag will be MetaHuman
  "15-Programming": "Programming",
  "16-Unreal Engine Tools": "UE Tools",
  "17-Audio": "Audio",
  "18-Stage": "Stage",
  "19-Worldbuilding": "World Building",
  "20-Composure": "Final Output",
  "21-Houdini": "Data Pipeline",
  "22-Chaos": "Chaos",
  "23-Modeling": "Geometry/Modeling",
  "24-AI Systems": "AI Systems",
  "25-Hair": "Grooming",
  "25-Groom": "Grooming",
  "26-Motion Design": "Unreal Motion Graphics",
  "27-UMG": "Unreal Motion Graphics",
};

// Map course code prefix to Level
const CODE_TO_LEVEL = {
  100: "Beginner",
  101: "Beginner",
  102: "Beginner",
  110: "Beginner",
  200: "Intermediate",
  201: "Intermediate",
  202: "Intermediate",
  210: "Intermediate",
  300: "Advanced",
  301: "Advanced",
  302: "Advanced",
  310: "Advanced",
};

// Keywords in folder names that indicate Industry
const INDUSTRY_KEYWORDS = {
  AEC: "Architecture",
  Architecture: "Architecture",
  Architectural: "Architecture",
  Automotive: "Automotive",
  HMI: "Automotive", // Human-Machine Interface = Automotive
  Aerospace: "Automotive",
  Games: "Games",
  Gameplay: "Games",
  Mobile: "Games", // Mobile apps typically for games
  Film: "Media & Entertainment",
  ICVFX: "Media & Entertainment",
  "Virtual Production": "Media & Entertainment",
  Stage: "Media & Entertainment",
  "Linear Content": "Media & Entertainment",
  Cinematic: "Media & Entertainment",
  Cinematics: "Media & Entertainment",
  "Shot Creation": "Media & Entertainment",
  Visualization: "General",
  VR: "General",
  AR: "General",
  "Digital Twin": "General",
};

// Keywords for Epic Product
const PRODUCT_KEYWORDS = {
  Twinmotion: "Twinmotion",
  MetaHuman: "MetaHuman",
  RealityCapture: "RealityCapture",
  UEFN: "UEFN",
  Fortnite: "UEFN",
};

// ============================================
// SCANNING FUNCTIONS
// ============================================

function scanDirectory(dirPath, depth = 0) {
  const results = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "desktop.ini") continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "Adobe Premiere Pro Auto-Save") continue;
      if (entry.name === "Soundstripe") continue;
      if (entry.name === "Place Inside of Video Version Folders") continue;
      if (entry.name === "OLD") continue; // Skip archive folders

      const fullPath = path.join(dirPath, entry.name);

      // Check if this looks like a course folder (has version subfolders like V5.5)
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      const hasVersionFolder = subEntries.some(
        (e) => e.isDirectory() && /^V\d/.test(e.name),
      );

      if (hasVersionFolder) {
        // This is a course folder
        const course = parseCourseFolder(entry.name, fullPath, subEntries);
        results.push(course);
      } else {
        // This is a category folder, recurse into it
        const subResults = scanDirectory(fullPath, depth + 1);
        results.push(...subResults);
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}:`, err.message);
  }

  return results;
}

function parseCourseFolder(folderName, fullPath, subEntries) {
  // Strip RET- or WKS- prefix if present for code extraction
  const cleanedName = folderName.replace(/^(RET|WKS|OLD)-?/i, "");

  // Extract course code (e.g., "100.01", "201.04")
  const codeMatch = cleanedName.match(/^(\d{3})\.(\d{2})/);
  const courseCode = codeMatch ? `${codeMatch[1]}.${codeMatch[2]}` : null;

  // Extract title (everything after the code, or use original if no code)
  const titleMatch = cleanedName.match(/^\d{3}\.\d{2}[-\s]*(.+)$/);
  const title = titleMatch ? titleMatch[1].trim() : folderName;

  // Find version folders
  const versions = subEntries
    .filter((e) => e.isDirectory() && /^V\d/.test(e.name))
    .map((e) => e.name);

  // Check for CC folder
  const hasCC = subEntries.some(
    (e) => e.isDirectory() && e.name.toUpperCase() === "CC",
  );

  // Check for SCORM folder
  const hasSCORM = subEntries.some(
    (e) => e.isDirectory() && e.name.toUpperCase() === "SCORM",
  );

  // Find video files in the course
  const videos = findVideoFiles(fullPath, versions);

  // Derive tags
  const tags = deriveTags(folderName, fullPath, title);

  return {
    code: courseCode,
    title: title,
    folder_name: folderName,
    path: fullPath,
    versions: versions,
    has_cc: hasCC,
    has_scorm: hasSCORM,
    videos: videos,
    video_count: videos.length,
    tags: tags,
    needs_review: tags._confidence < 3, // Flag if less than 3 tags auto-detected
  };
}

/**
 * Find all video files in a course folder
 */
function findVideoFiles(coursePath, versions) {
  const videoFiles = [];
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];

  // Search in version folders first (prefer latest version)
  const sortedVersions = [...versions].sort().reverse();

  for (const version of sortedVersions) {
    const versionPath = path.join(coursePath, version);

    // Check FINAL folder first (production videos)
    const finalPath = path.join(versionPath, "FINAL");
    if (fs.existsSync(finalPath)) {
      const files = scanForVideos(finalPath, videoExtensions);
      files.forEach((f) => {
        videoFiles.push({
          name: path.basename(f),
          path: f,
          version: version,
          folder: "FINAL",
        });
      });
      if (files.length > 0) break; // Use latest version with videos
    }
  }

  return videoFiles;
}

/**
 * Recursively scan directory for video files
 */
function scanForVideos(dirPath, extensions) {
  const results = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanForVideos(fullPath, extensions));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Directory not accessible
  }

  return results;
}

function deriveTags(folderName, fullPath, title) {
  const tags = {
    audience: "Professional Training", // Default based on folder structure
    level: null,
    product: "Unreal Engine", // Default
    industry: null,
    topic: null,
    _confidence: 0,
  };

  // Strip RET- or WKS- prefix for code extraction
  const cleanedName = folderName.replace(/^(RET|WKS|OLD)-?/i, "");

  // 1. Derive Level from course code (first digit: 1=Beginner, 2=Intermediate, 3=Advanced)
  const codeMatch = cleanedName.match(/^(\d)/);
  if (codeMatch) {
    const firstDigit = codeMatch[1];
    if (firstDigit === "1") {
      tags.level = "Beginner";
      tags._confidence++;
    } else if (firstDigit === "2") {
      tags.level = "Intermediate";
      tags._confidence++;
    } else if (firstDigit === "3") {
      tags.level = "Advanced";
      tags._confidence++;
    }
  }

  // 2. Derive Topic from parent folder
  const parentFolder = path.basename(path.dirname(fullPath));
  for (const [key, topic] of Object.entries(FOLDER_TO_TOPIC)) {
    if (
      parentFolder.includes(key) ||
      parentFolder.startsWith(key.split("-")[0])
    ) {
      tags.topic = topic;
      tags._confidence++;
      break;
    }
  }

  // 3. Derive Industry from folder name keywords
  const searchText = `${folderName} ${title}`.toLowerCase();
  for (const [keyword, industry] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (searchText.toLowerCase().includes(keyword.toLowerCase())) {
      tags.industry = industry;
      tags._confidence++;
      break;
    }
  }

  // 4. Derive Product from folder name
  for (const [keyword, product] of Object.entries(PRODUCT_KEYWORDS)) {
    if (searchText.toLowerCase().includes(keyword.toLowerCase())) {
      tags.product = product;
      break;
    }
  }

  // 5. Default industry if not detected (General is a valid industry, not missing)
  if (!tags.industry) {
    tags.industry = "General";
    tags._confidence++; // General is a valid assignment
  }

  return tags;
}

// ============================================
// MAIN EXECUTION
// ============================================

const VIDEO_ROOT =
  "G:\\Shared drives\\ELT Division\\Professional Group Training\\CURRENT COURSE CONTENT\\VIDEOS";
const OUTPUT_DIR = path.join(__dirname, "..", "content");

console.log("Scanning video library...");
console.log(`Root: ${VIDEO_ROOT}\n`);

const courses = scanDirectory(VIDEO_ROOT);

// Generate summary statistics
const stats = {
  total_courses: courses.length,
  by_level: {},
  by_topic: {},
  by_industry: {},
  by_product: {},
  needs_review: courses.filter((c) => c.needs_review).length,
};

for (const course of courses) {
  // Count by level
  const level = course.tags.level || "Unknown";
  stats.by_level[level] = (stats.by_level[level] || 0) + 1;

  // Count by topic
  const topic = course.tags.topic || "Unknown";
  stats.by_topic[topic] = (stats.by_topic[topic] || 0) + 1;

  // Count by industry
  const industry = course.tags.industry || "Unknown";
  stats.by_industry[industry] = (stats.by_industry[industry] || 0) + 1;

  // Count by product
  const product = course.tags.product || "Unknown";
  stats.by_product[product] = (stats.by_product[product] || 0) + 1;
}

// Build output
const output = {
  generated_at: new Date().toISOString(),
  taxonomy: TAG_TAXONOMY,
  statistics: stats,
  courses: courses,
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write JSON output
const jsonPath = path.join(OUTPUT_DIR, "video_library.json");
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
console.log(`\nWritten: ${jsonPath}`);

// Write CSV for easy review
const csvPath = path.join(OUTPUT_DIR, "video_library.csv");
const csvHeader =
  "Code,Title,Level,Topic,Industry,Product,Has CC,Has SCORM,Needs Review,Path\n";
const csvRows = courses
  .map(
    (c) =>
      `"${c.code || ""}","${c.title}","${c.tags.level || ""}","${c.tags.topic || ""}","${c.tags.industry || ""}","${c.tags.product || ""}","${c.has_cc}","${c.has_scorm}","${c.needs_review}","${c.path}"`,
  )
  .join("\n");
fs.writeFileSync(csvPath, csvHeader + csvRows);
console.log(`Written: ${csvPath}`);

// Print summary
console.log("\n========================================");
console.log("VIDEO LIBRARY SCAN COMPLETE");
console.log("========================================");
console.log(`Total Courses: ${stats.total_courses}`);
console.log(`Needs Review: ${stats.needs_review}`);
console.log("\nBy Level:");
for (const [level, count] of Object.entries(stats.by_level)) {
  console.log(`  ${level}: ${count}`);
}
console.log("\nBy Topic:");
for (const [topic, count] of Object.entries(stats.by_topic).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${topic}: ${count}`);
}
console.log("\nBy Industry:");
for (const [industry, count] of Object.entries(stats.by_industry)) {
  console.log(`  ${industry}: ${count}`);
}
