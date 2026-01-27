/* UE5 Learning Path Builder - Video Module */

// Extract video ID from YouTube URL
function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Play video in modal
function playVideo(url, description) {
  const videoId = getYouTubeId(url);
  if (!videoId) {
    window.open(url, "_blank");
    return;
  }

  // Priority 1: Extract timestamp from URL (?t= or &t=)
  let startTime = 0;
  const urlTimeMatch = url.match(/[?&]t=(\d+)/);
  if (urlTimeMatch) {
    startTime = parseInt(urlTimeMatch[1], 10);
  }
  // Priority 2: Try to extract timestamp from description
  else if (description) {
    // Check for explicit "beginning" or "0:00"
    if (/start\s*(?:at\s*)?(?:the\s*)?beginning/i.test(description)) {
      startTime = 0;
    }
    // Look for explicit "Start at X:XX" or "from X:XX"
    else {
      const startMatch = description.match(
        /(?:start|from)\s*(?:at\s*)?(\d{1,2}):(\d{2})/i,
      );
      if (startMatch) {
        startTime = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
      }
      // Fallback: look for any X:XX pattern
      else {
        const anyTimeMatch = description.match(/(\d{1,2}):(\d{2})/);
        if (anyTimeMatch) {
          startTime =
            parseInt(anyTimeMatch[1]) * 60 + parseInt(anyTimeMatch[2]);
        }
      }
    }
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${startTime}`;
  document.getElementById("videoFrame").src = embedUrl;
  document.getElementById("videoModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

// Helper to play video from content card (uses data attributes)
function playVideoFromCard(card) {
  const url = card.dataset.url;
  const desc = card.dataset.desc ? decodeURIComponent(card.dataset.desc) : "";
  playVideo(url, desc);
}

// Close video modal
function closeVideo(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("videoFrame").src = "";
  document.getElementById("videoModal").classList.remove("active");
  document.body.style.overflow = "";
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeVideo();
});
