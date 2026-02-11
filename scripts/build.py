#!/usr/bin/env python3
"""Build script for UE5 Learning Path Builder.

Generates static paths, updates version, and prepares for deployment.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.path_generator import PathGenerator

# Build configuration
BUILD_DIR = Path(__file__).parent.parent / "ui"
PATHS_DIR = BUILD_DIR / "paths"
VERSION_FILE = BUILD_DIR / "version.json"

# Common queries to pre-generate
COMMON_QUERIES = [
    "Lumen flickering",
    "Lumen noise",
    "Lumen artifacts",
    "packaging error",
    "ExitCode 25",
    "cook failed",
    "blueprint accessed none",
    "D3D device lost",
    "GPU crash",
    "Nanite performance",
    "Nanite LOD",
]


def get_next_build_number():
    """Read and increment build number."""
    if VERSION_FILE.exists():
        with open(VERSION_FILE) as f:
            data = json.load(f)
            build = data.get("build", 0) + 1
    else:
        build = 1
    return build


def generate_static_paths():
    """Generate JSON files for common queries."""
    PATHS_DIR.mkdir(exist_ok=True)

    print("🔧 Generating static paths...")
    generator = PathGenerator()
    generated = 0

    for query in COMMON_QUERIES:
        # Create safe filename
        filename = query.lower().replace(" ", "_").replace("/", "_") + ".json"
        filepath = PATHS_DIR / filename

        print(f"  → {query}...", end=" ")
        try:
            path = generator.generate_path(query)

            # Convert to dict for JSON
            path_dict = {
                "path_id": path.path_id,
                "title": path.title,
                "query": path.query,
                "tags": path.tags,
                "ai_summary": path.ai_summary,
                "ai_what_you_learn": path.ai_what_you_learn,
                "ai_key_takeaways": getattr(path, 'ai_key_takeaways', None),
                "steps": [
                    {
                        "number": s.step_number,
                        "type": s.step_type,
                        "title": s.title,
                        "description": s.description,
                        "action": s.skills_gained[0] if s.skills_gained else None,
                        "content": [
                            {
                                "type": c.source_type,
                                "title": c.title,
                                "url": c.url,
                                "thumbnail_url": c.thumbnail_url,
                                "description": c.description,
                            }
                            for c in s.content
                        ],
                    }
                    for s in path.steps
                ],
            }

            with open(filepath, "w") as f:
                json.dump(path_dict, f, indent=2)

            print(f"✓ ({len(path.steps)} steps)")
            generated += 1

        except Exception as e:
            print(f"✗ ({e})")

    return generated


def update_version(build_number):
    """Update version.json with build info."""
    version_data = {
        "version": "1.0.0",
        "build": build_number,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "queries_cached": len(list(PATHS_DIR.glob("*.json"))) if PATHS_DIR.exists() else 0,
    }

    with open(VERSION_FILE, "w") as f:
        json.dump(version_data, f, indent=2)

    return version_data


def create_path_index():
    """Create index of available cached paths."""
    if not PATHS_DIR.exists():
        return []

    index = []
    for filepath in PATHS_DIR.glob("*.json"):
        # Skip the index file itself
        if filepath.name == "index.json":
            continue
        with open(filepath) as f:
            data = json.load(f)
            index.append({
                "query": data.get("query", filepath.stem),
                "file": filepath.name,
                "steps": len(data.get("steps", [])),
            })

    index_file = PATHS_DIR / "index.json"
    with open(index_file, "w") as f:
        json.dump(index, f, indent=2)

    return index


def main():
    """Run build process."""
    print("=" * 50)
    print("🏗️  UE5 Learning Path Builder - Build")
    print("=" * 50)

    # Get build number
    build_number = get_next_build_number()
    print(f"\n📦 Build #{build_number}")

    # Generate static paths (optional - skip with --skip-paths)
    if "--skip-paths" not in sys.argv:
        generated = generate_static_paths()
        print(f"\n✅ Generated {generated} static paths")

    # Create path index
    index = create_path_index()
    print(f"📋 Created index with {len(index)} cached queries")

    # Update version
    version = update_version(build_number)
    print(f"\n📌 Version: {version['version']} (build {version['build']})")
    print(f"📅 Timestamp: {version['timestamp']}")

    # Create xAPI package for LMS (optional - with --xapi flag)
    if "--xapi" in sys.argv:
        xapi_file = create_xapi_package(build_number)
        print(f"\n📦 xAPI Package: {xapi_file}")

    print("\n" + "=" * 50)
    print("✅ Build complete!")
    print("   Deploy with: firebase deploy")
    if "--xapi" in sys.argv:
        print(f"   LMS Package: xapi_output/learning-paths-v{build_number}.zip")
    print("=" * 50)


def create_xapi_package(build_number):
    """Create xAPI (Tin Can) package for Absorb LMS.

    This creates a ZIP file that can be uploaded to Absorb LMS.
    """
    import zipfile

    xapi_output_dir = Path(__file__).parent.parent / "xapi_output"
    xapi_output_dir.mkdir(exist_ok=True)

    package_name = f"learning-paths-v{build_number}.zip"
    package_path = xapi_output_dir / package_name

    print("\n📦 Creating xAPI package...")

    # Files to include in the package
    ui_dir = Path(__file__).parent.parent / "ui"
    files_to_include = [
        ("index.html", ui_dir / "index.html"),
        ("tincan.xml", ui_dir / "tincan.xml"),
        ("version.json", ui_dir / "version.json"),
        ("js/xapiwrapper.min.js", ui_dir / "js" / "xapiwrapper.min.js"),
        ("js/tracking.js", ui_dir / "js" / "tracking.js"),
    ]

    # Add all cached paths
    paths_dir = ui_dir / "paths"
    if paths_dir.exists():
        for path_file in paths_dir.glob("*.json"):
            files_to_include.append((f"paths/{path_file.name}", path_file))

    # Create the ZIP
    with zipfile.ZipFile(package_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for archive_name, source_path in files_to_include:
            if source_path.exists():
                zf.write(source_path, archive_name)
                print(f"  + {archive_name}")
            else:
                print(f"  ⚠ Missing: {archive_name}")

    print(f"  ✅ Package created: {package_path}")
    return package_path


if __name__ == "__main__":
    main()

