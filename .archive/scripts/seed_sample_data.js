/**
 * Seed Sample Data — copies sample_data/ files into path-builder/src/data/
 * so the Vite dev server picks them up at build time.
 *
 * Usage:
 *   node scripts/seed_sample_data.js              (copies to src/data)
 *   node scripts/seed_sample_data.js --restore     (restores originals)
 *
 * Idempotent: backs up originals to .sample_backup/ before overwriting.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SAMPLE_DIR = path.join(ROOT, "sample_data");
const DATA_DIR = path.join(ROOT, "path-builder", "src", "data");
const BACKUP_DIR = path.join(ROOT, ".sample_backup");

const FILES_TO_SEED = ["video_library_enriched.json", "tags.json", "edges.json"];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function backup() {
  ensureDir(BACKUP_DIR);
  for (const file of FILES_TO_SEED) {
    const src = path.join(DATA_DIR, file);
    const dest = path.join(BACKUP_DIR, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log(`  📦 Backed up ${file}`);
    }
  }
}

function seed() {
  backup();
  for (const file of FILES_TO_SEED) {
    const src = path.join(SAMPLE_DIR, file);
    const dest = path.join(DATA_DIR, file);
    if (!fs.existsSync(src)) {
      console.warn(`  ⚠️  Missing sample file: ${src}`);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`  ✅ Seeded ${file}`);
  }
  console.log("\n🎉 Sample data seeded. Run 'npm run dev' in path-builder/ to start.");
}

function restore() {
  let restored = 0;
  for (const file of FILES_TO_SEED) {
    const src = path.join(BACKUP_DIR, file);
    const dest = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ♻️  Restored ${file}`);
      restored++;
    }
  }
  if (restored === 0) {
    console.log("  ℹ️  No backups found — nothing to restore.");
  } else {
    console.log(`\n✅ Restored ${restored} files from backup.`);
  }
}

// --- CLI ---
const args = process.argv.slice(2);
if (args.includes("--restore")) {
  console.log("🔄 Restoring original data files...\n");
  restore();
} else {
  console.log("🌱 Seeding sample data...\n");
  seed();
}
