const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { requireAdmin } = require("../utils/authGuard");

/**
 * setAdminClaim — Callable Cloud Function to grant or revoke admin claims.
 *
 * Can be called by:
 *   1. A user whose email is in BOOTSTRAP_ADMIN_EMAILS (first-time setup)
 *   2. A user who already has the `admin: true` custom claim
 *
 * Request body:
 *   { targetUid: string, admin: boolean }
 */
exports.setAdminClaim = functions
  .runWith({ memory: "512MB" })
  .https.onCall(async (data, context) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });

    // Require admin access
    requireAdmin(context);

    const { targetUid, admin: grantAdmin } = data;

    if (!targetUid || typeof targetUid !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "targetUid is required."
      );
    }

    if (typeof grantAdmin !== "boolean") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "admin must be a boolean."
      );
    }

    // Set or revoke the custom claim
    await admin.auth().setCustomUserClaims(targetUid, { admin: grantAdmin });

    // Force token refresh by updating the user's metadata
    const targetUser = await admin.auth().getUser(targetUid);

    logger.info(
      JSON.stringify({
        severity: "INFO",
        message: "admin_claim_updated",
        caller: context.auth.uid,
        target: targetUid,
        targetEmail: targetUser.email,
        admin: grantAdmin,
      })
    );

    return {
      success: true,
      targetUid,
      targetEmail: targetUser.email,
      admin: grantAdmin,
      note: grantAdmin
        ? "User must sign out and back in for the claim to take effect."
        : "Admin access revoked. User must sign out and back in.",
    };
  });
