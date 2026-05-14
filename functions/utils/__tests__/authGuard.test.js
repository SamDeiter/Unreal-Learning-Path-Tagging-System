const { requireAuth, requireAdmin } = require("../authGuard");
const functions = require("firebase-functions");

describe("authGuard", () => {
  describe("requireAuth", () => {
    it("should return uid if authenticated", () => {
      const request = {
        auth: { uid: "test-uid" }
      };
      expect(requireAuth(request)).toBe("test-uid");
    });

    it("should throw unauthenticated error if not authenticated", () => {
      const request = {};
      expect(() => requireAuth(request)).toThrow(
        expect.objectContaining({
          code: "unauthenticated",
          message: "Authentication required."
        })
      );
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

    it("should return uid if user is an admin via custom claim", () => {
      const request = {
        auth: {
          uid: "admin-uid",
          token: { admin: true }
        }
      };
      expect(requireAdmin(request)).toBe("admin-uid");
    });

    it("should return uid if user is in ADMIN_UID env var", () => {
      process.env.ADMIN_UID = "env-admin-uid,other-uid";
      const request = {
        auth: {
          uid: "env-admin-uid",
          token: {}
        }
      };
      expect(requireAdmin(request)).toBe("env-admin-uid");
    });

    it("should throw unauthenticated error if not authenticated", () => {
      const request = {};
      expect(() => requireAdmin(request)).toThrow(
        expect.objectContaining({
          code: "unauthenticated"
        })
      );
    });

    it("should throw permission-denied error if user is not an admin", () => {
      const request = {
        auth: {
          uid: "user-uid",
          token: { admin: false }
        }
      };
      expect(() => requireAdmin(request)).toThrow(
        expect.objectContaining({
          code: "permission-denied",
          message: "Admin privileges required."
        })
      );
    });

    it("should throw permission-denied error if admin claim is missing and not in env", () => {
      const request = {
        auth: {
          uid: "user-uid",
          token: {}
        }
      };
      expect(() => requireAdmin(request)).toThrow(
        expect.objectContaining({
          code: "permission-denied"
        })
      );
    });
  });
});
