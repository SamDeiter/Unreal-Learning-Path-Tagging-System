/**
 * Centralized list of bootstrap admin emails.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * checkIsAdmin — Shared utility to check if a user is an admin.
 * Works for both v1 (context.auth) and v2 (request.auth) Cloud Functions.
 *
 * @param {object} auth - The auth object from the function context or request.
 * @returns {boolean} True if the user is an admin.
 */
function checkIsAdmin(auth) {
  if (!auth) return false;

  const email = (auth.token?.email || "").toLowerCase();
  return (
    auth.token?.admin === true ||
    BOOTSTRAP_ADMIN_EMAILS.includes(email)
  );
}

module.exports = {
  BOOTSTRAP_ADMIN_EMAILS,
  checkIsAdmin,
};
