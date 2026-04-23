/**
 * wipeLegacyCaches.js — one-shot cleanup of cache collections that predate
 * the uid-partitioned cache key.
 *
 * Collections wiped:
 *   - cached_diagnoses   (pre-migration: no `uid` field → unreachable by new lookup)
 *   - pipeline_cache     (pre-migration: key omitted uid → cross-user hits)
 *   - pathCache          (pre-migration: payload readable by any authed user)
 *   - cached_paths       (pre-migration: same)
 *
 * These are all caches. Wiping them causes a cache-miss warm-up window and
 * nothing else — every cache entry regenerates on the next query.
 *
 * Runs under Firebase Admin SDK with application-default credentials (the
 * same credentials `firebase login` gives you). Targets the project currently
 * selected by the Firebase CLI — set explicitly via GCLOUD_PROJECT if you
 * want a different target.
 *
 * Usage:
 *   node scripts/wipeLegacyCaches.js
 *   node scripts/wipeLegacyCaches.js --dry-run
 */

const admin = require("firebase-admin");

const COLLECTIONS = ["cached_diagnoses", "pipeline_cache", "pathCache", "cached_paths"];
const BATCH_SIZE = 400; // Firestore batch limit is 500; keep headroom.
const DRY_RUN = process.argv.includes("--dry-run");

function initAdmin() {
  if (admin.apps.length > 0) return;
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  admin.initializeApp(
    projectId ? { projectId } : undefined
  );
}

async function wipeCollection(name) {
  const db = admin.firestore();
  const ref = db.collection(name);
  let deletedTotal = 0;

  for (;;) {
    const snap = await ref.limit(BATCH_SIZE).get();
    if (snap.empty) break;

    if (DRY_RUN) {
      console.log(`  [dry-run] would delete ${snap.size} docs from ${name}`);
      deletedTotal += snap.size;
      if (snap.size < BATCH_SIZE) break;
      continue;
    }

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedTotal += snap.size;
    console.log(`  deleted ${snap.size} (running total: ${deletedTotal}) from ${name}`);

    if (snap.size < BATCH_SIZE) break;
  }

  return deletedTotal;
}

(async () => {
  initAdmin();

  const project =
    admin.app().options.projectId ||
    process.env.GCLOUD_PROJECT ||
    "(default from ADC)";

  console.log(`Project: ${project}`);
  console.log(`Mode:    ${DRY_RUN ? "DRY RUN (no deletes)" : "LIVE"}`);
  console.log("");

  const results = {};
  for (const name of COLLECTIONS) {
    console.log(`Wiping ${name}...`);
    try {
      results[name] = await wipeCollection(name);
    } catch (err) {
      console.error(`  ERROR on ${name}:`, err.message);
      results[name] = `ERROR: ${err.message}`;
    }
  }

  console.log("");
  console.log("Summary:");
  for (const [name, count] of Object.entries(results)) {
    console.log(`  ${name}: ${count}`);
  }

  process.exit(0);
})();
