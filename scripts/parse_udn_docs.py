#!/usr/bin/env python3
"""
parse_udn_docs.py — Parse UE 5.5 UDN Documentation Source
============================================================
Parses all .INT.udn files from Epic's Perforce documentation source
into structured JSON compatible with doc_links.json.

Usage:
    python scripts/parse_udn_docs.py [--source PATH] [--output PATH] [--merge]
"""

import argparse
import json
import os
import re
import sys
import math
from pathlib import Path
from collections import defaultdict

# Default paths
DEFAULT_UDN_SOURCE = r"C:\Users\Sam Deiter\Perforce\Sam.Deiter_CDW-5TUM53QQ6HQ_UE-5.5_6153\Source"
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "content", "udn_docs.json")
DOC_LINKS_PATH = os.path.join(os.path.dirname(__file__), "..", "path-builder", "src", "data", "doc_links.json")

# Epic docs base URL
EPIC_DOCS_BASE = "https://dev.epicgames.com/documentation/en-us/unreal-engine"

# Directories to skip (API references are huge and not useful for learning paths)
SKIP_DIRS = {"API", "BlueprintAPI", "Globals", "Images", "Skins", "site-index", "edc-qc-test"}


def parse_udn_header(lines):
    """Parse the YAML-like header block from a .udn file.
    
    Headers are key:value pairs at the top of the file, before the first
    blank line or content paragraph. Some keys appear multiple times (Tags, Track, etc.)
    """
    header = {}
    multi_keys = defaultdict(list)  # Keys that can appear multiple times
    header_end = 0
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Empty line or content start (markdown heading, paragraph, etc.)
        if not line:
            header_end = i
            break
        
        # Check for key:value pattern
        # Headers look like "Key: Value" or "Key:Value"
        match = re.match(r'^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)', line)
        if match:
            key = match.group(1).lower().replace("-", "_")
            value = match.group(2).strip()
            
            # Multi-value keys
            if key in ("tags", "track", "related", "redirect", "course"):
                multi_keys[key].append(value)
            else:
                header[key] = value
            header_end = i + 1
        elif line.startswith("[") or line.startswith("#") or line.startswith("!"):
            # Content started without blank line separator
            header_end = i
            break
    
    # Merge multi-value keys
    for key, values in multi_keys.items():
        header[key] = values
    
    return header, header_end


def extract_sections(body_text):
    """Extract H2 and H3 section headings from the body."""
    sections = []
    for match in re.finditer(r'^#{2,3}\s+(.+)', body_text, re.MULTILINE):
        heading = match.group(1).strip()
        # Clean up anchor links
        heading = re.sub(r'\[.*?\]\(.*?\)', '', heading).strip()
        if heading and len(heading) > 2:
            sections.append(heading)
    return sections


def extract_key_steps(body_text):
    """Extract actionable steps from numbered lists and bullet points under headings.
    
    Focuses on instructional content: numbered lists (1. 2. 3.) and
    bullet lists (* or -) that describe HOW to do something.
    """
    steps = []
    
    # Find numbered list items (1. Step text)
    for match in re.finditer(r'^\d+\.\s+(.+)', body_text, re.MULTILINE):
        step_text = clean_udn_markup(match.group(1).strip())
        if step_text and len(step_text) > 15 and len(step_text) < 500:
            steps.append(step_text)
    
    # If we didn't find numbered steps, look for bullet points under "how to" sections
    if len(steps) < 3:
        # Find bullet items that are instructional
        for match in re.finditer(r'^\*\s+(.+)', body_text, re.MULTILINE):
            step_text = clean_udn_markup(match.group(1).strip())
            if step_text and len(step_text) > 20 and len(step_text) < 500:
                # Filter out non-instructional bullets (feature lists, etc.)
                if any(verb in step_text.lower() for verb in 
                       ["click", "select", "open", "navigate", "set", "enable", "disable",
                        "check", "drag", "use", "create", "add", "import", "configure",
                        "right-click", "choose", "enter", "type", "adjust"]):
                    steps.append(step_text)
    
    # Deduplicate and limit
    seen = set()
    unique_steps = []
    for s in steps:
        normalized = s.lower()[:50]
        if normalized not in seen:
            seen.add(normalized)
            unique_steps.append(s)
    
    return unique_steps[:8]  # Cap at 8 steps


