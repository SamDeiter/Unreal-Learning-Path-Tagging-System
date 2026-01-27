#!/usr/bin/env node
/**
 * Update and Deploy Script
 *
 * One command to:
 * 1. Scan the video library for new/changed content
 * 2. Merge with enriched data
 * 3. Commit and push changes
 * 4. GitHub Pages auto-deploys
 *
 * Usage: npm run update
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function log(msg) {
  console.log(`\n${"=".repeat(50)}\n${msg}\n${"=".repeat(50)}`);
}

function run(cmd, description) {
  console.log(`\n▶ ${description}`);
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║      UE5 Learning Path - Update & Deploy Pipeline        ║
╚══════════════════════════════════════════════════════════╝
`);

  const startTime = Date.now();

  // Step 1: Scan video library
  log("Step 1/4: Scanning Video Library");
  if (
    !run(
      "node scripts/scan_video_library.js",
      "Scanning for courses and videos...",
    )
  ) {
    console.error("❌ Scan failed. Aborting.");
    process.exit(1);
  }

  // Step 2: Merge with enriched data
  log("Step 2/4: Merging Enriched Data");
  const baseLib = JSON.parse(
    fs.readFileSync(path.join(ROOT, "content/video_library.json")),
  );
  const enrichedPath = path.join(ROOT, "content/video_library_enriched.json");

  if (fs.existsSync(enrichedPath)) {
    const enriched = JSON.parse(fs.readFileSync(enrichedPath));

    // Update enriched with new scan data while preserving AI tags
    baseLib.courses.forEach((baseCourse) => {
      const enrichedCourse = enriched.courses.find(
        (e) => e.code === baseCourse.code,
      );
      if (enrichedCourse) {
        // Update video info from base scan
        enrichedCourse.videos = baseCourse.videos;
        enrichedCourse.video_count = baseCourse.video_count;
        enrichedCourse.versions = baseCourse.versions;
        enrichedCourse.has_cc = baseCourse.has_cc;
        enrichedCourse.has_scorm = baseCourse.has_scorm;
      } else {
        // New course - add it
        enriched.courses.push(baseCourse);
      }
    });

    // Update metadata
    enriched.last_updated = new Date().toISOString();
    enriched.stats = {
      total_courses: enriched.courses.length,
      total_videos: enriched.courses.reduce(
        (sum, c) => sum + (c.video_count || 0),
        0,
      ),
      ai_enriched: enriched.courses.filter((c) => c.has_ai_tags).length,
      with_videos: enriched.courses.filter((c) => c.video_count > 0).length,
    };

    fs.writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2));
    console.log(`  ✓ Merged ${enriched.courses.length} courses`);
    console.log(`  ✓ Total videos: ${enriched.stats.total_videos}`);
    console.log(`  ✓ AI-enriched: ${enriched.stats.ai_enriched}`);
  } else {
    // No enriched file yet, use base
    baseLib.last_updated = new Date().toISOString();
    fs.writeFileSync(enrichedPath, JSON.stringify(baseLib, null, 2));
    console.log("  ✓ Created enriched file from base scan");
  }

  // Step 3: Check for changes and commit
  log("Step 3/4: Committing Changes");

  // Check if there are changes
  const status = execSync("git status --porcelain", {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (!status.trim()) {
    console.log("  ℹ No changes detected. Skipping commit.");
  } else {
    const date = new Date().toLocaleString();
    const commitMsg = `chore: Update video library data [${date}]`;

    run("git add content/", "Staging content changes...");
    run(`git commit -m "${commitMsg}"`, "Committing...");
  }

  // Step 4: Push to GitHub
  log("Step 4/4: Pushing to GitHub");
  if (!run("git push", "Pushing to remote...")) {
    console.warn(
      "  ⚠ Push failed - you may need to authenticate or resolve conflicts",
    );
  }

  // Done
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    ✅ UPDATE COMPLETE                     ║
╠══════════════════════════════════════════════════════════╣
║  Time: ${elapsed}s                                           ║
║  GitHub Pages will auto-deploy within ~2 minutes         ║
║  View at: https://samdeiter.github.io/Unreal-Learning-   ║
║           Path-Tagging-System/                           ║
╚══════════════════════════════════════════════════════════╝
`);
}

main();
