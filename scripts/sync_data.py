import os
import shutil
from pathlib import Path

# Configuration: Source of Truth
SSOT_DIR = Path("content")
FILES_TO_SYNC = [
    "video_library_enriched.json",
    "transcript_segments.json",
    "learning_objectives.json",
    "quiz_questions.json",
    "course_prerequisites.json",
    "tags.json",
    "edges.json",
    "search_index.json",
    "segment_embeddings.json",
    "docs_embeddings.json",
]

# Targets
TARGETS = [
    Path("path-builder/src/data"),
    Path("path-builder/public/data"),
]

def sync_data():
    print("=" * 60)
    print("🔄 Data Synchronization (SSoT -> Frontend)")
    print(f"   Source: {SSOT_DIR}")
    print("=" * 60)

    for file_name in FILES_TO_SYNC:
        source_path = SSOT_DIR / file_name
        
        if not source_path.exists():
            # Check if we should find it in src/data (initial migration fallback)
            fallback_path = Path("path-builder/src/data") / file_name
            if fallback_path.exists():
                print(f"🚀 Migrating {file_name} from src/data/ to SSoT (content/)...")
                if not SSOT_DIR.exists():
                    os.makedirs(SSOT_DIR)
                shutil.copy2(fallback_path, source_path)
            else:
                # print(f"⚠️ Skipping {file_name}: Not found in {source_path}")
                continue

        for target_dir in TARGETS:
            if not target_dir.exists():
                os.makedirs(target_dir)
            
            target_path = target_dir / file_name
            
            # Use copy2 to preserve metadata (timestamps) if possible
            # print(f"   Copying {file_name} to {target_dir}")
            shutil.copy2(source_path, target_path)

    print("\n✅ Sync complete!")
    print("=" * 60)

if __name__ == "__main__":
    sync_data()
