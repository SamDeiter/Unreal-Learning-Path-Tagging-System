/**
 * useVideoCart Hook Tests — Multi-source cart (video / doc / youtube)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoCart } from "../hooks/useVideoCart";

// Mock localStorage
const storageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = String(val); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: storageMock });

describe("useVideoCart", () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  // --- Fixtures ---
  const videoItem = {
    type: "video",
    driveId: "abc123",
    title: "Lumen Setup",
    duration: 660,
    courseCode: "100_01",
  };

  const docItem = {
    type: "doc",
    itemId: "doc_nanite",
    title: "Nanite Virtualized Geometry",
    url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite",
    tier: "intermediate",
    subsystem: "rendering",
    readTimeMinutes: 12,
  };

  const youtubeItem = {
    type: "youtube",
    itemId: "yt_lumen_deep",
    title: "Lumen Deep Dive",
    url: "https://youtube.com/watch?v=xyz",
    channel: "Unreal Engine",
    durationMinutes: 45,
  };

  // --- Tests ---

  it("starts with an empty cart", () => {
    const { result } = renderHook(() => useVideoCart());
    expect(result.current.cart).toEqual([]);
    expect(result.current.videoCount).toBe(0);
    expect(result.current.totalDuration).toBe(0);
  });

  it("adds a video item", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].type).toBe("video");
    expect(result.current.videoCount).toBe(1);
  });

  it("adds a doc item", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(docItem));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].type).toBe("doc");
  });

  it("adds a youtube item", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(youtubeItem));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].type).toBe("youtube");
  });

  it("deduplicates by itemId", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(docItem));
    act(() => result.current.addToCart(docItem));
    expect(result.current.cart).toHaveLength(1);
  });

  it("deduplicates videos by driveId", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    act(() => result.current.addToCart({ ...videoItem, title: "Same Video Different Title" }));
    expect(result.current.cart).toHaveLength(1);
  });

  it("removes an item by id", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(docItem));
    act(() => result.current.addToCart(videoItem));
    expect(result.current.cart).toHaveLength(2);

    act(() => result.current.removeFromCart("doc_nanite"));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].type).toBe("video");
  });

  it("clears the entire cart", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    act(() => result.current.addToCart(docItem));
    act(() => result.current.addToCart(youtubeItem));
    expect(result.current.cart).toHaveLength(3);

    act(() => result.current.clearCart());
    expect(result.current.cart).toHaveLength(0);
    expect(result.current.videoCount).toBe(0);
  });

  it("isInCart returns correct boolean", () => {
    const { result } = renderHook(() => useVideoCart());
    expect(result.current.isInCart("doc_nanite")).toBe(false);
    act(() => result.current.addToCart(docItem));
    expect(result.current.isInCart("doc_nanite")).toBe(true);
  });

  it("calculates totalDuration from mixed types", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));     // 660 seconds
    act(() => result.current.addToCart(docItem));        // 12 min = 720 seconds
    act(() => result.current.addToCart(youtubeItem));    // 45 min = 2700 seconds
    expect(result.current.totalDuration).toBe(660 + 720 + 2700);
  });

  it("groups items by type in itemsByType", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    act(() => result.current.addToCart(docItem));
    act(() => result.current.addToCart(youtubeItem));

    const groups = result.current.itemsByType;
    expect(groups.video).toHaveLength(1);
    expect(groups.doc).toHaveLength(1);
    expect(groups.youtube).toHaveLength(1);
  });

  it("persists cart to localStorage on add", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    expect(storageMock.setItem).toHaveBeenCalled();
    const saved = JSON.parse(storageMock.setItem.mock.calls.at(-1)[1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe("Lumen Setup");
  });

  it("persists cart to localStorage on clear", () => {
    const { result } = renderHook(() => useVideoCart());
    act(() => result.current.addToCart(videoItem));
    act(() => result.current.clearCart());
    const saved = JSON.parse(storageMock.setItem.mock.calls.at(-1)[1]);
    expect(saved).toHaveLength(0);
  });

  it("loads cart from localStorage on init", () => {
    const stored = [{ ...videoItem, itemId: "abc123" }];
    storageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));
    const { result } = renderHook(() => useVideoCart());
    expect(result.current.cart).toHaveLength(1);
  });

  it("handles corrupted localStorage gracefully", () => {
    storageMock.getItem.mockReturnValueOnce("not valid json{{{");
    const { result } = renderHook(() => useVideoCart());
    expect(result.current.cart).toEqual([]);
  });
});
