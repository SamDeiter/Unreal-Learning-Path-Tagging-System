import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, getDocs, collectionGroup } from "firebase/firestore";
import { isAdmin } from "../accessControl";

// Mock Firebase services
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../accessControl", () => ({
  isAdmin: vi.fn(),
}));

describe("tokenTracker service", () => {
  const mockUser = { uid: "test-user-123" };
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    getAuth.mockReturnValue({ currentUser: mockUser });
    getFirestore.mockReturnValue(mockDb);
    localStorage.clear();
  });

  describe("recordTokenUsage", () => {
    it("syncs to user-isolated path in Firestore", async () => {
      const mockDocRef = {};
      doc.mockReturnValue(mockDocRef);
      setDoc.mockResolvedValue({});

      recordTokenUsage("test-op", 100, 50);

      // Verify doc path construction: token_usage/{uid}/usage/{date}
      expect(doc).toHaveBeenCalledWith(
        mockDb,
        "token_usage",
        mockUser.uid,
        "usage",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.anything(), { merge: true });
    });

    it("does nothing if no user is authenticated", async () => {
      getAuth.mockReturnValue({ currentUser: null });
      recordTokenUsage("test-op", 100, 50);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats", () => {
    it("fetches from user subcollection for regular users", async () => {
      isAdmin.mockResolvedValue(false);
      const mockCollection = {};
      collection.mockReturnValue(mockCollection);
      getDocs.mockResolvedValue({ docs: [] });

      await fetchCloudStats(7);

      expect(collection).toHaveBeenCalledWith(mockDb, "token_usage", mockUser.uid, "usage");
      expect(collectionGroup).not.toHaveBeenCalled();
    });

    it("uses collectionGroup for administrators", async () => {
      isAdmin.mockResolvedValue(true);
      const mockGroup = {};
      collectionGroup.mockReturnValue(mockGroup);
      getDocs.mockResolvedValue({
        docs: [
          { data: () => ({ date: "2026-04-01", totalInput: 100, totalOutput: 50, estimatedCost: 0.01, calls: 1 }) },
          { data: () => ({ date: "2026-04-01", totalInput: 200, totalOutput: 100, estimatedCost: 0.02, calls: 1 }) },
        ]
      });

      const stats = await fetchCloudStats(7);

      expect(collectionGroup).toHaveBeenCalledWith(mockDb, "usage");
      // Verify aggregation by date
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        date: "2026-04-01",
        totalInput: 300,
        totalOutput: 150,
        estimatedCost: 0.03,
        calls: 2
      });
    });
  });
});
