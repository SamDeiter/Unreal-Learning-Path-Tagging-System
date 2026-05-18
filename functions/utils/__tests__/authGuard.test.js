const { requireAuth, requireAdmin } = require("../authGuard");

describe("authGuard", () => {
  describe("requireAuth", () => {
    test("returns uid when auth is present", () => {
      const context = { auth: { uid: "user123" } };
      expect(requireAuth(context)).toBe("user123");
    });

    test("throws unauthenticated error when auth is missing", () => {
      const context = {};
      expect(() => requireAuth(context)).toThrow(
        expect.objectContaining({
          code: "unauthenticated"
        })
      );
    });
  });

  describe("requireAdmin", () => {
    const originalEnv = process.env.ADMIN_UID;

    afterEach(() => {
      process.env.ADMIN_UID = originalEnv;
    });

    test("returns uid when user has admin claim", () => {
      const context = {
        auth: {
          uid: "admin1",
          token: { admin: true }
        }
      };
      expect(requireAdmin(context)).toBe("admin1");
    });

    test("returns uid when user email is in bootstrap list", () => {
      const context = {
        auth: {
          uid: "user1",
          token: { email: "sam.deiter@epicgames.com" }
        }
      };
      expect(requireAdmin(context)).toBe("user1");
    });

    test("returns uid when user uid is in ADMIN_UID env var", () => {
      process.env.ADMIN_UID = "uid1,uid2";
      const context = {
        auth: {
          uid: "uid2",
          token: { email: "other@example.com" }
        }
      };
      expect(requireAdmin(context)).toBe("uid2");
    });

    test("throws permission-denied when user is not admin", () => {
      const context = {
        auth: {
          uid: "user1",
          token: { email: "regular@example.com" }
        }
      };
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({
          code: "permission-denied"
        })
      );
    });

    test("throws unauthenticated when user is not signed in", () => {
      const context = {};
      expect(() => requireAdmin(context)).toThrow(
        expect.objectContaining({
          code: "unauthenticated"
        })
      );
    });
  });
});
