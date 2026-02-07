
import json
import os

FILE_PATH = r"path-builder/src/data/transcript_segments.json"

def fix_typo():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    print(f"Reading {FILE_PATH}...")
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    count_summary = 0
    count_text = 0

    # Iterate through all courses -> videos -> segments
    for course_videos in data.values():
        for video_segments in course_videos.values():
            for seg in video_segments:
                # Fix Summary
                if "summary" in seg and "faking sand feedback" in seg["summary"]:
                    print(f"Fixing summary in segment starting at {seg['start']}")
                    seg["summary"] = seg["summary"].replace("faking sand feedback", "faking sun feedback")
                    count_summary += 1
                
                # Fix Text
                if "text" in seg and "faking that sand" in seg["text"]:
                    print(f"Fixing text in segment starting at {seg['start']}")
                    seg["text"] = seg["text"].replace("faking that sand", "faking that sun")
                    count_text += 1

    if count_summary > 0 or count_text > 0:
        print(f"Fixed {count_summary} summaries and {count_text} text segments.")
        with open(FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print("Saved changes.")
    else:
        print("No matches found.")

if __name__ == "__main__":
    fix_typo()
