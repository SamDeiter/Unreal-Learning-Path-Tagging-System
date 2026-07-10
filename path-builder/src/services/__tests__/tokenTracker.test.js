import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { getCurrentUser } from "../googleAuthService";

// ─── Mocks ──────────────────────────────────────────────────

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore-instance" })),
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// ─── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

// ─── Tests ──────────────────────────────────────────────────

describe("tokenTracker Firestore Sync", () => {
  const mockUser = { uid: "user-123" };
  const todayKey = new Date().toISOString().slice(0, 10);

  it("syncs to correct per-user path when authenticated", async () => {
    getCurrentUser.mockReturnValue(mockUser);

    // Trigger a sync
    recordTokenUsage("test-op", 100, 50);

    // Give it a tick since sync is fire-and-forget
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(doc).toHaveBeenCalledWith(
      expect.objectContaining({ type: "firestore-instance" }),
      "users",
      "user-123",
      "token_usage",
      todayKey
    );
    expect(setDoc).toHaveBeenCalled();
  });

  it("does not sync when unauthenticated", async () => {
    getCurrentUser.mockReturnValue(null);

    recordTokenUsage("test-op", 100, 50);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(setDoc).not.toHaveBeenCalled();
  });

  it("fetches from correct per-user path when authenticated", async () => {
    getCurrentUser.mockReturnValue(mockUser);

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "firestore-instance" }),
      "users",
      "user-123",
      "token_usage"
    );
    expect(getDocs).toHaveBeenCalled();
  });

  it("returns empty array when fetching while unauthenticated", async () => {
    getCurrentUser.mockReturnValue(null);

    const stats = await fetchCloudStats(7);

    expect(stats).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});
