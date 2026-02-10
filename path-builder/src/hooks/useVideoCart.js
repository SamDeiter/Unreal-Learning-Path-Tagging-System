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

/** Get a universal unique key for any cart item */
function getItemId(item) {
  return item.itemId || item.driveId || item.id || `${item.type}_${item.url}`;
}

/**
 * Custom hook for managing a multi-source learning path cart.
 * Supports three item types:
 *   - video: { type: "video", driveId, title, duration, courseCode, courseName }
 *   - doc:   { type: "doc",   itemId, title, url, tier, subsystem, readTimeMinutes }
 *   - youtube: { type: "youtube", itemId, title, url, channel, tier, durationMinutes }
 */
export function useVideoCart() {
  const [cart, setCart] = useState(loadCart);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const id = getItemId(item);
      if (prev.some((v) => getItemId(v) === id)) return prev;
      const enriched = { ...item, itemId: id, type: item.type || "video" };
      const next = [...prev, enriched];
      saveCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((idOrDriveId) => {
    setCart((prev) => {
      const next = prev.filter((v) => getItemId(v) !== idOrDriveId && v.driveId !== idOrDriveId);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    saveCart([]);
  }, []);

  const isInCart = useCallback(
    (idOrDriveId) => cart.some((v) => getItemId(v) === idOrDriveId || v.driveId === idOrDriveId),
    [cart]
  );

  const videoCount = cart.filter((i) => (i.type || "video") === "video").length;

  const totalDuration = useMemo(
    () => cart.reduce((sum, v) => sum + (v.duration || (v.readTimeMinutes || v.durationMinutes || 0) * 60), 0),
    [cart]
  );

  /** Group items by type for display */
  const itemsByType = useMemo(() => {
    const groups = { video: [], doc: [], youtube: [] };
    for (const item of cart) {
      const t = item.type || "video";
      (groups[t] || groups.video).push(item);
    }
    return groups;
  }, [cart]);

  return {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    videoCount,
    totalDuration,
    itemsByType,
  };
}
