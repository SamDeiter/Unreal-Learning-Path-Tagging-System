/**
 * checkTokenExpiry — Scheduled Cloud Function to monitor token/secret expiry.
 *
 * Runs weekly to check if critical tokens (like GITHUB_PAT) are nearing expiry.
 * Writes alerts to Firestore `system_alerts/token_expiry` so the dashboard
 * or admin tools can display warnings.
 *
 * Token expiry dates are stored in Firestore `config/tokens` doc.
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

exports.checkTokenExpiry = onSchedule(
  {
    schedule: "every monday 09:00",
    timeZone: "America/New_York",
    timeoutSeconds: 30,
    memory: "512MiB",
    minInstances: 0,
  },
  async () => {
    const db = admin.firestore();

    // Load token config
    const configSnap = await db.doc("config/tokens").get();
    if (!configSnap.exists) {
      logger.info("[checkTokenExpiry] No config/tokens doc found — skipping.");
      return;
    }

    const tokens = configSnap.data();
    const now = new Date();
    const alerts = [];
    const WARNING_DAYS = 14;

    for (const [name, info] of Object.entries(tokens)) {
      if (!info.expiresAt) continue;

      const expiresAt = new Date(info.expiresAt);
      const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= WARNING_DAYS) {
        const alert = {
          token: name,
          expiresAt: info.expiresAt,
          daysUntilExpiry,
          severity: daysUntilExpiry <= 3 ? "critical" : daysUntilExpiry <= 7 ? "warning" : "info",
          message: `${name} expires in ${daysUntilExpiry} days (${expiresAt.toLocaleDateString()})`,
          checkedAt: now.toISOString(),
        };
        alerts.push(alert);
        logger.warn(`[checkTokenExpiry] ${alert.message}`);
      }
    }

    // Write alert status
    await db.doc("system_alerts/token_expiry").set({
      checkedAt: now.toISOString(),
      alertCount: alerts.length,
      alerts,
      nextCheck: "Next Monday 9:00 AM ET",
    });

    if (alerts.length === 0) {
      logger.info("[checkTokenExpiry] All tokens are healthy.");
    } else {
      logger.warn(`[checkTokenExpiry] ${alerts.length} token(s) nearing expiry!`);
    }
  }
);
