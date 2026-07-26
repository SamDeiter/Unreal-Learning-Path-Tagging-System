import { describe, it, expect, vi, beforeEach } from "vitest";

// Dynamic currentUser toggle
let mockCurrentUser = null;

// Mock firebaseConfig so the module-level getFirebaseApp() doesn't throw
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" }))
}));

// Mock firestore with spread operator (...segments) for doc/collection
const mockDoc = vi.fn((...args) => args);
const mockCollection = vi.fn((...args) => args);
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn(() => ({ docs: [] }));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  collection: (...args) => mockCollection(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  limit: vi.fn((...args) => args),
}));

// Mock firebase/auth with dynamic currentUser property
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser;
    }
  })),
}));

import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";

describe("tokenTracker security", () => {
  beforeEach(() => {
    mockCurrentUser = null;
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockSetDoc.mockClear();
    mockGetDocs.mockClear();
  });

  describe("syncDayToFirestore", () => {
    it("should skip syncing if user is unauthenticated", async () => {
      mockCurrentUser = null;
      await syncDayToFirestore("2026-05-21", { totalInput: 100, totalOutput: 200, calls: 1, operations: {} });
      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should use secure user-scoped path when authenticated", async () => {
      mockCurrentUser = { uid: "user_abc_123" };
      await syncDayToFirestore("2026-05-21", { totalInput: 100, totalOutput: 200, calls: 1, operations: {} });
      expect(mockDoc).toHaveBeenCalled();

      // Get the arguments of the first call to doc()
      // doc(db, "users", user.uid, "token_usage", dateKey)
      const docArgs = mockDoc.mock.calls[0];
      expect(docArgs[1]).toBe("users");
      expect(docArgs[2]).toBe("user_abc_123");
      expect(docArgs[3]).toBe("token_usage");
      expect(docArgs[4]).toBe("2026-05-21");

      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats", () => {
    it("should return empty array if user is unauthenticated", async () => {
      mockCurrentUser = null;
      const result = await fetchCloudStats(30);
      expect(result).toEqual([]);
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should query secure user-scoped subcollection path when authenticated", async () => {
      mockCurrentUser = { uid: "user_abc_123" };
      await fetchCloudStats(30);
      expect(mockCollection).toHaveBeenCalled();

      // collection(db, "users", user.uid, "token_usage")
      const collArgs = mockCollection.mock.calls[0];
      expect(collArgs[1]).toBe("users");
      expect(collArgs[2]).toBe("user_abc_123");
      expect(collArgs[3]).toBe("token_usage");
    });
  });
});
