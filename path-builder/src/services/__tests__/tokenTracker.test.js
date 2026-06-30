import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { doc, setDoc, collection } from "firebase/firestore";

// Mock Firebase
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

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

describe("tokenTracker Firestore isolation", () => {
  const mockUser = { uid: "test-user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getCurrentUser.mockReturnValue(mockUser);
  });

  it("syncDayToFirestore uses user-isolated path", async () => {
    // recordTokenUsage calls syncDayToFirestore internally
    recordTokenUsage("test-op", 100, 50);

    // Wait for the fire-and-forget syncDayToFirestore
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage",
      expect.any(String)
    );
  });

  it("fetchCloudStats uses user-isolated collection path", async () => {
    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage"
    );
  });

  it("does not sync to Firestore if user is not logged in", async () => {
    getCurrentUser.mockReturnValue(null);

    recordTokenUsage("test-op", 100, 50);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(setDoc).not.toHaveBeenCalled();
  });
});
