/**
 * Tests for authGuard.js
 */
const { requireAuth, requireAdmin } = require("../authGuard");
const functions = require("firebase-functions");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("returns uid when authenticated", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    it("throws unauthenticated error when not authenticated", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(functions.https.HttpsError);
      try {
        requireAuth(context);
      } catch (err) {
        expect(err.code).toBe("unauthenticated");
      }
    });
  });

  describe("requireAdmin", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("returns uid when user has admin claim", () => {
      const context = {
        auth: {
          uid: "admin123",
          token: { admin: true }
        }
      };
      expect(requireAdmin(context)).toBe("admin123");
    });

    it("returns uid when user UID is in ADMIN_UID env var", () => {
      process.env.ADMIN_UID = "admin456, admin789";
      const context = {
        auth: {
          uid: "admin456",
          token: {}
        }
      };
      expect(requireAdmin(context)).toBe("admin456");
    });

    it("throws permission-denied error when user is not admin", () => {
      process.env.ADMIN_UID = "admin456";
      const context = {
        auth: {
          uid: "user123",
          token: { admin: false }
        }
      };
      expect(() => requireAdmin(context)).toThrow(functions.https.HttpsError);
      try {
        requireAdmin(context);
      } catch (err) {
        expect(err.code).toBe("permission-denied");
      }
    });

    it("throws unauthenticated error when context.auth is missing", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(functions.https.HttpsError);
      try {
        requireAdmin(context);
      } catch (err) {
        expect(err.code).toBe("unauthenticated");
      }
    });
  });
});
