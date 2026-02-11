"""
extract_key_steps.py — Extract keySteps + seeAlso from scraped Epic docs via Gemini
═══════════════════════════════════════════════════════════════════════════════════════
Reads content/scraped_docs.json (pre-scraped Epic doc pages), matches them to
doc_links.json entries by URL slug, then calls Gemini to extract structured
key steps and cross-references from the actual documentation text.

Usage:
    python scripts/extract_key_steps.py                  # Process all entries
    python scripts/extract_key_steps.py --limit 10       # Process only 10 entries
    python scripts/extract_key_steps.py --dry-run        # Preview without writing
    python scripts/extract_key_steps.py --resume         # Resume from checkpoint
    python scripts/extract_key_steps.py --key nanite     # Process single entry
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime

# ─── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
DOC_LINKS = REPO_ROOT / "path-builder" / "src" / "data" / "doc_links.json"
SCRAPED_DOCS = REPO_ROOT / "content" / "scraped_docs.json"
CHECKPOINT = REPO_ROOT / "content" / "keysteps_checkpoint.json"

# ─── Gemini Config ─────────────────────────────────────────────────────────────
MODEL = "gemini-2.0-flash"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
REQUEST_DELAY = 1.0  # 1s between requests (rate limit friendly)
MAX_RETRIES = 3       # Retry on transient API errors
RETRY_DELAYS = [5, 20, 60]  # Exponential backoff
MAX_INPUT_CHARS = 8000  # Truncate doc text to fit context window

# ─── Extraction Prompt ─────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are an expert Unreal Engine 5 developer. Given the following documentation text scraped from Epic's official UE5 docs, extract:

1. **keySteps**: 4-6 specific, actionable steps a developer would follow. Rules:
   - Steps must come DIRECTLY from the documentation text — do NOT hallucinate or invent steps
   - Use imperative mood ("Open Project Settings" not "You should open Project Settings")
   - Include specific menu paths, panel names, or function names when mentioned in the text
   - Each step should be a single, clear action
   - If the doc is conceptual (no clear procedure), extract the most important practical takeaways

2. **seeAlso**: 2-4 related topics that pair naturally with this content. Rules:
   - Only suggest topics from this allowed list: {allowed_keys}
   - Return as objects with "label" (display name) and "docKey" (the key from the list)
   - Choose genuinely related topics, not just random ones

Return ONLY valid JSON in this exact format, no markdown fences:
{{"keySteps": ["step 1", "step 2", ...], "seeAlso": [{{"label": "Display Name", "docKey": "key_name"}}]}}

Documentation title: {title}
Documentation text (may be truncated):
{doc_text}
"""


def get_api_key():
    """Get Gemini API key from .env file or environment."""
    # Try .env file first
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k in ("GEMINI_API_KEY", "GOOGLE_API_KEY") and v:
                return v

    # Fall back to environment
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("ERROR: No Gemini API key found. Set GEMINI_API_KEY in .env or env var.")
        sys.exit(1)
    return key


def slug_from_url(url):
    """Extract slug from an Epic docs URL."""
    base = "https://dev.epicgames.com/documentation/en-us/unreal-engine/"
    if url.startswith(base):
        return url[len(base):].rstrip("/")
    return None


def build_slug_index(scraped_docs):
    """Build a slug → concatenated text index from scraped docs."""
    index = {}
    for doc in scraped_docs:
        slug = doc.get("slug", "")
        chunks = doc.get("chunks", [])
        full_text = "\n\n".join(c.get("text", "") for c in chunks)
        index[slug] = {
            "text": full_text,
            "title": doc.get("title", slug),
            "word_count": len(full_text.split()),
        }
    return index


def call_gemini(prompt, api_key):
    """Call Gemini API with retry + exponential backoff."""
    import urllib.request
    import urllib.error

    url = f"{API_URL}?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
            "responseMimeType": "application/json",
        },
    }

    last_err = None
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                return text
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            last_err = e
            if e.code == 429 or (e.code == 400 and "API_KEY_INVALID" not in body):
                # Rate limited — backoff and retry
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
                print(f"    Rate limited (HTTP {e.code}), retrying in {delay}s...")
                time.sleep(delay)
                continue
            elif e.code == 400 and "expired" in body.lower():
                # Genuinely expired key — wait longer and retry once
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
                print(f"    API key issue, waiting {delay}s and retrying...")
                time.sleep(delay)
                continue
            else:
                print(f"    API error {e.code}: {body[:200]}")
                raise
        except Exception as e:
            last_err = e
            print(f"    API error: {e}")
            raise

    # All retries exhausted
    raise last_err or Exception("All retries exhausted")


def parse_extraction(raw_text, allowed_keys):
    """Parse the LLM's JSON response, validating seeAlso keys."""
    # Strip markdown fences if present
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        print(f"    WARN: Failed to parse JSON, trying to extract...")
        # Try to find JSON in response
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                return None
        else:
            return None

    # Validate keySteps
    key_steps = data.get("keySteps", [])
    if not isinstance(key_steps, list):
        key_steps = []
    key_steps = [s for s in key_steps if isinstance(s, str) and len(s) > 10][:6]

    # Validate seeAlso — only allow known doc_links keys
    see_also = data.get("seeAlso", [])
    if not isinstance(see_also, list):
        see_also = []
    valid_see_also = []
    for ref in see_also:
        if isinstance(ref, dict) and ref.get("docKey") in allowed_keys:
            valid_see_also.append({
                "label": ref.get("label", ref["docKey"]),
                "docKey": ref["docKey"],
            })
    valid_see_also = valid_see_also[:4]

    if not key_steps:
        return None

    return {
        "keySteps": key_steps,
        "seeAlso": valid_see_also,
    }


