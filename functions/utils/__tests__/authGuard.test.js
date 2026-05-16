const { isAdmin, requireAuth, requireAdmin } = require("../authGuard");
const { HttpsError } = require("firebase-functions/v2/https");

describe("authGuard", () => {
  describe("isAdmin", () => {
    it("returns true if token.admin is true", () => {
      const auth = { token: { admin: true } };
      expect(isAdmin(auth)).toBe(true);
    });

    it("returns true if uid matches ADMIN_UID env var", () => {
      const originalAdminUid = process.env.ADMIN_UID;
      process.env.ADMIN_UID = "admin-123";
      const auth = { uid: "admin-123", token: {} };
      expect(isAdmin(auth)).toBe(true);
      process.env.ADMIN_UID = originalAdminUid;
    });

    it("returns false if not admin and no matching UID", () => {
      const auth = { uid: "user-123", token: { admin: false } };
      expect(isAdmin(auth)).toBe(false);
    });

    it("returns false if auth is missing", () => {
      expect(isAdmin(null)).toBe(false);
    });
  });

  describe("requireAuth", () => {
    it("returns uid if authenticated", () => {
      const ctx = { auth: { uid: "user-123" } };
      expect(requireAuth(ctx)).toBe("user-123");
    });

    it("throws unauthenticated if missing auth", () => {
      const ctx = {};
      expect(() => requireAuth(ctx)).toThrow(HttpsError);
      try {
        requireAuth(ctx);
      } catch (e) {
        expect(e.code).toBe("unauthenticated");
      }
    });
  });

  describe("requireAdmin", () => {
    it("returns uid if admin", () => {
      const ctx = { auth: { uid: "admin-123", token: { admin: true } } };
      expect(requireAdmin(ctx)).toBe("admin-123");
    });

    it("throws permission-denied if authenticated but not admin", () => {
      const ctx = { auth: { uid: "user-123", token: { admin: false } } };
      expect(() => requireAdmin(ctx)).toThrow(HttpsError);
      try {
        requireAdmin(ctx);
      } catch (e) {
        expect(e.code).toBe("permission-denied");
      }
    });

    it("throws unauthenticated if not signed in", () => {
      const ctx = {};
      expect(() => requireAdmin(ctx)).toThrow(HttpsError);
      try {
        requireAdmin(ctx);
      } catch (e) {
        expect(e.code).toBe("unauthenticated");
      }
    });
  });
});
