/**
 * AI Transcript Analyzer
 *
 * Uses Gemini AI to analyze video transcripts and extract
 * detailed tags, keywords, and learning objectives.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load existing video library
const VIDEO_LIBRARY_PATH = path.join(
  __dirname,
  "..",
  "content",
  "video_library.json",
);
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "content",
  "video_library_enriched.json",
);

// Rate limiting
const DELAY_BETWEEN_CALLS = 2000; // 2 seconds between API calls
const MAX_TRANSCRIPT_LENGTH = 30000; // Max characters to send

/**
 * Find all VTT files for a course
 */
function findVTTFiles(coursePath) {
  const vttFiles = [];

  function searchDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name.endsWith(".vtt") || entry.name.endsWith(".srt")) {
          vttFiles.push(fullPath);
        }
      }
    } catch (err) {
      // Directory not accessible
    }
  }

  searchDir(coursePath);
  return vttFiles;
}

/**
 * Parse VTT file and extract plain text
 */
function parseVTT(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const textLines = [];

    for (const line of lines) {
      // Skip WEBVTT header
      if (line.startsWith("WEBVTT")) continue;
      // Skip timestamps
      if (line.includes("-->")) continue;
      // Skip alignment metadata
      if (line.includes("align:")) continue;
      // Skip empty lines
      if (line.trim() === "") continue;
      // Skip numeric cue identifiers
      if (/^\d+$/.test(line.trim())) continue;

      textLines.push(line.trim());
    }

    return textLines.join(" ");
  } catch (err) {
    return "";
  }
}

/**
 * Combine all transcripts for a course
 */
function getCourseTranscript(coursePath) {
  const vttFiles = findVTTFiles(coursePath);

  if (vttFiles.length === 0) {
    return null;
  }

  const transcripts = vttFiles
    .map((f) => parseVTT(f))
    .filter((t) => t.length > 0);
  const combined = transcripts.join(" ");

  // Truncate if too long
  if (combined.length > MAX_TRANSCRIPT_LENGTH) {
    return combined.substring(0, MAX_TRANSCRIPT_LENGTH) + "...";
  }

  return combined;
}

/**
 * Use Gemini to analyze transcript and extract tags
 */
async function analyzeWithGemini(courseTitle, transcript, existingTags) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are an Unreal Engine 5 curriculum expert. Analyze this video transcript and extract detailed tags for a learning management system.

COURSE TITLE: ${courseTitle}

EXISTING TAGS (already assigned):
- Topic: ${existingTags.topic || "Unknown"}
- Level: ${existingTags.level || "Unknown"}
- Industry: ${existingTags.industry || "General"}

TRANSCRIPT:
${transcript}

Based on the transcript, provide the following in JSON format:

{
  "subtopics": ["list of 3-5 specific subtopics covered, e.g. 'PBR Materials', 'Node-based Workflow'"],
  "ue5_features": ["list of specific UE5 features mentioned, e.g. 'Material Editor', 'Blend Modes', 'Texture Sampling'"],
  "keywords": ["list of 5-10 important keywords for searchability"],
  "learning_objectives": ["list of 2-3 things a learner will be able to do after watching"],
  "prerequisites": ["list of any prerequisites mentioned or implied"],
  "difficulty_notes": "brief note about actual difficulty level based on content complexity"
}

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Clean up response (remove markdown if present)
    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`  Error analyzing: ${err.message}`);
    return null;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  console.log("=".repeat(50));
  console.log("AI TRANSCRIPT ANALYZER");
  console.log("=".repeat(50));

  // Load video library
  const library = JSON.parse(fs.readFileSync(VIDEO_LIBRARY_PATH, "utf-8"));
  console.log(`\nLoaded ${library.courses.length} courses`);

  // Track statistics
  let processed = 0;
  let enriched = 0;
  let noTranscript = 0;
  let errors = 0;

  // Process each course
  for (let i = 0; i < library.courses.length; i++) {
    const course = library.courses[i];
    console.log(`\n[${i + 1}/${library.courses.length}] ${course.title}`);

    // Skip if already has AI tags (for incremental runs)
    if (course.has_ai_tags) {
      console.log("  Already enriched, skipping");
      continue;
    }

    // Get transcript
    const transcript = getCourseTranscript(course.path);

    if (!transcript) {
      console.log("  No transcript found");
      noTranscript++;
      continue;
    }

    console.log(`  Found transcript (${transcript.length} chars)`);

    // Analyze with AI
    const aiTags = await analyzeWithGemini(
      course.title,
      transcript,
      course.tags,
    );

    if (aiTags) {
      // Merge AI tags into course
      course.ai_analysis = aiTags;
      course.has_ai_tags = true;
      enriched++;
      console.log(`  ✓ AI analysis complete`);
      console.log(`    Subtopics: ${aiTags.subtopics?.join(", ") || "none"}`);
    } else {
      errors++;
      console.log("  ✗ AI analysis failed");
    }

    processed++;

    // Rate limiting
    await sleep(DELAY_BETWEEN_CALLS);
  }

  // Update statistics
  library.ai_enrichment = {
    timestamp: new Date().toISOString(),
    processed: processed,
    enriched: enriched,
    no_transcript: noTranscript,
    errors: errors,
  };

  // Save enriched library
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(library, null, 2));
  console.log(`\n${"=".repeat(50)}`);
  console.log("ANALYSIS COMPLETE");
  console.log(`${"=".repeat(50)}`);
  console.log(`Processed: ${processed}`);
  console.log(`Enriched with AI: ${enriched}`);
  console.log(`No transcript: ${noTranscript}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nSaved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);