def save_checkpoint(processed_keys):
    """Save progress checkpoint."""
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT, "w") as f:
        json.dump({
            "processed": processed_keys,
            "timestamp": datetime.now().isoformat(),
        }, f)


def load_checkpoint():
    """Load processed keys from checkpoint."""
    if CHECKPOINT.exists():
        data = json.load(open(CHECKPOINT))
        return set(data.get("processed", []))
    return set()


def main():
    parser = argparse.ArgumentParser(description="Extract key steps from scraped Epic docs")
    parser.add_argument("--limit", type=int, default=0, help="Max entries to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--key", type=str, help="Process a single doc_links key")
    args = parser.parse_args()

    # Load data
    print(f"Loading doc_links from {DOC_LINKS}...")
    with open(DOC_LINKS, "r", encoding="utf-8") as f:
        doc_links = json.load(f)
    print(f"  {len(doc_links)} entries")

    print(f"Loading scraped docs from {SCRAPED_DOCS}...")
    with open(SCRAPED_DOCS, "r", encoding="utf-8") as f:
        scraped_docs = json.load(f)
    slug_index = build_slug_index(scraped_docs)
    print(f"  {len(slug_index)} scraped pages indexed")

    # Build allowed keys list for seeAlso validation
    allowed_keys = set(doc_links.keys())
    # Compact version for prompt (top 50 keys by alphabetical)
    allowed_keys_str = ", ".join(sorted(allowed_keys)[:80]) + " ... (and more)"

    # Get API key
    api_key = get_api_key()
    print(f"  API key: {api_key[:8]}...{api_key[-4:]}")

    # Determine which keys to process
    if args.key:
        keys_to_process = [args.key] if args.key in doc_links else []
        if not keys_to_process:
            print(f"ERROR: Key '{args.key}' not found in doc_links.json")
            sys.exit(1)
    else:
        keys_to_process = list(doc_links.keys())

    # Resume support
    already_done = set()
    if args.resume:
        already_done = load_checkpoint()
        print(f"  Resuming: {len(already_done)} already processed")

    # Match doc_links entries to scraped content
    to_process = []
    no_scraped = 0
    for key in keys_to_process:
        if key in already_done:
            continue
        entry = doc_links[key]
        slug = slug_from_url(entry.get("url", ""))
        if slug and slug in slug_index:
            to_process.append((key, entry, slug))
        else:
            no_scraped += 1

    if args.limit > 0:
        to_process = to_process[:args.limit]

    print(f"\n  To process: {len(to_process)} entries")
    print(f"  No scraped content: {no_scraped}")
    print(f"  Already done: {len(already_done)}")

    if not to_process:
        print("\nNothing to process!")
        return

    # Process
    processed = list(already_done)
    success = 0
    errors = 0
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"Extracting key steps via {MODEL}...")
    print(f"{'='*60}\n")

    for i, (key, entry, slug) in enumerate(to_process):
        doc_info = slug_index[slug]
        doc_text = doc_info["text"][:MAX_INPUT_CHARS]

        prompt = EXTRACTION_PROMPT.format(
            title=entry.get("label", key),
            doc_text=doc_text,
            allowed_keys=allowed_keys_str,
        )

        try:
            raw = call_gemini(prompt, api_key)
            result = parse_extraction(raw, allowed_keys)

            if result:
                if not args.dry_run:
                    doc_links[key]["keySteps"] = result["keySteps"]
                    doc_links[key]["seeAlso"] = result["seeAlso"]

                success += 1
                steps_preview = result["keySteps"][0][:60] if result["keySteps"] else "?"
                refs = len(result["seeAlso"])
                print(f"  ✅ [{i+1}/{len(to_process)}] {key}: "
                      f"{len(result['keySteps'])} steps, {refs} refs — \"{steps_preview}...\"")
            else:
                errors += 1
                print(f"  ⚠️  [{i+1}/{len(to_process)}] {key}: Failed to parse response")

            processed.append(key)

            # Checkpoint every 25
            if len(processed) % 25 == 0:
                save_checkpoint(processed)
                if not args.dry_run:
                    with open(DOC_LINKS, "w", encoding="utf-8") as f:
                        json.dump(doc_links, f, indent=2, ensure_ascii=False)
                    print(f"    💾 Checkpoint saved ({len(processed)} done)")

            time.sleep(REQUEST_DELAY)

        except Exception as e:
            errors += 1
            print(f"  ❌ [{i+1}/{len(to_process)}] {key}: {e}")
            if errors > 20:
                print("\n  Too many errors, stopping. Use --resume to continue.")
                break
            time.sleep(2)

    # Final save
    if not args.dry_run:
        with open(DOC_LINKS, "w", encoding="utf-8") as f:
            json.dump(doc_links, f, indent=2, ensure_ascii=False)
        save_checkpoint(processed)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Done! {success} extracted, {errors} errors in {elapsed:.0f}s")
    print(f"  Rate: {success/elapsed:.1f}/sec" if elapsed > 0 else "")
    if not args.dry_run:
        print(f"  Written to {DOC_LINKS}")
    else:
        print(f"  [DRY RUN] No files modified")

    # Cleanup checkpoint on full completion
    if errors == 0 and CHECKPOINT.exists() and not args.key:
        CHECKPOINT.unlink()
        print("  Checkpoint cleared (all done)")


if __name__ == "__main__":
    main()
