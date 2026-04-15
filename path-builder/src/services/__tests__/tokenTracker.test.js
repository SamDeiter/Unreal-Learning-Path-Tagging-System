import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  collection: (...args) => mockCollection(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: vi.fn((q) => q),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

const mockUid = "test-user-123";
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: mockUid },
  })),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";

describe("tokenTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("syncDayToFirestore uses user-isolated path", async () => {
    // recordTokenUsage calls syncDayToFirestore internally (async, fire-and-forget)
    // We might need to wait a bit or use a more direct way if we can
    recordTokenUsage("testOp", 100, 50);

    // syncDayToFirestore is async and not awaited in recordTokenUsage
    // Give it a moment
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockDoc).toHaveBeenCalled();
    const args = mockDoc.mock.calls[0];
    // doc(db, "token_usage", userId, "usage", dateKey)
    expect(args[1]).toBe("token_usage");
    expect(args[2]).toBe(mockUid);
    expect(args[3]).toBe("usage");
  });

  it("fetchCloudStats uses user-isolated path", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchCloudStats(7);

    expect(mockCollection).toHaveBeenCalled();
    const args = mockCollection.mock.calls[0];
    // collection(db, "token_usage", userId, "usage")
    expect(args[1]).toBe("token_usage");
    expect(args[2]).toBe(mockUid);
    expect(args[3]).toBe("usage");
  });
});
