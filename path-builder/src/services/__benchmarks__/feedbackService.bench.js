import { bench, describe, vi, beforeEach } from "vitest";
import feedbackService from "../feedbackService";

const STORAGE_KEY = "feedback_v1";

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

// Mock Firebase modules so imports don't fail
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

describe("feedbackService Performance", () => {
  const feedbackData = {};
  for (let i = 0; i < 100; i++) {
    feedbackData[`drive-${i}`] = { up: 1, down: 0, lastQuery: "test", lastUpdated: new Date().toISOString() };
  }

  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(feedbackData));
  });

  bench("applyFeedbackMultiplier (current)", () => {
    for (let i = 0; i < 100; i++) {
      feedbackService.applyFeedbackMultiplier(`drive-${i}`, 100);
    }
  });
});
