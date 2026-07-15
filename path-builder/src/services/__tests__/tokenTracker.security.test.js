import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncDayToFirestore } from "../tokenTracker";
import { doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" })),
}));

describe("tokenTracker security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncDayToFirestore should use user-scoped path users/{uid}/token_usage/{dateKey}", async () => {
    const mockUid = "user-123";
    const mockDateKey = "2026-03-03";
    const mockDayData = {
      totalInput: 100,
      totalOutput: 200,
      calls: 5,
      operations: {},
    };

    // Mock auth state
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: mockUid },
    });

    await syncDayToFirestore(mockDateKey, mockDayData);

    // Verify path construction
    expect(doc).toHaveBeenCalledWith(
      expect.anything(), // db
      "users",
      mockUid,
      "token_usage",
      mockDateKey
    );
  });

  it("syncDayToFirestore should bail if no user is authenticated", async () => {
    vi.mocked(getAuth).mockReturnValue({
      currentUser: null,
    });

    await syncDayToFirestore("2026-03-03", {});

    expect(doc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
