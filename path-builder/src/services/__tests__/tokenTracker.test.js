import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDocs, collection, collectionGroup, query } from "firebase/firestore";
import { isAdmin } from "../accessControl";

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("../accessControl", () => ({
  isAdmin: vi.fn(),
}));

describe("tokenTracker secure isolation", () => {
  const mockUser = { uid: "user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    getAuth.mockReturnValue({ currentUser: mockUser });
    isAdmin.mockResolvedValue(false);
  });

  it("syncs token usage to a user-isolated path", async () => {
    const today = new Date().toISOString().slice(0, 10);
    recordTokenUsage("test-op", 100, 200);

    // Give the async sync a moment (it's fire-and-forget in the impl)
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(doc).toHaveBeenCalledWith(
      undefined,
      "token_usage",
      mockUser.uid,
      "usage",
      today
    );
  });

  it("fetches only user-specific stats for regular users", async () => {
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      undefined,
      "token_usage",
      mockUser.uid,
      "usage"
    );
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("uses collectionGroup and aggregates for administrators", async () => {
    isAdmin.mockResolvedValue(true);
    getDocs.mockResolvedValue({
      docs: [
        { date: "2026-01-01", calls: 1, totalInput: 10, totalOutput: 10, estimatedCost: 0.1 },
        { date: "2026-01-01", calls: 2, totalInput: 20, totalOutput: 20, estimatedCost: 0.2 },
      ].map(d => ({ id: "id", data: () => d, ...d }))
    });

    const stats = await fetchCloudStats(7);

    expect(collectionGroup).toHaveBeenCalledWith(undefined, "usage");
    expect(stats).toHaveLength(1);
    expect(stats[0].calls).toBe(3);
    expect(stats[0].totalInput).toBe(30);
  });
});
