import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { doc, setDoc, collection } from "firebase/firestore";
import { getCurrentUser } from "../googleAuthService";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})), // Return empty object instead of undefined
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

describe("tokenTracker — Firestore Isolation", () => {
  const mockUser = { uid: "test-user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockReturnValue(mockUser);
    // Mock localStorage
    const store = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
    });
  });

  it("syncDayToFirestore uses isolated user path", async () => {
    // recordTokenUsage calls syncDayToFirestore internally
    recordTokenUsage("test", 100, 50);

    // Give it a tick for the fire-and-forget sync to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("fetchCloudStats uses isolated user path", async () => {
    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      mockUser.uid,
      "token_usage"
    );
  });

  it("syncDayToFirestore skips if no user is logged in", async () => {
    getCurrentUser.mockReturnValue(null);

    recordTokenUsage("test", 100, 50);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setDoc).not.toHaveBeenCalled();
  });
});
