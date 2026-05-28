/**
 * authGuard.test.js — tests for centralized auth guards.
 */

jest.mock("firebase-functions", () => ({
  https: {
    HttpsError: class extends Error {
      constructor(code, msg) {
        super(msg);
        this.code = code;
      }
    },
  },
}));

const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");

describe("authGuard helpers", () => {
  describe("requireAuth", () => {
    test("returns uid when authenticated (v1 context)", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    test("returns uid when authenticated (v2 request)", () => {
      const request = { auth: { uid: "user123" } };
      expect(requireAuth(request)).toBe("user123");
    });

    test("throws unauthenticated when no auth (v1 context)", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(/Authentication required/);
    });

    test("throws unauthenticated when no auth (v2 request)", () => {
      const request = { data: {} };
      expect(() => requireAuth(request)).toThrow(/Authentication required/);
    });
  });

  describe("requireAdmin", () => {
    test("returns uid when user has admin claim", () => {
      const context = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "other@example.com" }
        }
      };
      expect(requireAdmin(context)).toBe("admin123");
    });

    test("returns uid when user email is in bootstrap list", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0];
      const context = {
        auth: {
          uid: "boot123",
          token: { email: bootstrapEmail }
        }
      };
      expect(requireAdmin(context)).toBe("boot123");
    });

    test("returns uid when user email is in bootstrap list (case insensitive)", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0].toUpperCase();
      const context = {
        auth: {
          uid: "boot123",
          token: { email: bootstrapEmail }
        }
      };
      expect(requireAdmin(context)).toBe("boot123");
    });

    test("throws permission-denied for non-admin user", () => {
      const context = {
        auth: {
          uid: "pleb123",
          token: { email: "not_admin@example.com" }
        }
      };
      expect(() => requireAdmin(context)).toThrow(/Admin privileges required/);
    });

    test("throws unauthenticated when no auth", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(/Authentication required/);
    });
  });
});
