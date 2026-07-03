import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { getAuth } from "firebase/auth";
import { doc, collection, setDoc } from "firebase/firestore";

// Mock Firebase modules
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn().mockReturnValue({ type: "firestore-db" }),
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

describe("tokenTracker isolation", () => {
  const mockUid = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup Auth mock
    getAuth.mockReturnValue({
      currentUser: { uid: mockUid },
    });
  });

  it("syncDayToFirestore uses the correct user-isolated path", async () => {
    // recordTokenUsage calls syncDayToFirestore internally
    recordTokenUsage("testOp", 100, 200);

    // We need to wait for the fire-and-forget promise to potentially execute
    // Although syncDayToFirestore is internal, we can verify the 'doc' call

    // Give it a tiny bit of time for the async call
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(doc).toHaveBeenCalledWith(
      expect.anything(), // db
      "users",
      mockUid,
      "token_usage",
      expect.any(String) // dateKey
    );
  });

  it("fetchCloudStats uses the correct user-isolated path", async () => {
    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(), // db
      "users",
      mockUid,
      "token_usage"
    );
  });

  it("skips Firestore sync if user is not authenticated", async () => {
    getAuth.mockReturnValue({ currentUser: null });

    recordTokenUsage("testOp", 100, 200);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(setDoc).not.toHaveBeenCalled();
  });
});