def extract_see_also(header, body_text):
    """Extract see-also references from Related: headers and inline doc links."""
    see_also = []
    seen_keys = set()
    
    # From Related: headers
    for related in header.get("related", []):
        doc_key = related.strip().rstrip("/").split("/")[-1].lower()
        doc_key = re.sub(r'[^a-z0-9_-]', '_', doc_key)
        if doc_key and doc_key not in seen_keys:
            seen_keys.add(doc_key)
            # Make a readable label from the path
            label = doc_key.replace("-", " ").replace("_", " ").title()
            see_also.append({"label": label, "docKey": doc_key})
    
    # From inline links like [text](path/to/doc)
    for match in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', body_text):
        link_text = match.group(1).strip()
        link_path = match.group(2).strip()
        # Only internal doc links (not images, not external)
        if (link_path and 
            not link_path.startswith("http") and 
            not link_path.endswith((".png", ".gif", ".jpg")) and
            "/" in link_path):
            doc_key = link_path.strip().rstrip("/").split("/")[-1].lower()
            doc_key = re.sub(r'[^a-z0-9_-]', '_', doc_key)
            if doc_key and doc_key not in seen_keys and len(link_text) > 3:
                seen_keys.add(doc_key)
                see_also.append({"label": link_text, "docKey": doc_key})
    
    return see_also[:10]  # Cap at 10


def clean_udn_markup(text):
    """Remove UDN-specific markup from text, keeping readable content."""
    # Remove [REGION] blocks markers
    text = re.sub(r'\[/?REGION[^\]]*\]', '', text)
    # Remove [OBJECT] blocks
    text = re.sub(r'\[/?OBJECT[^\]]*\]', '', text)
    # Remove [PARAM] blocks
    text = re.sub(r'\[/?PARAM[^\]]*\]', '', text)
    # Remove [INCLUDE] refs
    text = re.sub(r'\[INCLUDE:[^\]]*\]', '', text)
    # Remove [EXCERPT] blocks
    text = re.sub(r'\[/?EXCERPT[^\]]*\]', '', text)
    # Remove [COMMENT] blocks entirely
    text = re.sub(r'\[COMMENT\].*?\[/COMMENT\]', '', text, flags=re.DOTALL)
    # Remove [TOC] directives
    text = re.sub(r'\[TOC[^\]]*\]', '', text)
    # Remove [DIR] directives
    text = re.sub(r'\[DIR[^\]]*\]', '', text)
    # Remove image references ![alt](path)
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)', '', text)
    # Remove inline image refs like (w:800)
    text = re.sub(r'\([a-z]:\d+\)', '', text)
    # Remove %path:type% references
    text = re.sub(r'%[^%]+%', '', text)
    # Remove ~~~ code fences
    text = re.sub(r'~~~.*?~~~', '', text, flags=re.DOTALL)
    # Remove [PARAMLITERAL] blocks
    text = re.sub(r'\[/?PARAMLITERAL[^\]]*\]', '', text)
    # Remove [EMBED] video blocks
    text = re.sub(r'\[OBJECT:EmbeddedVideo\].*?\[/OBJECT\]', '', text, flags=re.DOTALL)
    # Clean up multiple whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove backslash path separators in doc links
    text = text.replace('\\', '/')
    
    return text


def estimate_read_time(body_text):
    """Estimate reading time in minutes based on word count."""
    words = len(body_text.split())
    # Average reading speed: 200 words per minute for technical docs
    return max(1, math.ceil(words / 200))


def build_doc_url(relative_path, header):
    """Build the Epic docs URL from the file's relative path and SEO title."""
    # Convert path to URL slug
    # e.g., "designing-visuals-rendering-and-graphics/rendering-optimization/nanite"
    # → "https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine"
    
    # Use SEO-Title if available (most reliable for URL construction)
    seo_title = header.get("seo_title", "")
    if seo_title:
        # Epic URLs use the SEO title slugified
        slug = seo_title.lower().strip()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')
        return f"{EPIC_DOCS_BASE}/{slug}"
    
    # Fallback: use the last path segment
    slug = relative_path.rstrip("/").split("/")[-1].lower()
    slug = re.sub(r'[^a-z0-9-]', '-', slug)
    return f"{EPIC_DOCS_BASE}/{slug}"


