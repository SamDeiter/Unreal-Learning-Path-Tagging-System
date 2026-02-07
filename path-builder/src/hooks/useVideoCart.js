import { useState, useCallback, useMemo } from "react";

const STORAGE_KEY = "ue5_video_cart";

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("[VideoCart] Failed to save:", e);
  }
}

/**
 * Custom hook for managing a video shopping cart.
 * Each item: { driveId, title, duration, courseCode, courseName, matchedTags }
 */
export function useVideoCart() {
  const [cart, setCart] = useState(loadCart);

  const addToCart = useCallback((video) => {
    setCart((prev) => {
      if (prev.some((v) => v.driveId === video.driveId)) return prev;
      const next = [...prev, video];
      saveCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((driveId) => {
    setCart((prev) => {
      const next = prev.filter((v) => v.driveId !== driveId);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    saveCart([]);
  }, []);

  const isInCart = useCallback((driveId) => cart.some((v) => v.driveId === driveId), [cart]);

  const videoCount = cart.length;

  const totalDuration = useMemo(() => cart.reduce((sum, v) => sum + (v.duration || 0), 0), [cart]);

  return {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    videoCount,
    totalDuration,
  };
}
