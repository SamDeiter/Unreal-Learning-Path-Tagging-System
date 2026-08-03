import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDoc, mockCollection, mockSetDoc, mockGetDocs, mockQuery } = vi.hoisted(() => {
  return {
    mockDoc: vi.fn((...segments) => ({ type: "doc", segments })),
    mockCollection: vi.fn((...segments) => ({ type: "collection", segments })),
    mockSetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockQuery: vi.fn(),
  };
});

// Mock firebaseConfig so the module-level getFirebaseApp() doesn't throw
vi.mock("../firebaseConfig", () => ({ getFirebaseApp: vi.fn(() => ({})) }));

// We'll use local variables to mock state dynamically across tests
let mockCurrentUser = null;
const mockSnapshot = { docs: [] };

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: mockDoc,
  setDoc: mockSetDoc,
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock Firebase Auth dynamically
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return mockCurrentUser;
    },
  })),
}));

import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";

describe("TokenTracker security and scoping tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    mockSnapshot.docs = [];
    localStorage.clear();
  });

  it("skips cloud syncing when no user is authenticated", async () => {
    mockCurrentUser = null;

    // Attempting to record token usage should run but skip Firestore write
    recordTokenUsage("embedQuery", 100, 50);

    // Wait a brief tick for the fire-and-forget sync function to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("syncs daily token usage securely to /users/{uid}/token_usage/{date} when authenticated", async () => {
    mockCurrentUser = { uid: "test_user_123" };
    mockSetDoc.mockResolvedValue();

    recordTokenUsage("embedQuery", 1000, 400);

    // Wait for the fire-and-forget sync function to finish execution
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockDoc).toHaveBeenCalled();
    // Validate path construction has correct segments: doc(db, "users", uid, "token_usage", dateKey)
    const mockDocCall = mockDoc.mock.calls[0];
    expect(mockDocCall).toBeDefined();
    // The second element should be "users", third is uid, fourth is "token_usage", fifth is dateKey
    expect(mockDocCall[1]).toBe("users");
    expect(mockDocCall[2]).toBe("test_user_123");
    expect(mockDocCall[3]).toBe("token_usage");

    expect(mockSetDoc).toHaveBeenCalled();
    const setDocPayload = mockSetDoc.mock.calls[0][1];
    expect(setDocPayload.totalInput).toBe(1000);
    expect(setDocPayload.totalOutput).toBe(400);
  });

  it("returns empty array and skips fetchCloudStats query when not authenticated", async () => {
    mockCurrentUser = null;

    const stats = await fetchCloudStats(30);
    expect(stats).toEqual([]);
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("queries cloud stats user-scoped collection /users/{uid}/token_usage when authenticated", async () => {
    mockCurrentUser = { uid: "test_user_456" };
    mockSnapshot.docs = [
      { id: "2026-03-03", data: () => ({ totalInput: 100, totalOutput: 20 }) }
    ];
    mockGetDocs.mockResolvedValue(mockSnapshot);

    const stats = await fetchCloudStats(30);

    expect(mockCollection).toHaveBeenCalled();
    const collectionCall = mockCollection.mock.calls[0];
    expect(collectionCall).toBeDefined();
    expect(collectionCall[1]).toBe("users");
    expect(collectionCall[2]).toBe("test_user_456");
    expect(collectionCall[3]).toBe("token_usage");

    expect(mockGetDocs).toHaveBeenCalled();
    expect(stats).toHaveLength(1);
    expect(stats[0].id).toBe("2026-03-03");
  });
});
