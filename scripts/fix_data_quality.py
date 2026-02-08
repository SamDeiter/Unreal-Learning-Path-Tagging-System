"""
fix_data_quality.py — Fixes data quality issues in tags/tags.json and tags/edges.json.

Fixes applied:
  1. Deduplicate tags (merge second into first by tag_id)
  2. Create missing tag stubs for dangling related_tags references
  3. Remove self-referencing edges (source == target)
  4. Connect orphan tags with 'related' edges to namespace siblings
  5. Sync cleaned files to sample_data/

Usage:
  python scripts/fix_data_quality.py
"""

import json
import os
import shutil
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS_PATH = os.path.join(ROOT, "tags", "tags.json")
EDGES_PATH = os.path.join(ROOT, "tags", "edges.json")
SAMPLE_TAGS = os.path.join(ROOT, "sample_data", "tags.json")
SAMPLE_EDGES = os.path.join(ROOT, "sample_data", "edges.json")

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# ---- Stub tag definitions for dangling references ----
# These are the 7 missing tags referenced in related_tags
STUB_TAGS = {
    "animation.state_machine": {
        "display_name": "Animation State Machine",
        "tag_type": "system",
        "category_path": ["Animation", "State Machines"],
        "description": "Animation state machines control transitions between animation states in Unreal Engine.",
    },
    "ai.navigation": {
        "display_name": "AI Navigation",
        "tag_type": "system",
        "category_path": ["AI", "Navigation"],
        "description": "AI navigation and pathfinding using NavMesh in Unreal Engine.",
    },
    "multiplayer.rpc": {
        "display_name": "Remote Procedure Calls",
        "tag_type": "system",
        "category_path": ["Multiplayer", "Networking"],
        "description": "Remote Procedure Calls (RPCs) for client-server communication in UE multiplayer.",
    },
    "environment.foliage": {
        "display_name": "Foliage",
        "tag_type": "system",
        "category_path": ["Environment", "Foliage"],
        "description": "Foliage painting, instancing, and management in Unreal Engine environments.",
    },
    "crash.gpu": {
        "display_name": "GPU Crash",
        "tag_type": "symptom",
        "category_path": ["Crashes", "GPU"],
        "description": "GPU-related crashes including driver timeouts and out-of-memory errors.",
    },
    "platform.mobile": {
        "display_name": "Mobile",
        "tag_type": "platform",
        "category_path": ["Platforms", "Mobile"],
        "description": "Mobile platform development for iOS and Android with Unreal Engine.",
    },
}

