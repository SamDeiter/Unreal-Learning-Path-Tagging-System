const { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS } = require("../authGuard");
const { HttpsError } = require("firebase-functions/v2/https");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("should return uid if auth is present (v1/context)", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    it("should return uid if auth is present (v2/request)", () => {
      const request = { auth: { uid: "user123" } };
      expect(requireAuth(request)).toBe("user123");
    });

    it("should throw unauthenticated error if auth is missing", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(
        expect.objectContaining({
          code: "unauthenticated",
        })
      );
    });
  });

  describe("requireAdmin", () => {
    it("should return uid if user has admin claim (v1/context)", () => {
      const context = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "other@example.com" },
        },
      };
      expect(requireAdmin(context)).toBe("admin123");
    });

    it("should return uid if user has admin claim (v2/request)", () => {
      const request = {
        auth: {
          uid: "admin123",
          token: { admin: true, email: "other@example.com" },
        },
      };
      expect(requireAdmin(request)).toBe("admin123");
    });

    it("should return uid if user email is in bootstrap list", () => {
      const context = {
        auth: {
          uid: "bootstrap123",
          token: { email: BOOTSTRAP_ADMIN_EMAILS[0] },
        },
      };
      expect(requireAdmin(context)).toBe("bootstrap123");
    });

    it("should be case-insensitive for bootstrap emails", () => {
      const context = {
        auth: {
          uid: "bootstrap123",
          token: { email: BOOTSTRAP_ADMIN_EMAILS[0].toUpperCase() },
        },
      };
      expect(requireAdmin(context)).toBe("bootstrap123");
    });

    it("should throw unauthenticated if auth is missing", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({
          code: "unauthenticated",
        })
      );
    });

    it("should throw permission-denied if user is not admin", () => {
      const context = {
        auth: {
          uid: "user123",
          token: { email: "regular@example.com" },
        },
      };
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({
          code: "permission-denied",
        })
      );
    });
  });
});
