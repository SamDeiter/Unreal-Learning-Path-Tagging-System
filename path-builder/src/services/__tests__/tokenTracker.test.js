import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { doc, getDocs, collection } from "firebase/firestore";

// Mock dependencies
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

describe("tokenTracker Firestore Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("syncs to per-user token_usage collection", async () => {
    getCurrentUser.mockReturnValue({ uid: "test-user-123" });

    recordTokenUsage("testOp", 100, 50);

    // Wait for sync (it's fire-and-forget in code)
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "test-user-123",
      "token_usage",
      expect.any(String)
    );
  });

  it("fetches from per-user token_usage collection", async () => {
    getCurrentUser.mockReturnValue({ uid: "test-user-123" });
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "test-user-123",
      "token_usage"
    );
  });
});
