import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebaseConfig
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

// Mock firebase/firestore
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock firebase/auth
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: "test-user-123" },
  })),
}));

import { estimateCost, getTokenStats, recordTokenUsage } from "../tokenTracker";

describe("tokenTracker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("estimateCost calculates correct cost", () => {
    // Input: $0.10 / 1M tokens
    // Output: $0.40 / 1M tokens
    // 1M input = $0.10
    expect(estimateCost(1_000_000, 0)).toBeCloseTo(0.10);
    // 1M output = $0.40
    expect(estimateCost(0, 1_000_000)).toBeCloseTo(0.40);
    // Combined
    expect(estimateCost(1_000_000, 1_000_000)).toBeCloseTo(0.50);
  });

  it("getTokenStats returns initial empty stats", () => {
    const stats = getTokenStats();
    expect(stats.today.inputTokens).toBe(0);
    expect(stats.lifetime.inputTokens).toBe(0);
    expect(stats.today.cost).toBe(0);
  });

  it("recordTokenUsage updates local stats", () => {
    recordTokenUsage("testOp", 1000, 500);
    const stats = getTokenStats();
    expect(stats.today.inputTokens).toBe(1000);
    expect(stats.today.outputTokens).toBe(500);
    expect(stats.today.calls).toBe(1);
    expect(stats.today.operations.testOp.input).toBe(1000);
  });
});