def generate_doc_key(relative_path):
    """Generate a unique doc key from the relative path."""
    # Take the last meaningful path segment
    parts = relative_path.strip("/").split("/")
    # Use the last part, cleaned
    key = parts[-1].lower()
    key = re.sub(r'[^a-z0-9_-]', '_', key)
    return key


def parse_single_udn(filepath, source_root):
    """Parse a single .udn file into a structured dict."""
    try:
        # Try UTF-8 first, then fall back to latin-1
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(filepath, 'r', encoding='latin-1') as f:
                content = f.read()
        
        lines = content.split('\n')
        header, header_end = parse_udn_header(lines)
        
        # Skip non-public docs
        availability = header.get("availability", "Public")
        if availability.lower() != "public":
            return None
        
        # Get the body (everything after the header)
        body_lines = lines[header_end:]
        body_text = '\n'.join(body_lines)
        
        # Calculate relative path from source root
        rel_path = os.path.relpath(os.path.dirname(filepath), source_root)
        rel_path = rel_path.replace("\\", "/")
        
        # Extract fields
        title = header.get("title", "")
        if not title:
            return None  # Skip entries without a title
        
        description = header.get("description", header.get("seo_description", ""))
        tags = header.get("tags", [])
        if isinstance(tags, str):
            tags = [tags]
        tags = [t.lower().strip() for t in tags if t.strip()]
        
        doc_type = header.get("type", "Overview")
        parent = header.get("parent", "")
        version = header.get("version", "5.5")
        
        tracks = header.get("track", [])
        if isinstance(tracks, str):
            tracks = [tracks]
        
        skill_family = header.get("skill_family", "")
        engine_concept = header.get("engine_concept", "")
        
        # Parse body content
        clean_body = clean_udn_markup(body_text)
        sections = extract_sections(body_text)
        key_steps = extract_key_steps(body_text)
        see_also = extract_see_also(header, body_text)
        read_time = estimate_read_time(clean_body)
        
        # Build URL and key
        doc_key = generate_doc_key(rel_path)
        url = build_doc_url(rel_path, header)
        
        entry = {
            "label": title.strip(),
            "url": url,
            "description": description.strip(),
            "tags": tags,
            "type": doc_type,
            "parent": parent,
            "version": str(version).strip(),
            "sections": sections,
            "keySteps": key_steps,
            "seeAlso": see_also,
            "readTimeMinutes": read_time,
            "sourcePath": rel_path,
        }
        
        # Optional fields
        if tracks:
            entry["track"] = tracks
        if skill_family:
            entry["skillFamily"] = skill_family
        if engine_concept:
            entry["engineConcept"] = engine_concept
        
        return doc_key, entry
        
    except Exception as e:
        print(f"  ❌ Error parsing {filepath}: {e}")
        return None


