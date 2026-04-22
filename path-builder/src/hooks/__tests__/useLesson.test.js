/**
 * useLesson — smoke tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockCallable = vi.fn();
const mockHttpsCallable = vi.fn(() => mockCallable);
const mockGetFunctions = vi.fn(() => ({ __functions: true }));

const mockGetDoc = vi.fn();
const mockDoc = vi.fn((...args) => ({ __doc: args }));
const mockGetFirestore = vi.fn(() => ({ __db: true }));

vi.mock("firebase/functions", () => ({
  getFunctions: (...a) => mockGetFunctions(...a),
  httpsCallable: (...a) => mockHttpsCallable(...a),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: (...a) => mockGetFirestore(...a),
  doc: (...a) => mockDoc(...a),
  getDoc: (...a) => mockGetDoc(...a),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" })),
}));

vi.mock("../../services/googleAuthService", () => ({
  getCurrentUser: vi.fn(() => ({ uid: "user_1" })),
}));

vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import useLesson from "../useLesson";

describe("useLesson", () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
    mockGetFunctions.mockClear();
    mockGetDoc.mockReset();
    mockDoc.mockClear();
  });

  it("generate() calls the generateLesson callable and stores lesson", async () => {
    mockCallable.mockResolvedValue({
      data: {
        success: true,
        lessonId: "lesson_123",
        sessionId: "sess_1",
        lesson: { topic: "Lumen" },
      },
    });

    const { result } = renderHook(() => useLesson());

    let res;
    await act(async () => {
      res = await result.current.generate({ query: "lumen flicker", sessionId: "sess_1" });
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "generateLesson");
    expect(mockCallable).toHaveBeenCalledWith({ query: "lumen flicker", sessionId: "sess_1" });
    expect(res.ok).toBe(true);
    expect(res.lessonId).toBe("lesson_123");
    expect(result.current.lesson.topic).toBe("Lumen");
  });

  it("generate() rejects empty query without calling callable", async () => {
    const { result } = renderHook(() => useLesson());
    let res;
    await act(async () => {
      res = await result.current.generate({ query: "" });
    });
    expect(res.ok).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it("loadById() reads the lesson doc from Firestore", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ topic: "Reflections" }),
    });

    const { result } = renderHook(() => useLesson());

    let res;
    await act(async () => {
      res = await result.current.loadById("lesson_abc");
    });

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "users", "user_1", "lessons", "lesson_abc");
    expect(res.ok).toBe(true);
    expect(result.current.lesson.topic).toBe("Reflections");
  });

  it("loadById() returns error when doc does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
    const { result } = renderHook(() => useLesson());
    let res;
    await act(async () => {
      res = await result.current.loadById("missing");
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });
});
