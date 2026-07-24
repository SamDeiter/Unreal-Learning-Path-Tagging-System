import { vi, describe, it, expect, beforeEach } from "vitest";
import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";

// Dynamic currentUser state for Firebase Auth mock
let mockCurrentUser = null;

// Mock firebaseConfig
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

// Mock firebase/auth dynamically
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser;
    },
  })),
}));

// Mock firestore
const mockDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockCollection = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: vi.fn((...args) => {
    mockDoc(...args);
    return { type: "documentRef", path: args.slice(1).join("/") };
  }),
  setDoc: vi.fn((...args) => mockSetDoc(...args)),
  collection: vi.fn((...args) => {
    mockCollection(...args);
    return { type: "collectionRef", path: args.slice(1).join("/") };
  }),
  getDocs: vi.fn((...args) => mockGetDocs(...args)),
  query: vi.fn((...args) => {
    mockQuery(...args);
    return { type: "queryRef" };
  }),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

describe("tokenTracker.security", () => {
  beforeEach(() => {
    mockCurrentUser = null;
    mockDoc.mockClear();
    mockSetDoc.mockClear();
    mockCollection.mockClear();
    mockGetDocs.mockClear();
    mockQuery.mockClear();
  });

  describe("syncDayToFirestore", () => {
    it("should skip sync and not call doc or setDoc when user is not authenticated", async () => {
      mockCurrentUser = null;
      const dayData = { totalInput: 100, totalOutput: 200, calls: 5, operations: {} };

      await syncDayToFirestore("2026-03-03", dayData);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should sync to user-scoped path users/{uid}/token_usage/{dateKey} when authenticated", async () => {
      mockCurrentUser = { uid: "user_secure_xyz_456" };
      const dayData = { totalInput: 1500, totalOutput: 800, calls: 3, operations: {} };

      await syncDayToFirestore("2026-03-03", dayData);

      expect(mockDoc).toHaveBeenCalled();
      // Ensure it gets the firestore database, nested collections and uid
      const firstCallArgs = mockDoc.mock.calls[0];
      expect(firstCallArgs[0]).toEqual({ type: "firestore" });
      expect(firstCallArgs[1]).toBe("users");
      expect(firstCallArgs[2]).toBe("user_secure_xyz_456");
      expect(firstCallArgs[3]).toBe("token_usage");
      expect(firstCallArgs[4]).toBe("2026-03-03");

      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockSetDoc.mock.calls[0][0]).toEqual({
        type: "documentRef",
        path: "users/user_secure_xyz_456/token_usage/2026-03-03",
      });
      expect(mockSetDoc.mock.calls[0][1]).toMatchObject({
        date: "2026-03-03",
        totalInput: 1500,
        totalOutput: 800,
        calls: 3,
      });
    });
  });

  describe("fetchCloudStats", () => {
    it("should return empty array and not call query or collection when user is not authenticated", async () => {
      mockCurrentUser = null;

      const result = await fetchCloudStats(7);

      expect(result).toEqual([]);
      expect(mockCollection).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should fetch stats from user-scoped subcollection when authenticated", async () => {
      mockCurrentUser = { uid: "user_secure_xyz_456" };

      // Mock snapshot resolve
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: "2026-03-03",
            data: () => ({ totalInput: 500, totalOutput: 100 }),
          },
        ],
      });

      const result = await fetchCloudStats(7);

      expect(mockCollection).toHaveBeenCalled();
      const colArgs = mockCollection.mock.calls[0];
      expect(colArgs[0]).toEqual({ type: "firestore" });
      expect(colArgs[1]).toBe("users");
      expect(colArgs[2]).toBe("user_secure_xyz_456");
      expect(colArgs[3]).toBe("token_usage");

      expect(mockQuery).toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();
      expect(result).toEqual([
        { id: "2026-03-03", totalInput: 500, totalOutput: 100 },
      ]);
    });
  });
});
