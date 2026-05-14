/**
 * triggerDemandScrape — Cloud Function to trigger the GitHub Action
 * that scrapes demand intelligence data.
 *
 * Calls the GitHub REST API workflow_dispatch endpoint to trigger
 * the scrape-demand-intel.yml workflow. The GITHUB_PAT secret is
 * stored in Firebase Functions secrets (never in code).
 *
 * Any authenticated user can trigger this (internal tool).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { requireAdmin } = require("../utils/authGuard");

const GITHUB_OWNER = "SamDeiter";
const GITHUB_REPO = "Unreal-Learning-Path-Tagging-System";
const WORKFLOW_FILE = "scrape-demand-intel.yml";

exports.triggerDemandScrape = onCall(
  {
    secrets: ["GITHUB_PAT"],
    timeoutSeconds: 30,
    memory: "512MiB",
    minInstances: 0,
  },
  async (request) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck(request, { allowInvalid: false });

    // Require admin privileges (internal tool)
    requireAdmin(request);

    // Get engine from request data (default to UE5)
    const { engine = "UE5" } = request.data || {};

    const pat = process.env.GITHUB_PAT;
    if (!pat) {
      logger.error("[triggerDemandScrape] GITHUB_PAT secret is not set.");
      throw new HttpsError("internal", "GitHub token not configured.");
    }

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    logger.info(`[triggerDemandScrape] Triggering ${engine} workflow dispatch by ${request.auth?.token?.email || "anonymous"}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Firebase-Cloud-Function",
      },
      body: JSON.stringify({ 
        ref: "master",
        inputs: { engine }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[triggerDemandScrape] GitHub API error ${response.status}: ${errorText}`);
      throw new HttpsError(
        "internal",
        `GitHub API error: ${response.status} — ${response.statusText}`
      );
    }

    logger.info("[triggerDemandScrape] Workflow dispatched successfully.");
    return {
      success: true,
      message: "Demand scrape triggered! Data will refresh in ~2 minutes.",
      triggeredBy: request.auth.token.email,
      triggeredAt: new Date().toISOString(),
    };
  }
);
