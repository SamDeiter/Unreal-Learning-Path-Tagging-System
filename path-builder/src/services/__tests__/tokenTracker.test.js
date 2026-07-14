import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncDayToFirestore, fetchCloudStats } from "../tokenTracker";
import { getCurrentUser } from "../googleAuthService";
import { doc, collection, setDoc, getDocs } from "firebase/firestore";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock Google Auth
vi.mock("../googleAuthService", () => ({
  getCurrentUser: vi.fn(),
}));

// Mock Firebase Config
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

describe("tokenTracker Firestore Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sync data to user-scoped path when user is logged in", async () => {
    getCurrentUser.mockReturnValue({ uid: "user-123" });
    const dateKey = "2026-03-03";
    const dayData = { totalInput: 100, totalOutput: 50, calls: 2, operations: {} };

    await syncDayToFirestore(dateKey, dayData);

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-123",
      "token_usage",
      dateKey
    );
    expect(setDoc).toHaveBeenCalled();
  });

  it("should not sync data when no user is logged in", async () => {
    getCurrentUser.mockReturnValue(null);
    const dateKey = "2026-03-03";
    const dayData = { totalInput: 100, totalOutput: 50, calls: 2, operations: {} };

    await syncDayToFirestore(dateKey, dayData);

    expect(setDoc).not.toHaveBeenCalled();
  });

  it("should fetch cloud stats from user-scoped path", async () => {
    getCurrentUser.mockReturnValue({ uid: "user-456" });
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-456",
      "token_usage"
    );
  });

  it("should return empty array if no user is logged in during fetch", async () => {
    getCurrentUser.mockReturnValue(null);
    const stats = await fetchCloudStats(7);
    expect(stats).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});
