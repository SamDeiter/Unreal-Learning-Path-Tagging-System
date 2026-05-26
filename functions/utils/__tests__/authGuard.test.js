/**
 * Unit tests for authGuard utility.
 */
const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");
const { HttpsError } = require("firebase-functions/v2/https");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("returns uid for authenticated v1 context", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    it("returns uid for authenticated v2 request", () => {
      const request = { auth: { uid: "user123" } };
      expect(requireAuth(request)).toBe("user123");
    });

    it("throws unauthenticated error for missing auth", () => {
      const request = {};
      expect(() => requireAuth(request)).toThrow(HttpsError);
      try {
        requireAuth(request);
      } catch (err) {
        expect(err.code).toBe("unauthenticated");
      }
    });
  });

  describe("requireAdmin", () => {
    it("passes for user with admin custom claim", () => {
      const request = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "other@example.com" }
        }
      };
      expect(() => requireAdmin(request)).not.toThrow();
    });

    it("passes for user in BOOTSTRAP_ADMIN_EMAILS (case-insensitive)", () => {
      const email = BOOTSTRAP_ADMIN_EMAILS[0];
      const request = {
        auth: {
          uid: "bootstrap123",
          token: { email: email.toUpperCase() }
        }
      };
      expect(() => requireAdmin(request)).not.toThrow();
    });

    it("throws unauthenticated error for missing auth", () => {
      const request = {};
      expect(() => requireAdmin(request)).toThrow(HttpsError);
      try {
        requireAdmin(request);
      } catch (err) {
        expect(err.code).toBe("unauthenticated");
      }
    });

    it("throws permission-denied for non-admin user", () => {
      const request = {
        auth: {
          uid: "user123",
          token: { email: "regular@example.com" }
        }
      };
      expect(() => requireAdmin(request)).toThrow(HttpsError);
      try {
        requireAdmin(request);
      } catch (err) {
        expect(err.code).toBe("permission-denied");
      }
    });
  });
});
