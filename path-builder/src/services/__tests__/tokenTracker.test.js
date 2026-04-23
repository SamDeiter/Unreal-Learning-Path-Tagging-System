import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebaseConfig
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

// Mock firebase/auth
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: "user-123" },
  })),
}));

// Mock accessControl
vi.mock("../accessControl", () => ({
  isAdmin: vi.fn(() => Promise.resolve(false)),
}));

// Create mutable mock functions that can be updated in tests
const mocks = {
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  collectionGroup: vi.fn(),
  where: vi.fn(),
};

// Mock firebase/firestore with factory that doesn't use outside variables directly
vi.mock("firebase/firestore", () => {
  return {
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((...args) => mocks.doc(...args)),
    setDoc: vi.fn((...args) => mocks.setDoc(...args)),
    collection: vi.fn((...args) => mocks.collection(...args)),
    getDocs: vi.fn((...args) => mocks.getDocs(...args)),
    query: vi.fn((...args) => mocks.query(...args)),
    orderBy: vi.fn((...args) => mocks.orderBy(...args)),
    limit: vi.fn((...args) => mocks.limit(...args)),
    collectionGroup: vi.fn((...args) => mocks.collectionGroup(...args)),
    where: vi.fn((...args) => mocks.where(...args)),
  };
});

import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { isAdmin } from "../accessControl";

describe("tokenTracker user isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset our manual mocks too
    Object.values(mocks).forEach(m => m.mockReset());
    mocks.setDoc.mockResolvedValue(Promise.resolve());
  });

  it("syncDayToFirestore should use user-isolated path", async () => {
    mocks.doc.mockReturnValue("doc-ref");

    recordTokenUsage("test-op", 100, 200);

    // Wait for the async sync to trigger
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "token_usage",
      "user-123",
      "usage",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("fetchCloudStats should use user-isolated path for non-admins", async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);
    mocks.collection.mockReturnValue("col-ref");
    mocks.getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(mocks.collection).toHaveBeenCalledWith(
      expect.anything(),
      "token_usage",
      "user-123",
      "usage"
    );
  });

  it("fetchCloudStats should use collectionGroup for admins", async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);
    mocks.collectionGroup.mockReturnValue("cg-ref");
    mocks.getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(mocks.collectionGroup).toHaveBeenCalledWith(expect.anything(), "usage");
    expect(mocks.where).toHaveBeenCalledWith("date", ">=", expect.any(String));
  });

  it("fetchCloudStats should aggregate results for admins", async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);
    mocks.collectionGroup.mockReturnValue("cg-ref");

    const mockDocs = [
      { data: () => ({ date: "2026-03-01", totalInput: 100, totalOutput: 50, calls: 1, estimatedCost: 0.01 }) },
      { data: () => ({ date: "2026-03-01", totalInput: 200, totalOutput: 100, calls: 1, estimatedCost: 0.02 }) },
      { data: () => ({ date: "2026-03-02", totalInput: 50, totalOutput: 25, calls: 1, estimatedCost: 0.005 }) },
    ];
    mocks.getDocs.mockResolvedValue({ docs: mockDocs });

    const stats = await fetchCloudStats(7);

    expect(stats).toHaveLength(2);
    expect(stats.find(s => s.date === "2026-03-01")).toMatchObject({
      totalInput: 300,
      totalOutput: 150,
      calls: 2,
    });
  });
});
