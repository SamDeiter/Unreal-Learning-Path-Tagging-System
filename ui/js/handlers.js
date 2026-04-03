/* UE5 Learning Path Builder - Event Handlers Module
 * Replaces inline onclick attributes with addEventListener calls.
 * Loaded after all other modules so all functions are available.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Input method buttons
  const inputMethodBtns = document.querySelectorAll(".input-method-btn");
  const panelTypes = ["text", "log", "screenshot", "tags"];
  inputMethodBtns.forEach((btn, i) => {
    if (panelTypes[i]) {
      btn.addEventListener("click", () => showInputPanel(panelTypes[i]));
    }
  });

  // Add ingredient buttons
  const addTextBtn = document.querySelector("#textPanel .add-ingredient-btn");
  if (addTextBtn) addTextBtn.addEventListener("click", addTextIngredient);

  const addLogBtn = document.querySelector("#logPanel .add-ingredient-btn");
  if (addLogBtn) addLogBtn.addEventListener("click", addLogIngredient);

  // Screenshot dropzone click
  const dropzone = document.getElementById("screenshotDropzone");
  if (dropzone) {
    dropzone.addEventListener("click", (e) => {
      // Don't trigger file input if clicking the remove button
      if (e.target.closest(".remove-preview")) return;
      document.getElementById("screenshotInput").click();
    });
  }

  // Screenshot file input
  const screenshotInput = document.getElementById("screenshotInput");
  if (screenshotInput) {
    screenshotInput.addEventListener("change", handleScreenshotSelect);
  }

  // Remove preview button
  const removePreviewBtn = document.querySelector(".remove-preview");
  if (removePreviewBtn) {
    removePreviewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearScreenshotPreview();
    });
  }

  // Add screenshot button
  const addScreenshotBtn = document.getElementById("addScreenshotBtn");
  if (addScreenshotBtn) {
    addScreenshotBtn.addEventListener("click", addScreenshotIngredient);
  }

  // Generate button
  const generateBtn = document.getElementById("generateBtn");
  if (generateBtn) {
    generateBtn.addEventListener("click", generateFromBasket);
  }

  // Back to search button
  const backBtn = document.querySelector(".back-btn");
  if (backBtn) backBtn.addEventListener("click", goBackToSearch);

  // Share path buttons
  document.querySelectorAll(".sidebar-btn:not(.secondary)").forEach((btn) => {
    if (btn.textContent.includes("Share")) {
      btn.addEventListener("click", sharePath);
    }
  });

  // Sidebar new search button
  const newSearchBtn = document.querySelector(".sidebar-btn.secondary");
  if (newSearchBtn) newSearchBtn.addEventListener("click", goBackToSearch);

  // Mobile share button
  const mobileShareBtn = document.querySelector(".mobile-only .complete-btn");
  if (mobileShareBtn) mobileShareBtn.addEventListener("click", sharePath);

  // Video modal close
  const videoModal = document.getElementById("videoModal");
  if (videoModal) {
    videoModal.addEventListener("click", (e) => {
      if (e.target === videoModal) closeVideo();
    });
  }

  const videoCloseBtn = document.querySelector(".video-close");
  if (videoCloseBtn) videoCloseBtn.addEventListener("click", () => closeVideo());

  // Prevent click propagation on video container
  const videoContainer = document.querySelector(".video-container");
  if (videoContainer) {
    videoContainer.addEventListener("click", (e) => e.stopPropagation());
  }
});
