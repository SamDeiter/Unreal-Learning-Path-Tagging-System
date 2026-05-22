const { requireAdmin, requireAuth } = require("../authGuard");
const assert = require("assert");

// Mock functions to avoid needing the full firebase-functions package
const mockHttpsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};

const mockFunctions = {
  https: {
    HttpsError: mockHttpsError
  }
};

// Inject mock into requireAuth and requireAdmin scope if needed,
// but authGuard already requires it. Let's see if we can just mock it globally.
require.cache[require.resolve("firebase-functions")] = {
  exports: mockFunctions,
  https: mockFunctions.https
};

describe("AuthGuard", () => {
  describe("requireAuth", () => {
    it("should return uid if authenticated (v1)", () => {
      const context = { auth: { uid: "user123" } };
      assert.strictEqual(requireAuth(context), "user123");
    });

    it("should return uid if authenticated (v2)", () => {
      const request = { auth: { uid: "user123" } };
      assert.strictEqual(requireAuth(request), "user123");
    });

    it("should throw unauthenticated if not authenticated", () => {
      const context = {};
      try {
        requireAuth(context);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.strictEqual(e.code, "unauthenticated");
      }
    });
  });

  describe("requireAdmin", () => {
    it("should return uid if admin claim is true", () => {
      const context = { auth: { uid: "admin123", token: { admin: true } } };
      assert.strictEqual(requireAdmin(context), "admin123");
    });

    it("should return uid if email is in bootstrap list", () => {
      const context = { auth: { uid: "sam123", token: { email: "sam.deiter@epicgames.com" } } };
      assert.strictEqual(requireAdmin(context), "sam123");
    });

    it("should throw permission-denied if not admin", () => {
      const context = { auth: { uid: "user123", token: { email: "user@example.com" } } };
      try {
        requireAdmin(context);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.strictEqual(e.code, "permission-denied");
      }
    });

    it("should throw unauthenticated if not authenticated", () => {
      const context = {};
      try {
        requireAdmin(context);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.strictEqual(e.code, "unauthenticated");
      }
    });
  });
});
