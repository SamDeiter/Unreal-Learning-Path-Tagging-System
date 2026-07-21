import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, setDoc, getDocs } from "firebase/firestore";

// Mock firebaseConfig
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ type: "firebase-app" })),
}));

// Mock firebase/auth
const mockCurrentUser = { uid: null };
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Mock firebase/firestore
vi.mock("firebase/firestore", () => {
  return {
    getFirestore: vi.fn(() => ({ type: "firestore-db" })),
    doc: vi.fn((db, ...segments) => ({ type: "doc-ref", segments })),
    collection: vi.fn((db, ...segments) => ({ type: "col-ref", segments })),
    setDoc: vi.fn(),
    getDocs: vi.fn(() => ({ docs: [] })),
    query: vi.fn((ref, ...constraints) => ({ type: "query-ref", ref, constraints })),
    orderBy: vi.fn(() => "order-by-constraint"),
    limit: vi.fn(() => "limit-constraint"),
  };
});

describe("tokenTracker security and path isolation tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.uid = null;
  });

  describe("syncDayToFirestore", () => {
    it("should return early when user is not authenticated", async () => {
      mockCurrentUser.uid = null;
      await syncDayToFirestore("2026-05-21", { totalInput: 100, totalOutput: 200, calls: 5 });
      expect(doc).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });

    it("should construct secure user-isolated path when user is authenticated", async () => {
      mockCurrentUser.uid = "test-user-123";
      await syncDayToFirestore("2026-05-21", { totalInput: 100, totalOutput: 200, calls: 5 });

      expect(doc).toHaveBeenCalled();
      const mockDb = getFirestore();
      expect(doc).toHaveBeenCalledWith(mockDb, "users", "test-user-123", "token_usage", "2026-05-21");
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats", () => {
    it("should return empty array when user is not authenticated", async () => {
      mockCurrentUser.uid = null;
      const result = await fetchCloudStats(30);
      expect(result).toEqual([]);
      expect(collection).not.toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it("should query secure user-isolated subcollection when user is authenticated", async () => {
      mockCurrentUser.uid = "test-user-123";
      await fetchCloudStats(30);

      expect(collection).toHaveBeenCalled();
      const mockDb = getFirestore();
      expect(collection).toHaveBeenCalledWith(mockDb, "users", "test-user-123", "token_usage");
      expect(getDocs).toHaveBeenCalled();
    });
  });
});