# ---- Orphan → sibling mappings (connect orphans to existing tags in same namespace) ----
ORPHAN_EDGES = {
    "scripting.python": ("scripting.blueprint", "related", 0.5),
    "genre.survival": ("genre.fps", "related", 0.5),
    "platform.windows": ("platform.quest", "related", 0.4),
    "rendering.vsm": ("rendering.lumen", "related", 0.7),
    "animation.epic_skeleton": ("animation.general", "related", 0.6),
    "physics.chaos": ("rendering.niagara", "related", 0.5),
    "scripting.gameplay_tags": ("scripting.blueprint", "related", 0.6),
    "environment.pcg": ("environment.landscape", "related", 0.7),
    "style.realistic": ("rendering.lumen", "related", 0.5),
    "style.stylized": ("rendering.material", "related", 0.5),
    "style.low_poly": ("rendering.material", "related", 0.5),
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def fix_tags(tags_data):
    """Deduplicate tags and add missing stubs."""
    tags = tags_data["tags"]
    stats = {"duplicates_removed": 0, "stubs_added": 0}

    # 1. Deduplicate by tag_id (keep first occurrence)
    seen = {}
    deduped = []
    for tag in tags:
        tid = tag["tag_id"]
        if tid in seen:
            stats["duplicates_removed"] += 1
            print(f"  🗑️  Removed duplicate: '{tid}'")
            # Merge any unique synonyms/aliases from duplicate
            first = seen[tid]
            for syn in tag.get("synonyms", []):
                if syn not in first.get("synonyms", []):
                    first.setdefault("synonyms", []).append(syn)
        else:
            seen[tid] = tag
            deduped.append(tag)

    # 2. Add stub tags for dangling references
    existing_ids = {t["tag_id"] for t in deduped}
    for stub_id, stub_info in STUB_TAGS.items():
        if stub_id not in existing_ids:
            stub = {
                "tag_id": stub_id,
                "display_name": stub_info["display_name"],
                "tag_type": stub_info["tag_type"],
                "category_path": stub_info["category_path"],
                "description": stub_info["description"],
                "synonyms": [],
                "relevance": {"global_weight": 0.6, "confidence": 0.7},
                "governance": {
                    "status": "active",
                    "owner": "auto-stub",
                    "created_utc": TODAY,
                    "updated_utc": TODAY,
                },
            }
            deduped.append(stub)
            stats["stubs_added"] += 1
            print(f"  ➕ Added stub tag: '{stub_id}'")

    tags_data["tags"] = deduped
    tags_data["generated_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return stats


def fix_edges(edges_data, tag_ids):
    """Remove self-refs, add orphan edges."""
    edges = edges_data["edges"]
    stats = {"self_refs_removed": 0, "orphan_edges_added": 0}

    # 1. Remove self-referencing edges
    cleaned = []
    for edge in edges:
        if edge["source"] == edge["target"]:
            stats["self_refs_removed"] += 1
            print(f"  🗑️  Removed self-ref: '{edge['source']}' → '{edge['target']}' ({edge['relation']})")
        else:
            cleaned.append(edge)

    # 2. Add orphan connection edges
    # Build set of tags already in edges
    edge_tag_ids = set()
    for edge in cleaned:
        edge_tag_ids.add(edge["source"])
        edge_tag_ids.add(edge["target"])

    existing_keys = {f"{e['source']}→{e['target']}:{e['relation']}" for e in cleaned}

    for orphan_id, (target, relation, weight) in ORPHAN_EDGES.items():
        if orphan_id not in tag_ids:
            continue  # Skip if tag doesn't exist
        if target not in tag_ids:
            continue  # Skip if target doesn't exist
        key = f"{orphan_id}→{target}:{relation}"
        if key not in existing_keys:
            cleaned.append({
                "source": orphan_id,
                "target": target,
                "relation": relation,
                "weight": weight,
            })
            stats["orphan_edges_added"] += 1
            print(f"  🔗 Connected orphan: '{orphan_id}' → '{target}' ({relation})")

    edges_data["edges"] = cleaned
    return stats


def main():
    print("🔧 Fix Data Quality — tags/tags.json + tags/edges.json\n")

    # Load
    tags_data = load_json(TAGS_PATH)
    edges_data = load_json(EDGES_PATH)

    print(f"📊 Before: {len(tags_data['tags'])} tags, {len(edges_data['edges'])} edges\n")

    # Fix tags
    print("── Fixing tags ──")
    tag_stats = fix_tags(tags_data)

    # Fix edges (using updated tag IDs)
    tag_ids = {t["tag_id"] for t in tags_data["tags"]}
    print("\n── Fixing edges ──")
    edge_stats = fix_edges(edges_data, tag_ids)

    # Save
    print("\n── Saving ──")
    save_json(TAGS_PATH, tags_data)
    print(f"  💾 Saved tags/tags.json ({len(tags_data['tags'])} tags)")

    save_json(EDGES_PATH, edges_data)
    print(f"  💾 Saved tags/edges.json ({len(edges_data['edges'])} edges)")

    # Sync to sample_data
    shutil.copy2(TAGS_PATH, SAMPLE_TAGS)
    print(f"  📋 Synced → sample_data/tags.json")

    shutil.copy2(EDGES_PATH, SAMPLE_EDGES)
    print(f"  📋 Synced → sample_data/edges.json")

    print(f"\n✅ Done!")
    print(f"   Tags: {tag_stats['duplicates_removed']} duplicates removed, {tag_stats['stubs_added']} stubs added")
    print(f"   Edges: {edge_stats['self_refs_removed']} self-refs removed, {edge_stats['orphan_edges_added']} orphan edges added")


if __name__ == "__main__":
    main()
