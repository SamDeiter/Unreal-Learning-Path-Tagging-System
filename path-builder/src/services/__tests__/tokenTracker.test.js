import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { doc, collection } from "firebase/firestore";
import { getCurrentUser } from "../googleAuthService";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue({}),
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn().mockReturnValue({}),
}));

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
  default: {},
}));

describe("tokenTracker security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("syncs token usage to a per-user collection", async () => {
    const mockUid = "test-user-123";
    getCurrentUser.mockReturnValue({ uid: mockUid });

    recordTokenUsage("test-op", 100, 50);

    // Wait for the async syncDayToFirestore call (fire-and-forget)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if doc was called with the user-specific path
    // EXPECTED (Secure): users/test-user-123/token_usage/YYYY-MM-DD
    // CURRENT (Insecure): token_usage/YYYY-MM-DD
    expect(doc).toHaveBeenCalledWith(
      undefined, // db instance from mock
      "users",
      mockUid,
      "token_usage",
      expect.any(String)
    );
  });

  it("fetches cloud stats from the per-user collection", async () => {
    const mockUid = "test-user-123";
    getCurrentUser.mockReturnValue({ uid: mockUid });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      undefined, // db instance from mock
      "users",
      mockUid,
      "token_usage"
    );
  });
});
