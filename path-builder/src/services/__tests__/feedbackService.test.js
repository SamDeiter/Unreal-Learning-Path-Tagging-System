import { describe, it, expect, beforeEach, vi } from "vitest";
import feedbackService from "../../services/feedbackService";

// ─── Mock localStorage ───────────────────────────────────────

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
    get _store() {
      return store;
    },
  };
})();

// Mock Firebase modules so imports don't fail
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: "mock-doc-id" })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(() => Promise.resolve("https://mock-url")),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});

// ─── recordUpvote / recordDownvote ───────────────────────────

describe("feedbackService — upvote/downvote", () => {
  it("records an upvote and retrieves status", () => {
    feedbackService.recordUpvote("drive-001", "blueprint animation");
    const status = feedbackService.getFeedbackStatus("drive-001");
    expect(status).toBe("up");
  });

  it("records a downvote and retrieves status", () => {
    feedbackService.recordDownvote("drive-002", "lighting setup");
    const status = feedbackService.getFeedbackStatus("drive-002");
    expect(status).toBe("down");
  });

  it("overrides previous feedback with new vote", () => {
    feedbackService.recordUpvote("drive-003", "test");
    expect(feedbackService.getFeedbackStatus("drive-003")).toBe("up");

    feedbackService.recordDownvote("drive-003", "test");
    expect(feedbackService.getFeedbackStatus("drive-003")).toBe("down");
  });

  it("returns null for videos with no feedback", () => {
    const status = feedbackService.getFeedbackStatus("never-rated");
    expect(status).toBeNull();
  });
});

// ─── applyFeedbackMultiplier ─────────────────────────────────

describe("feedbackService — applyFeedbackMultiplier", () => {
  it("boosts upvoted video scores by ~1.3x", () => {
    feedbackService.recordUpvote("boost-vid", "test");
    const adjusted = feedbackService.applyFeedbackMultiplier("boost-vid", 100);
    expect(adjusted).toBe(130);
  });

  it("demotes downvoted video scores by ~0.3x", () => {
    feedbackService.recordDownvote("demote-vid", "test");
    const adjusted = feedbackService.applyFeedbackMultiplier("demote-vid", 100);
    expect(adjusted).toBe(30);
  });

  it("returns original score for unrated videos", () => {
    const adjusted = feedbackService.applyFeedbackMultiplier("unrated-vid", 100);
    expect(adjusted).toBe(100);
  });
});

// ─── getFeedbackStats ────────────────────────────────────────

describe("feedbackService — getFeedbackStats", () => {
  it("returns zero counts initially", () => {
    const stats = feedbackService.getFeedbackStats();
    expect(stats.total).toBe(0);
    expect(stats.upvoted).toBe(0);
    expect(stats.downvoted).toBe(0);
  });

  it("counts upvotes and downvotes correctly", () => {
    feedbackService.recordUpvote("vid-a", "q1");
    feedbackService.recordUpvote("vid-b", "q2");
    feedbackService.recordDownvote("vid-c", "q3");

    const stats = feedbackService.getFeedbackStats();
    expect(stats.total).toBe(3);
    expect(stats.upvoted).toBe(2);
    expect(stats.downvoted).toBe(1);
  });
});

// ─── recordFormFeedback ──────────────────────────────────────

describe("feedbackService — recordFormFeedback", () => {
  it("returns an object with id and timestamp", () => {
    const result = feedbackService.recordFormFeedback("bug", "Something broke");
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("stores form feedback in localStorage", () => {
    feedbackService.recordFormFeedback("feature", "Add dark mode");
    // localStorage.setItem should have been called
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("generates unique IDs for consecutive submissions", () => {
    const r1 = feedbackService.recordFormFeedback("bug", "Issue 1");
    const r2 = feedbackService.recordFormFeedback("bug", "Issue 2");
    expect(r1.id).not.toBe(r2.id);
  });
});
