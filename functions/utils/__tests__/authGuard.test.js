const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");
const functions = require("firebase-functions");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("throws unauthenticated if no auth is present (v1/v2 context)", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(
        expect.objectContaining({
          code: "unauthenticated",
          message: "Authentication required.",
        })
      );
    });

    it("returns uid if auth is present (v1/v2 context)", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });
  });

  describe("requireAdmin", () => {
    it("throws unauthenticated if no auth is present", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow();
    });

    it("throws permission-denied if user is not admin and not in bootstrap list", () => {
      const context = {
        auth: {
          uid: "user123",
          token: { email: "regular@example.com" },
        },
      };
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({
          code: "permission-denied",
          message: "Admin privileges required.",
        })
      );
    });

    it("allows access if user has admin claim", () => {
      const context = {
        auth: {
          uid: "admin123",
          token: { email: "admin@example.com", admin: true },
        },
      };
      expect(requireAdmin(context)).toBe("admin123");
    });

    it("allows access if user email is in bootstrap list", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0];
      const context = {
        auth: {
          uid: "bootstrap123",
          token: { email: bootstrapEmail },
        },
      };
      expect(requireAdmin(context)).toBe("bootstrap123");
    });

    it("allows access if user email in bootstrap list is different case", () => {
      const bootstrapEmail = BOOTSTRAP_ADMIN_EMAILS[0].toUpperCase();
      const context = {
        auth: {
          uid: "bootstrap123",
          token: { email: bootstrapEmail },
        },
      };
      expect(requireAdmin(context)).toBe("bootstrap123");
    });
  });
});
