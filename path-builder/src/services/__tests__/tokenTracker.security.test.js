import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTokenUsage, fetchCloudStats } from "../tokenTracker";
import { doc, collection } from "firebase/firestore";

// Mock firebaseConfig and e2eBypass
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
  firebaseConfig: { apiKey: "test-key" }
}));
vi.mock("../e2eBypass", () => ({ IS_E2E: false }));

// Mock Firestore
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
  collection: vi.fn((db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  setDoc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock Auth
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: "test-uid-123" }
  })),
}));

describe("tokenTracker Security - User Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncDayToFirestore should use a user-scoped path", async () => {
    recordTokenUsage("test-op", 10, 20);

    await vi.waitFor(() => {
      expect(doc).toHaveBeenCalled();
    });

    // Find the call that involves 'token_usage'
    const docCall = vi.mocked(doc).mock.calls.find(call =>
      Array.from(call).some(arg => typeof arg === 'string' && arg.includes("token_usage"))
    );

    expect(docCall).toBeDefined();
    const pathSegments = Array.from(docCall).slice(1);
    expect(pathSegments).toContain("users");
    expect(pathSegments).toContain("test-uid-123");
    expect(pathSegments).toContain("token_usage");
  });

  it("fetchCloudStats should use a user-scoped path", async () => {
    await fetchCloudStats(7);

    const collectionCall = vi.mocked(collection).mock.calls.find(call =>
      Array.from(call).some(arg => typeof arg === 'string' && arg.includes("token_usage"))
    );

    expect(collectionCall).toBeDefined();
    const pathSegments = Array.from(collectionCall).slice(1);
    expect(pathSegments).toContain("users");
    expect(pathSegments).toContain("test-uid-123");
    expect(pathSegments).toContain("token_usage");
  });
});
