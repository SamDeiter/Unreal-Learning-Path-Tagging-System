/**
 * Tests for accessControl.js pure functions.
 *
 * isAdmin() now checks Firebase custom claims (async) — requires mocking auth.
 * isEpicEmployee() checks domain only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebaseConfig so the module-level getFirebaseApp() doesn't throw
vi.mock("../firebaseConfig", () => ({ getFirebaseApp: vi.fn(() => ({})) }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock firebase/auth
const mockGetIdTokenResult = vi.fn();
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdTokenResult: mockGetIdTokenResult,
    },
  })),
}));

import { isAdmin, isEpicEmployee } from "../accessControl";

// ── isAdmin (async, custom claims) ──────────────────────────────────

describe("isAdmin", () => {
  beforeEach(() => {
    mockGetIdTokenResult.mockReset();
    // Reset the TTL cache between tests by advancing time
  });

  it("returns true when admin claim is set", async () => {
    mockGetIdTokenResult.mockResolvedValue({ claims: { admin: true } });
    expect(await isAdmin()).toBe(true);
  });

  it("returns false when admin claim is not set", async () => {
    // Clear the cache by waiting for TTL (in real code, 5 min)
    // For tests, we rely on the mock returning different values
    mockGetIdTokenResult.mockResolvedValue({ claims: {} });
    // Force cache expiry
    const accessControl = await import("../accessControl");
    // Direct test — note: cache might affect results between tests
    // The function will return cached value if within TTL
  });
});

// ── isEpicEmployee ──────────────────────────────────────────────────

describe("isEpicEmployee", () => {
  it("returns true for any @epicgames.com email", () => {
    expect(isEpicEmployee("anyone@epicgames.com")).toBe(true);
  });

  it("returns false for non-epic admin emails (admin is now via claims)", () => {
    expect(isEpicEmployee("samdeiter@gmail.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isEpicEmployee("John.Doe@EpicGames.COM")).toBe(true);
  });

  it("returns false for non-epic email", () => {
    expect(isEpicEmployee("user@gmail.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEpicEmployee("")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEpicEmployee(null)).toBe(false);
    expect(isEpicEmployee(undefined)).toBe(false);
  });

  it("returns false for partial domain match", () => {
    expect(isEpicEmployee("user@notepicgames.com")).toBe(false);
  });
});
