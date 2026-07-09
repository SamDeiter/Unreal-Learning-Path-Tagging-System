import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { getFirestore, doc, setDoc, collection, getDocs } from "firebase/firestore";

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

describe("tokenTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("syncDayToFirestore", () => {
    it("should not sync if user is not logged in", async () => {
      getCurrentUser.mockReturnValue(null);
      recordTokenUsage("test-op", 100, 50);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it("should sync to the correct per-user path if logged in", async () => {
      const mockUser = { uid: "test-uid" };
      getCurrentUser.mockReturnValue(mockUser);

      const mockDb = {};
      getFirestore.mockReturnValue(mockDb);

      const mockDocRef = { id: "test-doc" };
      doc.mockReturnValue(mockDocRef);

      recordTokenUsage("test-op", 100, 50);

      // We need to wait a bit because syncDayToFirestore is fire-and-forget
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(doc).toHaveBeenCalledWith(mockDb, "users", "test-uid", "token_usage", expect.any(String));
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
        totalInput: 100,
        totalOutput: 50,
      }), { merge: true });
    });
  });

  describe("fetchCloudStats", () => {
    it("should return empty array if user is not logged in", async () => {
      getCurrentUser.mockReturnValue(null);
      const stats = await fetchCloudStats();
      expect(stats).toEqual([]);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it("should fetch from the correct per-user collection if logged in", async () => {
      const mockUser = { uid: "test-uid" };
      getCurrentUser.mockReturnValue(mockUser);

      const mockDb = {};
      getFirestore.mockReturnValue(mockDb);

      const mockCollection = { id: "test-collection" };
      collection.mockReturnValue(mockCollection);

      getDocs.mockResolvedValue({
        docs: [
          { id: "2026-03-01", data: () => ({ totalInput: 1000 }) }
        ]
      });

      const stats = await fetchCloudStats(7);

      expect(collection).toHaveBeenCalledWith(mockDb, "users", "test-uid", "token_usage");
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({ id: "2026-03-01", totalInput: 1000 });
    });
  });
});
