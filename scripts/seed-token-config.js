/**
 * Seed the config/tokens doc in Firestore for the checkTokenExpiry function.
 * Run once: node scripts/seed-token-config.js
 */
const admin = require("firebase-admin");

const FIREBASE_SA_B64 = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!FIREBASE_SA_B64) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT env var (base64)");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(FIREBASE_SA_B64, "base64").toString("utf-8")
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function seed() {
  await db.doc("config/tokens").set({
    GITHUB_PAT: {
      description: "Fine-grained PAT for triggering GitHub Actions workflow dispatch",
      scope: "Actions:Read+Write on Unreal-Learning-Path-Tagging-System",
      createdAt: "2026-03-20T00:00:00Z",
      expiresAt: "2026-06-18T00:00:00Z",
    },
  });
  console.log("✅ config/tokens seeded with GITHUB_PAT expiry: 2026-06-18");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
