/**
 * notifyFeedback — Firestore trigger that sends admin email when new feedback arrives.
 *
 * Trigger: onCreate on `feedback/{docId}`
 * Transport: Gmail SMTP via nodemailer
 * Secret: GMAIL_APP_PASSWORD (set via `firebase functions:secrets:set GMAIL_APP_PASSWORD`)
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

// ── Configuration ────────────────────────────────────────────────────────
const ADMIN_EMAIL = "samdeiter@gmail.com";
const SENDER_EMAIL = "samdeiter@gmail.com";
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// ── Emoji by feedback type ───────────────────────────────────────────────
const TYPE_EMOJI = {
  bug: "🐛",
  feature: "💡",
  general: "💬",
  content: "📝",
};

// ── Trigger ──────────────────────────────────────────────────────────────
exports.notifyFeedback = onDocumentCreated(
  {
    document: "feedback/{docId}",
    secrets: [gmailAppPassword],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("[notifyFeedback] No data in event, skipping.");
      return;
    }

    const data = snap.data();
    const docId = event.params.docId;

    const type = data.type || "unknown";
    const description = data.description || "(no description)";
    const userEmail = data.userEmail || "Anonymous";
    const createdAt = data.createdAt || new Date().toISOString();
    const attachCount = data.attachments?.length || 0;
    const emoji = TYPE_EMOJI[type] || "❓";

    // Build HTML email
    const subject = `${emoji} New ${type} feedback — UE5 Learning Path`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0d1117; color: #f0f6fc; padding: 24px; border-radius: 12px;">
          <h2 style="margin: 0 0 16px; color: #58a6ff;">${emoji} New Feedback Submitted</h2>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 12px; color: #8b949e; width: 100px;">Type</td>
              <td style="padding: 8px 12px; color: #f0f6fc; font-weight: 600; text-transform: capitalize;">${type}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; color: #8b949e;">From</td>
              <td style="padding: 8px 12px; color: #f0f6fc;">${userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; color: #8b949e;">Date</td>
              <td style="padding: 8px 12px; color: #f0f6fc;">${new Date(createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })}</td>
            </tr>
            ${attachCount > 0 ? `<tr><td style="padding: 8px 12px; color: #8b949e;">Attachments</td><td style="padding: 8px 12px; color: #f0f6fc;">📎 ${attachCount} file(s)</td></tr>` : ""}
          </table>

          <div style="margin: 16px 0; padding: 16px; background: #161b22; border-left: 3px solid #58a6ff; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 4px; color: #8b949e; font-size: 12px; text-transform: uppercase;">Description</p>
            <p style="margin: 0; color: #f0f6fc; line-height: 1.5;">${description}</p>
          </div>

          <p style="margin: 16px 0 0; font-size: 12px; color: #8b949e;">
            Doc ID: <code style="background: #21262d; padding: 2px 6px; border-radius: 4px;">${docId}</code>
          </p>

          <a href="https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System/" 
             style="display: inline-block; margin-top: 16px; padding: 8px 20px; background: #238636; color: #fff; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Open Admin Dashboard →
          </a>
        </div>
      </div>
    `;

    // Send email
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: SENDER_EMAIL,
          pass: gmailAppPassword.value(),
        },
      });

      await transporter.sendMail({
        from: `"UE5 Learning Path" <${SENDER_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject,
        html,
      });

      console.log(`[notifyFeedback] Email sent for feedback/${docId} (${type} from ${userEmail})`);
    } catch (err) {
      console.error(`[notifyFeedback] Failed to send email:`, err.message);
      // Don't throw — we don't want to retry on email failure
    }
  }
);
