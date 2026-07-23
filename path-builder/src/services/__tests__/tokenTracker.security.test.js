import { describe, it, expect, vi, beforeEach } from "vitest";
import { doc, collection, setDoc, getDocs } from "firebase/firestore";
import { getFirebaseApp } from "../firebaseConfig";
import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";

// Mock Firebase Config
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "path-builder" })),
}));

// Mock Firestore
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: vi.fn((db, ...segments) => ({ type: "doc", db, segments })),
  collection: vi.fn((db, ...segments) => ({ type: "collection", db, segments })),
  setDoc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock Auth with dynamic getter
let currentMockUser = { uid: "test-user-123" };
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return currentMockUser;
    },
  })),
}));

describe("tokenTracker Firestore security tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = { uid: "test-user-123" };
  });

  describe("syncDayToFirestore user-scoped path verification", () => {
    it("should construct user-scoped Firestore doc path under /users/{uid}/token_usage/{date}", async () => {
      const dateKey = "2026-03-03";
      const dayData = {
        totalInput: 1000,
        totalOutput: 200,
        calls: 3,
        operations: {
          embedQuery: { input: 1000, output: 200, calls: 3 }
        }
      };

      await syncDayToFirestore(dateKey, dayData);

      // Verify getFirebaseApp was called to check E2E bypass
      expect(getFirebaseApp).toHaveBeenCalled();

      // Verify doc() mock was called with exact nested segments
      expect(doc).toHaveBeenCalled();
      const docCallArgs = vi.mocked(doc).mock.calls[0];
      // docCallArgs[0] is db ref
      expect(docCallArgs[0]).toEqual({ type: "firestore" });
      // The remaining arguments are the path segments
      expect(docCallArgs.slice(1)).toEqual(["users", "test-user-123", "token_usage", "2026-03-03"]);

      // Verify setDoc was called with the returned docRef
      expect(setDoc).toHaveBeenCalled();
      const setDocCallArgs = vi.mocked(setDoc).mock.calls[0];
      expect(setDocCallArgs[0]).toEqual({
        type: "doc",
        db: { type: "firestore" },
        segments: ["users", "test-user-123", "token_usage", "2026-03-03"],
      });
      expect(setDocCallArgs[1].date).toBe(dateKey);
    });

    it("should do nothing if no authenticated user is present", async () => {
      currentMockUser = null;

      const dateKey = "2026-03-03";
      await syncDayToFirestore(dateKey, {});

      expect(doc).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats user-scoped query verification", () => {
    it("should query the user-scoped collection under /users/{uid}/token_usage", async () => {
      await fetchCloudStats(7);

      expect(collection).toHaveBeenCalled();
      const colCallArgs = vi.mocked(collection).mock.calls[0];
      expect(colCallArgs[0]).toEqual({ type: "firestore" });
      expect(colCallArgs.slice(1)).toEqual(["users", "test-user-123", "token_usage"]);

      expect(getDocs).toHaveBeenCalled();
    });

    it("should return empty array if no authenticated user is present", async () => {
      currentMockUser = null;

      const result = await fetchCloudStats(7);
      expect(result).toEqual([]);
      expect(collection).not.toHaveBeenCalled();
    });
  });
});
