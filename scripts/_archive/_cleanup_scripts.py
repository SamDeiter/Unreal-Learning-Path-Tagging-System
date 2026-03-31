import os
import shutil
import glob

# Configuration
SCRIPTS_DIR = r"scripts"
ARCHIVE_DIR = os.path.join(SCRIPTS_DIR, "_archive")

# Ensure archive directory exists
if not os.path.exists(ARCHIVE_DIR):
    os.makedirs(ARCHIVE_DIR)
    print(f"Created archive directory: {ARCHIVE_DIR}")

# Patterns for scripts to archive
ARCHIVE_PATTERNS = [
    "_*.py",       # Underscore prefixed scripts
    "*_v1.py",      # Explicit v1 versions
    "whisper_cms_transcripts.py", # Specifically superseded by v2
]

MODERN_VERSIONS = {
    "whisper_cms_transcripts.py": "whisper_cms_transcripts_v2.py",
}

for pattern in ARCHIVE_PATTERNS:
    for file_path in glob.glob(os.path.join(SCRIPTS_DIR, pattern)):
        # Skip if it is already in the archive or is the archive itself
        if "_archive" in file_path or os.path.isdir(file_path):
            continue
            
        file_name = os.path.basename(file_path)
        
        # Check if it has a v2 successor
        successor_msg = ""
        if file_name in MODERN_VERSIONS:
            successor_msg = f" (Superseded by {MODERN_VERSIONS[file_name]})"
        
        target_path = os.path.join(ARCHIVE_DIR, file_name)
        
        # Avoid overwriting existing archives
        if os.path.exists(target_path):
            print(f"File {file_name} already exists in archive, skipping.")
            continue
            
        print(f"Archiving: {file_name}{successor_msg}")
        shutil.move(file_path, target_path)

print("\nScript archiving complete.")
