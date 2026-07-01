import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { doc, setDoc, collection } from "firebase/firestore";

// Mock dependencies
vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

describe("tokenTracker Firestore Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should sync to user-isolated path when authenticated", async () => {
    const mockUser = { uid: "test-user-123" };
    getCurrentUser.mockReturnValue(mockUser);

    // Trigger sync via recordTokenUsage
    recordTokenUsage("test-op", 100, 50);

    // Wait for the fire-and-forget sync (it's async)
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage",
      expect.any(String)
    );
  });

  it("should not sync to Firestore if user is not authenticated", async () => {
    getCurrentUser.mockReturnValue(null);

    recordTokenUsage("test-op", 100, 50);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("should fetch from user-isolated path when authenticated", async () => {
    const mockUser = { uid: "test-user-123" };
    getCurrentUser.mockReturnValue(mockUser);

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage"
    );
  });

  it("should return empty array if fetching when not authenticated", async () => {
    getCurrentUser.mockReturnValue(null);

    const stats = await fetchCloudStats(7);

    expect(stats).toEqual([]);
    expect(collection).not.toHaveBeenCalled();
  });
});
