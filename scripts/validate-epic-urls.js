#!/usr/bin/env node
/**
 * Epic Documentation URL Validator
 *
 * Tests that Epic Games documentation URLs are valid and accessible.
 * Run: node scripts/validate-epic-urls.js
 */

const https = require("https");
const http = require("http");

// URLs referenced in the AI prompt or commonly used
const EPIC_DOC_URLS = [
  // URLs from the AI prompt examples
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-projects-in-unreal-engine",

  // Common topics users might search for
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-visual-effects-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/using-chaos-physics-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/materials-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/audio-in-unreal-engine",
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/level-design-in-unreal-engine",

  // URLs that were reported as broken - to verify fixes
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/assets-and-packages-in-unreal-engine",
];

// Check if a URL returns 200 OK
function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.get(
      url,
      {
        headers: { "User-Agent": "Epic-URL-Validator/1.0" },
        timeout: 10000,
      },
      (res) => {
        // Follow redirects (301, 302, 307, 308)
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          resolve({
            url,
            status: res.statusCode,
            redirect: res.headers.location,
            valid: true,
          });
        } else if (res.statusCode === 200) {
          resolve({ url, status: 200, valid: true });
        } else {
          resolve({ url, status: res.statusCode, valid: false });
        }
        // Consume response to free up memory
        res.resume();
      },
    );

    req.on("error", (err) => {
      resolve({ url, status: "ERROR", error: err.message, valid: false });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ url, status: "TIMEOUT", valid: false });
    });
  });
}

async function main() {
  console.log("🔍 Validating Epic Documentation URLs...\n");

  const results = await Promise.all(EPIC_DOC_URLS.map(checkUrl));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.valid) {
      console.log(`✅ ${result.status} - ${result.url}`);
      if (result.redirect) {
        console.log(`   ↳ Redirects to: ${result.redirect}`);
      }
      passed++;
    } else {
      console.log(`❌ ${result.status} - ${result.url}`);
      if (result.error) {
        console.log(`   ↳ Error: ${result.error}`);
      }
      failed++;
    }
  }

  console.log(
    `\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} URLs`,
  );

  if (failed > 0) {
    console.log(
      "\n⚠️  Some URLs are broken. Update the AI prompt with correct URLs.",
    );
    process.exit(1);
  } else {
    console.log("\n✅ All URLs are valid!");
    process.exit(0);
  }
}

main();
