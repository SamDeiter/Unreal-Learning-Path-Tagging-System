import { describe, it, expect, vi, beforeEach } from "vitest";

// Dynamic currentUser tracking for the tests
let mockCurrentUser = null;

// Mock firebaseConfig so the module-level getFirebaseApp() doesn't throw
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ type: "firebase-app" })),
}));

// Mock firebase/auth
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser;
    },
  })),
}));

// Mock firebase/firestore
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
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

import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";

describe("tokenTracker Security - User-Scoped Path Construction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
  });

  describe("syncDayToFirestore", () => {
    it("should construct user-scoped nested path when authenticated", async () => {
      mockCurrentUser = { uid: "test-uid-123" };
      const dateKey = "2026-03-03";
      const dayData = {
        totalInput: 100,
        totalOutput: 50,
        calls: 2,
        operations: { testOp: { input: 100, output: 50, calls: 2 } },
      };

      // Set up mockDoc behavior to return a dummy ref
      mockDoc.mockReturnValue({ type: "doc-ref", path: "users/test-uid-123/token_usage/2026-03-03" });
      mockSetDoc.mockResolvedValue();

      await syncDayToFirestore(dateKey, dayData);

      // Verify doc() was called with correct user-scoped parameters
      // e.g., doc(db, "users", uid, "token_usage", dateKey)
      expect(mockDoc).toHaveBeenCalledWith(
        expect.any(Object), // db
        "users",
        "test-uid-123",
        "token_usage",
        dateKey
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          date: dateKey,
          totalInput: 100,
          totalOutput: 50,
        }),
        { merge: true }
      );
    });

    it("should reject sync when user is unauthenticated", async () => {
      mockCurrentUser = null;
      const dateKey = "2026-03-03";
      const dayData = { totalInput: 10, totalOutput: 5, calls: 1, operations: {} };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await syncDayToFirestore(dateKey, dayData);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No authenticated user found for sync")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("fetchCloudStats", () => {
    it("should construct query for user-scoped collection when authenticated", async () => {
      mockCurrentUser = { uid: "test-uid-456" };
      mockCollection.mockReturnValue({ type: "collection-ref" });
      mockGetDocs.mockResolvedValue({ docs: [] });

      await fetchCloudStats(30);

      expect(mockCollection).toHaveBeenCalledWith(
        expect.any(Object), // db
        "users",
        "test-uid-456",
        "token_usage"
      );
      expect(mockQuery).toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it("should return empty array and not query firestore when unauthenticated", async () => {
      mockCurrentUser = null;

      const result = await fetchCloudStats(30);

      expect(result).toEqual([]);
      expect(mockCollection).not.toHaveBeenCalled();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });
});
