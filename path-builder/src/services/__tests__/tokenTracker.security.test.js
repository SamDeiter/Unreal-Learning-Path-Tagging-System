import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";
import { doc, setDoc, collection, getDocs, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Mock Firebase libraries
vi.mock("firebase/auth", () => {
  let mockUser = null;
  return {
    getAuth: vi.fn(() => ({
      get currentUser() {
        return mockUser;
      },
      // Setter to dynamic toggle
      _setMockUser: (user) => {
        mockUser = user;
      }
    }))
  };
});

vi.mock("firebase/firestore", () => {
  return {
    getFirestore: vi.fn(() => ({ type: "firestore" })),
    doc: vi.fn((db, ...segments) => ({ type: "docRef", segments })),
    setDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn((db, ...segments) => ({ type: "collectionRef", segments })),
    query: vi.fn((collRef, ...constraints) => ({ type: "queryRef", collRef, constraints })),
    orderBy: vi.fn((field, dir) => ({ type: "orderBy", field, dir })),
    limit: vi.fn((num) => ({ type: "limit", limit: num })),
    getDocs: vi.fn(() => Promise.resolve({
      docs: [
        { id: "2026-03-03", data: () => ({ totalInput: 100, totalOutput: 200 }) }
      ]
    }))
  };
});

vi.mock("../firebaseConfig", () => {
  return {
    getFirebaseApp: vi.fn(() => ({ name: "test-app" }))
  };
});

describe("tokenTracker Security & Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncDayToFirestore", () => {
    it("securely constructs user-scoped path when authenticated", async () => {
      // Setup dynamic auth user
      const mockUser = { uid: "user_abc_123" };
      const authInstance = getAuth();
      authInstance._setMockUser(mockUser);

      const dayData = {
        totalInput: 1000,
        totalOutput: 250,
        calls: 3,
        operations: { test: { input: 1000, output: 250, calls: 3 } }
      };

      await syncDayToFirestore("2026-03-03", dayData);

      // Verify doc() called with db reference and correct user-scoped segments
      expect(doc).toHaveBeenCalled();
      const docArgs = vi.mocked(doc).mock.calls[0];
      // first arg is firestore db ref
      expect(docArgs[0]).toEqual({ type: "firestore" });
      // subsequent args are segments of the document path
      expect(docArgs.slice(1)).toEqual(["users", "user_abc_123", "token_usage", "2026-03-03"]);

      // Verify setDoc called with correct arguments
      expect(setDoc).toHaveBeenCalled();
    });

    it("gracefully exits and does not write to firestore when unauthenticated", async () => {
      // Clear dynamic auth user
      const authInstance = getAuth();
      authInstance._setMockUser(null);

      const dayData = {
        totalInput: 1000,
        totalOutput: 250,
        calls: 3,
        operations: { test: { input: 1000, output: 250, calls: 3 } }
      };

      await syncDayToFirestore("2026-03-03", dayData);

      expect(doc).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe("fetchCloudStats", () => {
    it("securely queries user-scoped collection path when authenticated", async () => {
      // Setup dynamic auth user
      const mockUser = { uid: "user_xyz_789" };
      const authInstance = getAuth();
      authInstance._setMockUser(mockUser);

      const stats = await fetchCloudStats(15);

      // Verify collection path construct is scoped under current user
      expect(collection).toHaveBeenCalled();
      const collArgs = vi.mocked(collection).mock.calls[0];
      expect(collArgs[0]).toEqual({ type: "firestore" });
      expect(collArgs.slice(1)).toEqual(["users", "user_xyz_789", "token_usage"]);

      // Verify query includes correctly scoped collection ref
      expect(query).toHaveBeenCalled();
      const queryArgs = vi.mocked(query).mock.calls[0];
      expect(queryArgs[0]).toEqual({ type: "collectionRef", segments: ["users", "user_xyz_789", "token_usage"] });

      expect(getDocs).toHaveBeenCalled();
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({ id: "2026-03-03", totalInput: 100, totalOutput: 200 });
    });

    it("gracefully returns empty array and skips firestore query when unauthenticated", async () => {
      // Clear dynamic auth user
      const authInstance = getAuth();
      authInstance._setMockUser(null);

      const stats = await fetchCloudStats(15);

      expect(collection).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
      expect(stats).toEqual([]);
    });
  });
});
