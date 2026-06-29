import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "db" })),
  doc: vi.fn((...args) => ({ type: "doc", path: args.join("/") })),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn((...args) => ({ type: "collection", path: args.join("/") })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn((col) => ({ ...col, type: "query" })),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ type: "app" })),
}));

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";

describe("tokenTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("syncDayToFirestore", () => {
    it("should not sync if user is not authenticated", async () => {
      getCurrentUser.mockReturnValue(null);

      // recordTokenUsage calls syncDayToFirestore internally
      recordTokenUsage("test-op", 10, 20);

      expect(setDoc).not.toHaveBeenCalled();
    });

    it("should sync to user-isolated path if authenticated", async () => {
      const mockUser = { uid: "user123" };
      getCurrentUser.mockReturnValue(mockUser);

      recordTokenUsage("test-op", 10, 20);

      // Wait for the async syncDayToFirestore call (which is fire-and-forget in the code, but we can check if doc was called)
      // Actually, since it's fire-and-forget with no await, we might need a small delay or check mocks

      expect(doc).toHaveBeenCalledWith(
        expect.anything(),
        "users",
        "user123",
        "token_usage",
        expect.any(String)
      );
    });
  });

  describe("fetchCloudStats", () => {
    it("should return empty array if no user", async () => {
      getCurrentUser.mockReturnValue(null);
      const stats = await fetchCloudStats();
      expect(stats).toEqual([]);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it("should query from user-isolated collection", async () => {
      getCurrentUser.mockReturnValue({ uid: "user456" });
      await fetchCloudStats();

      expect(collection).toHaveBeenCalledWith(
        expect.anything(),
        "users",
        "user456",
        "token_usage"
      );
    });
  });
});
