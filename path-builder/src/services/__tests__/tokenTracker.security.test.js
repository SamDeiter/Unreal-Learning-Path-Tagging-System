import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebaseConfig
const mockFirebaseApp = { name: "[DEFAULT]" };
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => mockFirebaseApp),
}));

// Mock firebase/firestore
const mockDocRef = { type: "docRef" };
const mockDoc = vi.fn(() => mockDocRef);
const mockCollectionRef = { type: "collectionRef" };
const mockCollection = vi.fn(() => mockCollectionRef);
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn(() => ({ docs: [] }));
const mockQuery = vi.fn();

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: (...args) => mockDoc(...args),
  collection: (...args) => mockCollection(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock firebase/auth
const mockCurrentUser = { uid: "test-user-123" };
const mockGetAuth = vi.fn(() => ({
  currentUser: mockCurrentUser,
}));

vi.mock("firebase/auth", () => ({
  getAuth: (...args) => mockGetAuth(...args),
}));

import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";

describe("tokenTracker security and user-isolation tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.uid = "test-user-123";
  });

  describe("syncDayToFirestore", () => {
    it("should construct the correct user-scoped path with the current user's UID", async () => {
      const dateKey = "2026-03-03";
      const dayData = {
        totalInput: 100,
        totalOutput: 200,
        calls: 3,
        operations: {},
      };

      await syncDayToFirestore(dateKey, dayData);

      expect(mockDoc).toHaveBeenCalledWith(
        expect.any(Object), // db
        "users",
        "test-user-123",
        "token_usage",
        dateKey
      );
      expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object), { merge: true });
    });

    it("should abort synchronization if there is no authenticated user", async () => {
      mockCurrentUser.uid = null;
      // Also test when currentUser is null entirely
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      const dateKey = "2026-03-03";
      const dayData = { totalInput: 100, totalOutput: 200, calls: 3, operations: {} };

      await syncDayToFirestore(dateKey, dayData);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats", () => {
    it("should construct the correct user-scoped collection path with the current user's UID", async () => {
      await fetchCloudStats(30);

      expect(mockCollection).toHaveBeenCalledWith(
        expect.any(Object), // db
        "users",
        "test-user-123",
        "token_usage"
      );
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it("should return an empty array if there is no authenticated user", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      const result = await fetchCloudStats(30);

      expect(result).toEqual([]);
      expect(mockCollection).not.toHaveBeenCalled();
    });
  });
});
