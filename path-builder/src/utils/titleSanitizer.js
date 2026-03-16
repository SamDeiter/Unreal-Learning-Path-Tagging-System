/**
 * Utility to sanitize weirdly formatted course or video titles.
 * E.g. "102.00 Introduction to the Unreal Editor.mp4" -> "Introduction To The Unreal Editor"
 */
export function sanitizeTitle(rawTitle) {
  if (!rawTitle) return "Untitled";

  let cleaned = rawTitle;

  // 1. Remove file extensions like .mp4, .mov, .pdf
  cleaned = cleaned.replace(/\.[a-zA-Z0-9]{2,4}$/, "");

  // 2. Remove numeric prefixes ending with a dot or dash and zero or more spaces
  // Examples: "1.", "1.1.", "102.00", "01 -", "1_02"
  cleaned = cleaned.replace(/^[\d]{1,3}(?:[._-][\d]{1,3})*[\s.-]*/, "");

  // 3. Remove random leading special characters like dashes, underscores
  cleaned = cleaned.replace(/^[-_]+\s*/, "");

  // 4. Remove UUIDs or hash-like strings often found in raw filenames
  // (e.g. "Intro_f8a9d2v.mp4" -> "Intro")
  cleaned = cleaned.replace(/_[a-fA-F0-9]{6,12}$/, "");

  // 5. Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, " ");

  // 6. Fix camel casing for file names like "IntroductionToUE5"
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");

  // 7. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // 8. Capitalization (Title Case)
  // Only capitalize if the whole string is lowercase or uppercase (to avoid ruining already good mixed-case)
  const isAllLower = cleaned === cleaned.toLowerCase();
  const isAllUpper = cleaned === cleaned.toUpperCase();
  
  if (isAllLower || isAllUpper) {
     cleaned = cleaned.split(' ').map(word => {
         if (word.length === 0) return "";
         return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
     }).join(' ');
  }

  // Fallback if we accidentally stripped everything
  if (cleaned.length === 0) {
      return rawTitle;
  }

  return cleaned;
}
