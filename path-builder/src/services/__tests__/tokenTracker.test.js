import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getAuth } from "firebase/auth";
import { doc, setDoc, getDocs, collection, collectionGroup } from "firebase/firestore";

// Mock Firebase
vi.mock("firebase/auth");
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  collectionGroup: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

describe("tokenTracker", () => {
  const mockUser = { uid: "test-user-123", getIdTokenResult: vi.fn() };
  const mockAuth = { currentUser: mockUser };

  beforeEach(() => {
    vi.clearAllMocks();
    getAuth.mockReturnValue(mockAuth);
    localStorage.clear();
  });

  it("syncs token usage to user-isolated path", async () => {
    await recordTokenUsage("testOp", 100, 200);

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "token_usage",
      "test-user-123",
      "usage",
      expect.any(String)
    );
    expect(setDoc).toHaveBeenCalled();
  });

  it("fetches only current user stats for non-admins", async () => {
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { admin: false } });
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "token_usage",
      "test-user-123",
      "usage"
    );
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("uses collectionGroup for admins to fetch global stats", async () => {
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { admin: true } });
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), "usage");
  });
});
