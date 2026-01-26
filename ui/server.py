"""Simple HTTP Backend Server for Learning Path API.

Serves the web UI and provides API endpoints for generating learning paths.
Uses Python's built-in http.server - no external dependencies required.
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.path_generator import PathGenerator
from ingestion.synonym_search import SynonymSearch


class LearningPathHandler(SimpleHTTPRequestHandler):
    """HTTP handler with API endpoints for learning paths."""

    def __init__(self, *args, **kwargs):
        # Set the directory to serve static files from
        self.static_dir = Path(__file__).parent
        super().__init__(*args, directory=str(self.static_dir), **kwargs)

    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)

        # API endpoints
        if parsed.path == "/api/generate":
            self.handle_generate(parsed.query)
        elif parsed.path == "/api/search":
            self.handle_search(parsed.query)
        elif parsed.path == "/api/tags":
            self.handle_tags()
        else:
            # Serve static files
            super().do_GET()

    def handle_generate(self, query_string):
        """Generate a learning path from a query."""
        params = parse_qs(query_string)
        query = params.get("q", [""])[0]

        if not query:
            self.send_error(400, "Missing query parameter 'q'")
            return

        try:
            generator = PathGenerator()
            path = generator.generate_path(query)

            # Convert to dict
            path_dict = {
                "path_id": path.path_id,
                "title": path.title,
                "query": path.query,
                "tags": path.tags,
                "steps": [
                    {
                        "number": s.step_number,
                        "type": s.step_type,
                        "title": s.title,
                        "description": s.description,
                        "content": [
                            {
                                "type": c.source_type,
                                "title": c.title,
                                "url": c.url,
                            }
                            for c in s.content
                        ],
                    }
                    for s in path.steps
                ],
            }

            self.send_json(path_dict)

        except Exception as e:
            self.send_error(500, str(e))

    def handle_search(self, query_string):
        """Search for matching tags."""
        params = parse_qs(query_string)
        query = params.get("q", [""])[0]

        if not query:
            self.send_error(400, "Missing query parameter 'q'")
            return

        try:
            searcher = SynonymSearch()
            results = searcher.search(query)

            results_dict = [
                {
                    "tag_id": r.matched_tag_id,
                    "display_name": r.display_name,
                    "match_type": r.match_type,
                    "confidence": r.confidence,
                }
                for r in results[:10]
            ]

            self.send_json({"results": results_dict})

        except Exception as e:
            self.send_error(500, str(e))

    def handle_tags(self):
        """Return all available tags."""
        try:
            tags_file = Path(__file__).parent.parent / "tags" / "tags.json"
            with open(tags_file) as f:
                data = json.load(f)

            # Simplify for API
            tags = [
                {
                    "tag_id": t["tag_id"],
                    "display_name": t.get("display_name", t["tag_id"]),
                    "category": t.get("category_path", [])[-1] if t.get("category_path") else "",
                }
                for t in data.get("tags", [])
            ]

            self.send_json({"tags": tags})

        except Exception as e:
            self.send_error(500, str(e))

    def send_json(self, data):
        """Send JSON response with CORS headers."""
        response = json.dumps(data, indent=2)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(response))
        self.end_headers()
        self.wfile.write(response.encode())

    def log_message(self, format, *args):
        """Custom logging format."""
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    """Start the server."""
    port = int(os.environ.get("PORT", 8080))

    print("=" * 50)
    print("🎮 UE5 Learning Path Server")
    print("=" * 50)
    print(f"")
    print(f"  Web UI:  http://localhost:{port}")
    print(f"")
    print(f"  API Endpoints:")
    print(f"    GET /api/generate?q=<query>  - Generate learning path")
    print(f"    GET /api/search?q=<term>     - Search tags")
    print(f"    GET /api/tags                - List all tags")
    print(f"")
    print("=" * 50)
    print("Press Ctrl+C to stop")
    print("")

    server = HTTPServer(("", port), LearningPathHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        server.shutdown()


if __name__ == "__main__":
    main()
