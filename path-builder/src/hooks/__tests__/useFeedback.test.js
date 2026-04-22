/**
 * useFeedback — Unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockCallable = vi.fn();
const mockHttpsCallable = vi.fn(() => mockCallable);
const mockGetFunctions = vi.fn(() => ({ __functions: true }));

vi.mock("firebase/functions", () => ({
  getFunctions: (...a) => mockGetFunctions(...a),
  httpsCallable: (...a) => mockHttpsCallable(...a),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" })),
}));

vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import useFeedback from "../useFeedback";

describe("useFeedback", () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
    mockGetFunctions.mockClear();
  });

  it("calls submitFeedback callable with correct payload and sets lastSignal", async () => {
    mockCallable.mockResolvedValue({ data: { success: true, feedbackId: "fb_123" } });
    const { result } = renderHook(() => useFeedback());

    let res;
    await act(async () => {
      res = await result.current.submit({
        sessionId: "sess_1",
        signal: "helpful",
        tagsTouched: ["tag_lumen", "tag_lighting"],
      });
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "submitFeedback");
    expect(mockCallable).toHaveBeenCalledWith({
      sessionId: "sess_1",
      signal: "helpful",
      tagsTouched: ["tag_lumen", "tag_lighting"],
    });
    expect(res.ok).toBe(true);
    expect(res.feedbackId).toBe("fb_123");
    await waitFor(() => {
      expect(result.current.lastSignal.sess_1).toBe("helpful");
    });
  });

  it("omits tagsTouched when empty and includes comment when given", async () => {
    mockCallable.mockResolvedValue({ data: { success: true, feedbackId: "fb_2" } });
    const { result } = renderHook(() => useFeedback());

    await act(async () => {
      await result.current.submit({
        sessionId: "sess_2",
        signal: "confused",
        tagsTouched: [],
        comment: "explain more",
      });
    });

    expect(mockCallable).toHaveBeenCalledWith({
      sessionId: "sess_2",
      signal: "confused",
      comment: "explain more",
    });
  });

  it("swallows errors to state, returns ok:false", async () => {
    mockCallable.mockRejectedValue(new Error("unauthenticated"));
    const { result } = renderHook(() => useFeedback());

    let res;
    await act(async () => {
      res = await result.current.submit({ sessionId: "sess_3", signal: "helpful" });
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unauthenticated/i);
    await waitFor(() => {
      expect(result.current.error).toMatch(/unauthenticated/i);
    });
    expect(result.current.lastSignal.sess_3).toBeUndefined();
  });

  it("rejects missing sessionId without calling callable", async () => {
    const { result } = renderHook(() => useFeedback());

    let res;
    await act(async () => {
      res = await result.current.submit({ sessionId: null, signal: "helpful" });
    });

    expect(res.ok).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });
});
