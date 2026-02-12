/**
 * Access Control Service — Epic employees + invite-based access.
 *
 * Two access paths:
 *   1. @epicgames.com email → auto-admitted
 *   2. Invite link → validates code in Firestore, adds email to allowlist
 *
 * Uses Firestore collections:
 *   - path_builder_access/{email} — allowlisted users
 *   - path_builder_invites/{code} — invite codes
 */

import { getFirebaseApp } from "./firebaseConfig";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  Timestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

const app = getFirebaseApp();
const db = getFirestore(app);

// ── Domain & Admin Check ─────────────────────────────────────────────

const ALLOWED_DOMAINS = ["epicgames.com"];
const ADMIN_EMAILS = ["sam.deiter@epicgames.com", "samdeiter@gmail.com"];

/**
 * Check if an email is an admin.
 * @param {string} email
 * @returns {boolean}
 */
export function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Check if an email belongs to an auto-admitted domain.
 * @param {string} email
 * @returns {boolean}
 */
export function isEpicEmployee(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}

// ── Firestore Allowlist ──────────────────────────────────────────────

/**
 * Check if an email is on the Firestore allowlist.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function checkAllowlist(email) {
  if (!email) return false;
  try {
    const ref = doc(db, "path_builder_access", email.toLowerCase());
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (error) {
    console.error("[AccessControl] Allowlist check failed:", error);
    return false;
  }
}

/**
 * Check if a user is authorized (Epic employee OR on allowlist).
 * @param {object} user — Firebase user object
 * @returns {Promise<boolean>}
 */
export async function isAuthorized(user) {
  if (!user?.email) return false;
  if (isEpicEmployee(user.email)) return true;
  return checkAllowlist(user.email);
}

// ── Invite System ────────────────────────────────────────────────────

/**
 * Validate and consume an invite code.
 * On success, adds the user's email to the allowlist.
 *
 * @param {string} code — Invite code
 * @param {string} email — User's email to add to allowlist
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function consumeInvite(code, email) {
  if (!code || !email) return { success: false, error: "Missing code or email" };

  try {
    const codeUpper = code.trim().toUpperCase();
    const inviteRef = doc(db, "path_builder_invites", codeUpper);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      return { success: false, error: "Invalid invite code" };
    }

    const invite = inviteSnap.data();

    // Check if revoked
    if (invite.revoked) {
      return { success: false, error: "This invite code has been revoked" };
    }

    // Check expiration
    if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
      return { success: false, error: "This invite code has expired" };
    }

    // Check max uses
    if (invite.maxUses > 0 && (invite.usedCount || 0) >= invite.maxUses) {
      return { success: false, error: "This invite code has been fully used" };
    }

    // Add email to allowlist
    const emailLower = email.toLowerCase();
    await setDoc(doc(db, "path_builder_access", emailLower), {
      email: emailLower,
      grantedAt: Timestamp.now(),
      inviteCode: codeUpper,
    });

    // Increment usage counter
    await updateDoc(inviteRef, {
      usedCount: increment(1),
      lastUsedAt: Timestamp.now(),
    });

    return { success: true };
  } catch (error) {
    console.error("[AccessControl] Invite consumption failed:", error);
    return { success: false, error: "Failed to validate invite code" };
  }
}

// ── URL Helpers ──────────────────────────────────────────────────────

/**
 * Get invite code from URL query parameters.
 * @returns {string|null}
 */
export function getInviteFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("invite");
}

/**
 * Clear invite code from URL without page reload.
 */
export function clearInviteFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());
}

// ── Admin: Invite Management ────────────────────────────────────────

/**
 * Generate a random invite code (e.g. "LP-A3K9X2").
 * @returns {string}
 */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LP-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new invite code (admin only).
 * @param {object} options
 * @param {number} [options.maxUses=5] — 0 means unlimited
 * @param {number|null} [options.expiresInDays=null] — null means no expiry
 * @param {string} [options.note=""] — optional description
 * @returns {Promise<{code: string, error?: string}>}
 */
export async function createInviteCode({ maxUses = 5, expiresInDays = null, note = "" } = {}) {
  try {
    const code = generateCode();
    const data = {
      maxUses,
      usedCount: 0,
      revoked: false,
      createdAt: Timestamp.now(),
      note,
    };
    if (expiresInDays) {
      const expires = new Date();
      expires.setDate(expires.getDate() + expiresInDays);
      data.expiresAt = Timestamp.fromDate(expires);
    }
    await setDoc(doc(db, "path_builder_invites", code), data);
    return { code };
  } catch (error) {
    console.error("[AccessControl] Failed to create invite:", error);
    return { code: null, error: error.message };
  }
}

/**
 * List all invite codes from Firestore.
 * @returns {Promise<Array<{code: string, maxUses: number, usedCount: number, revoked: boolean, createdAt: Date, expiresAt?: Date, note?: string}>>}
 */
export async function listInviteCodes() {
  try {
    const q = query(collection(db, "path_builder_invites"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        code: d.id,
        maxUses: data.maxUses || 0,
        usedCount: data.usedCount || 0,
        revoked: !!data.revoked,
        createdAt: data.createdAt?.toDate?.() || null,
        expiresAt: data.expiresAt?.toDate?.() || null,
        note: data.note || "",
      };
    });
  } catch (error) {
    console.error("[AccessControl] Failed to list invites:", error);
    return [];
  }
}

/**
 * Revoke an invite code.
 * @param {string} code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function revokeInviteCode(code) {
  try {
    await updateDoc(doc(db, "path_builder_invites", code), { revoked: true });
    return { success: true };
  } catch (error) {
    console.error("[AccessControl] Failed to revoke invite:", error);
    return { success: false, error: error.message };
  }
}