def merge_with_existing(udn_docs, existing_path):
    """Merge UDN-parsed docs with existing doc_links.json.
    
    Strategy:
    - Existing entries with Gemini-extracted keySteps keep them
    - New UDN entries are added
    - Existing entries get enriched with UDN metadata (tags, sections, etc.)
    """
    if not os.path.exists(existing_path):
        print(f"  ⚠️  No existing doc_links.json found at {existing_path}")
        return udn_docs
    
    with open(existing_path, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    
    merged = {}
    
    # Start with all UDN entries
    for key, entry in udn_docs.items():
        merged[key] = entry
    
    # Overlay existing entries (they may have Gemini-extracted keySteps)
    preserved_count = 0
    for key, existing_entry in existing.items():
        if key in merged:
            # If existing entry has keySteps from Gemini, keep them
            existing_steps = existing_entry.get("keySteps", [])
            udn_steps = merged[key].get("keySteps", [])
            
            if existing_steps and len(existing_steps) >= len(udn_steps):
                merged[key]["keySteps"] = existing_steps
                preserved_count += 1
            
            # Preserve existing URL if it looks more specific
            if existing_entry.get("url") and "dev.epicgames.com" in existing_entry["url"]:
                merged[key]["url"] = existing_entry["url"]
        else:
            # Keep entries that exist in doc_links but not in UDN
            merged[key] = existing_entry
    
    print(f"  📋 Preserved {preserved_count} existing Gemini-extracted keySteps")
    print(f"  📋 Kept {len(existing) - sum(1 for k in existing if k in udn_docs)} entries only in existing doc_links")
    
    return merged


def main():
    parser = argparse.ArgumentParser(description="Parse UE 5.5 UDN documentation source")
    parser.add_argument("--source", default=DEFAULT_UDN_SOURCE, 
                        help="Path to UDN Source directory")
    parser.add_argument("--output", default=DEFAULT_OUTPUT,
                        help="Output JSON path")
    parser.add_argument("--merge", action="store_true",
                        help="Merge with existing doc_links.json")
    parser.add_argument("--stats", action="store_true",
                        help="Print statistics after parsing")
    args = parser.parse_args()
    
    source_dir = Path(args.source)
    if not source_dir.exists():
        print(f"❌ Source directory not found: {source_dir}")
        sys.exit(1)
    
    print(f"🔍 Scanning {source_dir} for .INT.udn files...")
    
    # Find all English .udn files
    udn_files = []
    for root, dirs, files in os.walk(source_dir):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for f in files:
            if f.endswith(".INT.udn"):
                udn_files.append(os.path.join(root, f))
    
    print(f"📄 Found {len(udn_files)} English documentation files")
    print()
    
    # Parse all files
    docs = {}
    errors = 0
    skipped = 0
    duplicates = 0
    
    for i, filepath in enumerate(udn_files):
        result = parse_single_udn(filepath, str(source_dir))
        
        if result is None:
            skipped += 1
            continue
        
        doc_key, entry = result
        
        # Handle duplicate keys by appending parent path
        if doc_key in docs:
            # Make the key more specific
            parent_slug = entry.get("parent", "").rstrip("/").split("/")[-1] if entry.get("parent") else ""
            if parent_slug:
                doc_key = f"{parent_slug}_{doc_key}"
            else:
                doc_key = f"{doc_key}_{duplicates}"
            duplicates += 1
        
        docs[doc_key] = entry
        
        if (i + 1) % 500 == 0:
            print(f"  ✅ [{i+1}/{len(udn_files)}] {entry['label']}")
    
    print()
    print(f"============================================================")
    print(f"Done! {len(docs)} docs parsed, {skipped} skipped, {duplicates} key collisions resolved")
    
    # Merge if requested
    if args.merge:
        print(f"\n🔀 Merging with existing doc_links.json...")
        docs = merge_with_existing(docs, DOC_LINKS_PATH)
        print(f"  📊 Final merged count: {len(docs)} entries")
    
    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Written to {output_path}")
    
    # Stats
    if args.stats or True:  # Always show stats
        with_steps = sum(1 for d in docs.values() if d.get("keySteps"))
        with_tags = sum(1 for d in docs.values() if d.get("tags"))
        with_sections = sum(1 for d in docs.values() if d.get("sections"))
        with_see_also = sum(1 for d in docs.values() if d.get("seeAlso"))
        
        types = defaultdict(int)
        for d in docs.values():
            types[d.get("type", "Unknown")] += 1
        
        avg_steps = sum(len(d.get("keySteps", [])) for d in docs.values()) / max(len(docs), 1)
        avg_read = sum(d.get("readTimeMinutes", 0) for d in docs.values()) / max(len(docs), 1)
        
        print(f"\n📊 Statistics:")
        print(f"  Total entries:     {len(docs)}")
        print(f"  With keySteps:     {with_steps} ({100*with_steps/len(docs):.0f}%)")
        print(f"  With tags:         {with_tags} ({100*with_tags/len(docs):.0f}%)")
        print(f"  With sections:     {with_sections} ({100*with_sections/len(docs):.0f}%)")
        print(f"  With seeAlso:      {with_see_also} ({100*with_see_also/len(docs):.0f}%)")
        print(f"  Avg steps/doc:     {avg_steps:.1f}")
        print(f"  Avg read time:     {avg_read:.1f} min")
        print(f"\n  📂 By Type:")
        for t, count in sorted(types.items(), key=lambda x: -x[1]):
            print(f"    {t:20s} {count:>5}")


if __name__ == "__main__":
    main()
