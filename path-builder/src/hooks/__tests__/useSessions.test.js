/**
 * useSessions — Unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Auth change handler — we control it via setAuth
let capturedAuthHandler = null;
vi.mock("../../services/googleAuthService", () => ({
  onAuthChange: vi.fn((cb) => {
    capturedAuthHandler = cb;
    return () => {};
  }),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" })),
}));

vi.mock("../../utils/logger", () => ({
  devWarn: vi.fn(),
  devLog: vi.fn(),
}));

// onSnapshot mock — capture callback + error handler
const mockOnSnapshot = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOrderBy = vi.fn((field, dir) => ({ __orderBy: [field, dir] }));
const mockLimit = vi.fn((n) => ({ __limit: n }));
const mockCollection = vi.fn(() => ({ __collection: true }));
const mockFsQuery = vi.fn((...args) => ({ __query: args }));
const mockGetDocs = vi.fn();
const mockGetFirestore = vi.fn(() => ({ __firestore: true }));

vi.mock("firebase/firestore", () => ({
  getFirestore: (...a) => mockGetFirestore(...a),
  collection: (...a) => mockCollection(...a),
  query: (...a) => mockFsQuery(...a),
  orderBy: (...a) => mockOrderBy(...a),
  limit: (...a) => mockLimit(...a),
  onSnapshot: (...a) => mockOnSnapshot(...a),
  getDocs: (...a) => mockGetDocs(...a),
}));

import useSessions from "../useSessions";

function fakeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function fakeTs(ms) {
  return { toMillis: () => ms };
}

describe("useSessions", () => {
  beforeEach(() => {
    capturedAuthHandler = null;
    mockOnSnapshot.mockReset();
    mockUnsubscribe.mockReset();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
    mockFsQuery.mockClear();
    mockCollection.mockClear();
    mockGetDocs.mockReset();
    // Default: returns unsubscribe fn
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);
  });

  it("returns empty array when unauthenticated", async () => {
    const { result } = renderHook(() => useSessions());
    // Simulate auth resolves as null user
    act(() => {
      capturedAuthHandler?.(null);
    });
    await waitFor(() => {
      expect(result.current.sessions).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  it("subscribes to Firestore on auth and orders by updatedAt desc, limit 20", async () => {
    renderHook(() => useSessions());
    act(() => {
      capturedAuthHandler?.({ uid: "user-1" });
    });
    await waitFor(() => {
      expect(mockOnSnapshot).toHaveBeenCalled();
    });
    expect(mockOrderBy).toHaveBeenCalledWith("updatedAt", "desc");
    expect(mockLimit).toHaveBeenCalledWith(20);
    // collection("users", "user-1", "sessions")
    expect(mockCollection.mock.calls[0]).toEqual([
      expect.anything(),
      "users",
      "user-1",
      "sessions",
    ]);
  });

  it("normalizes Timestamp to millis from snapshots", async () => {
    const { result } = renderHook(() => useSessions());
    act(() => {
      capturedAuthHandler?.({ uid: "user-1" });
    });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    // Fire the snapshot handler
    const [, onNext] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onNext({
        docs: [
          fakeDoc("s1", {
            uid: "user-1",
            mode: "problem-first",
            query: "lumen",
            createdAt: fakeTs(1000),
            updatedAt: fakeTs(2000),
            conversationHistory: [],
          }),
        ],
      });
    });
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.sessions[0].createdAt).toBe(1000);
    expect(result.current.sessions[0].updatedAt).toBe(2000);
    expect(result.current.sessions[0].mode).toBe("problem-first");
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useSessions());
    act(() => {
      capturedAuthHandler?.({ uid: "user-1" });
    });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("captures snapshot errors into error state", async () => {
    const { result } = renderHook(() => useSessions());
    act(() => {
      capturedAuthHandler?.({ uid: "user-1" });
    });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    const [, , onError] = mockOnSnapshot.mock.calls[0];
    act(() => {
      onError(new Error("permission-denied"));
    });
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });
});
