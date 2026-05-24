/**
 * authGuard.test.js — Unit tests for authentication and authorization guards.
 */
const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
      }
    },
  },
}));

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("returns uid for authenticated requests", () => {
      const mockContext = { auth: { uid: "user123" } };
      expect(requireAuth(mockContext)).toBe("user123");
    });

    it("throws unauthenticated error for missing auth", () => {
      const mockContext = {};
      expect(() => requireAuth(mockContext)).toThrow("Authentication required.");
      try {
        requireAuth(mockContext);
      } catch (e) {
        expect(e.code).toBe("unauthenticated");
      }
    });
  });

  describe("requireAdmin", () => {
    it("returns uid for users with admin claim", () => {
      const mockContext = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "other@example.com" },
        },
      };
      expect(requireAdmin(mockContext)).toBe("admin123");
    });

    it("returns uid for users in bootstrap list", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0];
      const mockContext = {
        auth: {
          uid: "bootstrap123",
          token: { email: bootstrapEmail },
        },
      };
      expect(requireAdmin(mockContext)).toBe("bootstrap123");
    });

    it("is case-insensitive for bootstrap emails", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0].toUpperCase();
      const mockContext = {
        auth: {
          uid: "bootstrap123",
          token: { email: bootstrapEmail },
        },
      };
      expect(requireAdmin(mockContext)).toBe("bootstrap123");
    });

    it("throws unauthenticated error for missing auth", () => {
      const mockContext = {};
      expect(() => requireAdmin(mockContext)).toThrow("Authentication required.");
    });

    it("throws permission-denied for non-admin users", () => {
      const mockContext = {
        auth: {
          uid: "user123",
          token: { email: "user@example.com" },
        },
      };
      expect(() => requireAdmin(mockContext)).toThrow("Admin privileges required.");
      try {
        requireAdmin(mockContext);
      } catch (e) {
        expect(e.code).toBe("permission-denied");
      }
    });
  });
});
