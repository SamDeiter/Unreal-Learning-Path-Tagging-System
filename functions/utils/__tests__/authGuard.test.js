/**
 * Unit tests for centralized authorization guards.
 */
const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");
const { HttpsError } = require("firebase-functions/v2/https");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("returns uid for valid v1 context", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    it("returns uid for valid v2 request", () => {
      const request = { auth: { uid: "user456" } };
      expect(requireAuth(request)).toBe("user456");
    });

    it("throws unauthenticated for missing auth", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });
  });

  describe("requireAdmin", () => {
    it("returns uid for user with admin custom claim", () => {
      const context = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "someone@example.com" }
        }
      };
      expect(requireAdmin(context)).toBe("admin123");
    });

    it("returns uid for bootstrap admin email (case insensitive)", () => {
      const email = BOOTSTRAP_ADMIN_EMAILS[0];
      const context = {
        auth: {
          uid: "bootstrap123",
          token: { email: email.toUpperCase() }
        }
      };
      expect(requireAdmin(context)).toBe("bootstrap123");
    });

    it("throws unauthenticated if no auth", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });

    it("throws permission-denied for non-admin user", () => {
      const context = {
        auth: {
          uid: "user789",
          token: { email: "regular@example.com" }
        }
      };
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({ code: "permission-denied" })
      );
    });
  });
});
