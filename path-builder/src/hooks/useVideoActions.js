/**
 * useVideoActions — Shared hook for video cart toggle and watch-path logic.
 *
 * Used by useProblemFirst and useExploreFirst to avoid duplicating
 * the video toggle / watch-path pattern.
 */
import { useCallback } from "react";

/**
 * @param {Object} params
 * @param {Function} params.isInCart - Check if driveId is in cart
 * @param {Function} params.addToCart - Add a video to the cart
 * @param {Function} params.removeFromCart - Remove a video from the cart
 * @param {Array}    params.cart - Current cart contents
 * @param {Function} params.setStage - Stage setter
 * @param {string}   params.guidedStage - The stage constant for guided mode
 */
export function useVideoActions({
  isInCart,
  addToCart,
  removeFromCart,
  cart,
  setStage,
  guidedStage,
}) {
  const handleVideoToggle = useCallback(
    (video) => {
      if (isInCart(video.driveId)) removeFromCart(video.driveId);
      else addToCart(video);
    },
    [isInCart, addToCart, removeFromCart]
  );

  const handleWatchPath = useCallback(() => {
    if (cart.length > 0) setStage(guidedStage);
  }, [cart, setStage, guidedStage]);

  return { handleVideoToggle, handleWatchPath };
}
