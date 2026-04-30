/**
 * Admin guard utility for Cloud Functions.
 * Consolidates bootstrap admin list and admin check logic.
 */

const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Check if the caller is an admin.
 * @param {object} auth - The request.auth (v2) or context.auth (v1) object
 * @returns {boolean} True if the user is an admin
 */
function checkIsAdmin(auth) {
  if (!auth) return false;

  const email = (auth.token?.email || "").toLowerCase();
  const isAdmin =
    auth.token?.admin === true ||
    BOOTSTRAP_ADMIN_EMAILS.includes(email);

  return isAdmin;
}

module.exports = {
  checkIsAdmin,
  BOOTSTRAP_ADMIN_EMAILS,
};
