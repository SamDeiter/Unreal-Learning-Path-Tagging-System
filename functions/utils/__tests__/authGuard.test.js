const { isAdmin, requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");
const functions = require("firebase-functions");

describe("authGuard", () => {
  describe("isAdmin", () => {
    it("returns false if auth is missing", () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });

    it("returns true if admin claim is present", () => {
      const auth = { token: { admin: true } };
      expect(isAdmin(auth)).toBe(true);
    });

    it("returns true if email is in bootstrap list", () => {
      const auth = { token: { email: BOOTSTRAP_ADMIN_EMAILS[0] } };
      expect(isAdmin(auth)).toBe(true);
    });

    it("returns true if email is in bootstrap list (case insensitive)", () => {
      const auth = { token: { email: BOOTSTRAP_ADMIN_EMAILS[0].toUpperCase() } };
      expect(isAdmin(auth)).toBe(true);
    });

    it("returns false if neither claim nor email matches", () => {
      const auth = { token: { email: "not.an.admin@example.com", admin: false } };
      expect(isAdmin(auth)).toBe(false);
    });
  });

  describe("requireAuth", () => {
    it("throws unauthenticated error if auth is missing", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(functions.https.HttpsError);
      try {
        requireAuth(context);
      } catch (e) {
        expect(e.code).toBe("unauthenticated");
      }
    });

    it("returns uid if authenticated", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });
  });

  describe("requireAdmin", () => {
    it("throws unauthenticated error if auth is missing", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(functions.https.HttpsError);
    });

    it("throws permission-denied error if not an admin", () => {
      const context = { auth: { uid: "user123", token: { email: "user@example.com" } } };
      expect(() => requireAdmin(context)).toThrow(functions.https.HttpsError);
      try {
        requireAdmin(context);
      } catch (e) {
        expect(e.code).toBe("permission-denied");
      }
    });

    it("returns uid if admin (claim)", () => {
      const context = { auth: { uid: "admin123", token: { admin: true } } };
      expect(requireAdmin(context)).toBe("admin123");
    });

    it("returns uid if admin (bootstrap)", () => {
      const context = { auth: { uid: "admin123", token: { email: BOOTSTRAP_ADMIN_EMAILS[0] } } };
      expect(requireAdmin(context)).toBe("admin123");
    });
  });
});
