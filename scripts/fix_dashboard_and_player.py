"""
Fix two bugs:
1. Dashboard.jsx Tag Cloud — use tag_id + display_name + synonyms for matching
2. GuidedPlayer.jsx — render expectedResult section in challenge card
"""
import re

# ─── Fix 1: Dashboard.jsx Tag Cloud ───
dashboard_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\Dashboard\Dashboard.jsx"

with open(dashboard_path, "r", encoding="utf-8") as f:
    content = f.read()

OLD_TAGCLOUD = """  // Get top 100 tags for Tag Cloud — compute counts from course data
  const tagCloud = useMemo(() => {
    if (!tags || tags.length === 0) return [];

    // Build counts by scanning every course's tags
    const tagCounts = {};
    courses.forEach((course) => {
      const courseTags = [
        ...(course.canonical_tags || []),
        ...(course.extracted_tags || []),
        ...(course.gemini_system_tags || []),
      ];
      courseTags.forEach((t) => {
        const name =
          typeof t === "string"
            ? t.split(".").pop().toLowerCase()
            : (t.display_name || t.name || "").toLowerCase();
        if (name) tagCounts[name] = (tagCounts[name] || 0) + 1;
      });
    });

    // Enrich tags with computed counts, hide zero-count tags
    return tags
      .map((t) => ({
        ...t,
        count: tagCounts[(t.display_name || "").toLowerCase()] || 0,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);
  }, [tags, courses]);"""

NEW_TAGCLOUD = """  // Get top 100 tags for Tag Cloud — compute counts from course data
  const tagCloud = useMemo(() => {
    if (!tags || tags.length === 0) return [];

    // Build reverse lookup: tag_id, display_name, synonyms → tag index
    const tagIndexMap = {};
    tags.forEach((tag, idx) => {
      if (tag.tag_id) tagIndexMap[tag.tag_id.toLowerCase()] = idx;
      if (tag.display_name) tagIndexMap[tag.display_name.toLowerCase()] = idx;
      (tag.synonyms || []).forEach((s) => {
        tagIndexMap[s.toLowerCase()] = idx;
      });
    });

    // Count courses per tag (dedup per course)
    const counts = new Array(tags.length).fill(0);
    courses.forEach((course) => {
      const courseTags = [
        ...(course.canonical_tags || []),
        ...(course.extracted_tags || []),
        ...(course.gemini_system_tags || []),
      ];
      const seen = new Set();
      courseTags.forEach((t) => {
        const name = (typeof t === "string" ? t : t.display_name || t.name || "").toLowerCase();
        const idx = tagIndexMap[name];
        if (idx !== undefined && !seen.has(idx)) {
          counts[idx]++;
          seen.add(idx);
        }
      });
    });

    return tags
      .map((t, i) => ({ ...t, count: counts[i] }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);
  }, [tags, courses]);"""

if OLD_TAGCLOUD.replace("\n", "\r\n") in content:
    content = content.replace(OLD_TAGCLOUD.replace("\n", "\r\n"), NEW_TAGCLOUD.replace("\n", "\r\n"))
    print("✅ Dashboard.jsx: Tag Cloud fixed (CRLF)")
elif OLD_TAGCLOUD in content:
    content = content.replace(OLD_TAGCLOUD, NEW_TAGCLOUD)
    print("✅ Dashboard.jsx: Tag Cloud fixed (LF)")
else:
    print("⚠️  Dashboard.jsx: Could not find old Tag Cloud block")

with open(dashboard_path, "w", encoding="utf-8") as f:
    f.write(content)


# ─── Fix 2: GuidedPlayer.jsx — add expectedResult to challenge card ───
player_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\GuidedPlayer\GuidedPlayer.jsx"

with open(player_path, "r", encoding="utf-8") as f:
    content = f.read()

OLD_CHALLENGE_CARD = """          <div className="challenge-hint">
            <span className="hint-label">💡 Hint:</span> {challengeContent.hint}
          </div>
          <button className="challenge-done-btn" onClick={handleChallengeComplete}>"""

NEW_CHALLENGE_CARD = """          {challengeContent.expectedResult && (
            <div className="challenge-expected">
              <span className="expected-label">👁️ What to look for:</span> {challengeContent.expectedResult}
            </div>
          )}
          <div className="challenge-hint">
            <span className="hint-label">💡 Hint:</span> {challengeContent.hint}
          </div>
          <button className="challenge-done-btn" onClick={handleChallengeComplete}>"""

if OLD_CHALLENGE_CARD.replace("\n", "\r\n") in content:
    content = content.replace(OLD_CHALLENGE_CARD.replace("\n", "\r\n"), NEW_CHALLENGE_CARD.replace("\n", "\r\n"))
    print("✅ GuidedPlayer.jsx: expectedResult section added (CRLF)")
elif OLD_CHALLENGE_CARD in content:
    content = content.replace(OLD_CHALLENGE_CARD, NEW_CHALLENGE_CARD)
    print("✅ GuidedPlayer.jsx: expectedResult section added (LF)")
else:
    print("⚠️  GuidedPlayer.jsx: Could not find challenge card block")

with open(player_path, "w", encoding="utf-8") as f:
    f.write(content)


# ─── Fix 3: GuidedPlayer.css — style expected result block ───
css_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\GuidedPlayer\GuidedPlayer.css"

with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

EXPECTED_CSS = """
/* Expected Result block in challenge card */
.challenge-expected {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 12px 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: #d1d5db;
}
.expected-label {
  font-weight: 600;
  color: #22c55e;
  margin-right: 6px;
}
"""

if ".challenge-expected" not in css:
    css += EXPECTED_CSS
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css)
    print("✅ GuidedPlayer.css: expected result styles added")
else:
    print("⚠️  GuidedPlayer.css: expected result styles already exist")

print("\nDone! All fixes applied.")
