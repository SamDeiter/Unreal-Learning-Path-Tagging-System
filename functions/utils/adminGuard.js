/**
 * Admin authorization utility for Cloud Functions.
 * Centralizes the list of bootstrap admins and the check for admin privileges.
 */

const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Check if the user making the request has admin privileges.
 * Supports both Firebase Functions v1 (context.auth) and v2 (request.auth).
 *
 * @param {object} auth - The auth object from context (v1) or request (v2)
 * @returns {boolean} True if the user is an admin or in the bootstrap list
 */
function checkIsAdmin(auth) {
  if (!auth) return false;

  const email = (auth.token?.email || "").toLowerCase();
  const isAdminClaim = auth.token?.admin === true;
  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(email);

  return isAdminClaim || isBootstrapAdmin;
}

module.exports = {
  BOOTSTRAP_ADMIN_EMAILS,
  checkIsAdmin,
};
