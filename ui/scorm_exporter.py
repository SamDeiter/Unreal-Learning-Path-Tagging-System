"""SCORM 1.2 Exporter for Learning Paths.

Generates SCORM 1.2 compliant packages that can be uploaded to any LMS.
Includes HTML player, JavaScript API wrapper, and manifest.
"""

import json
import os
import shutil
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET


@dataclass
class SCORMConfig:
    """SCORM package configuration."""

    course_id: str
    course_title: str
    organization: str = "Unreal Learning Paths"
    version: str = "1.0"
    mastery_score: int = 80


class SCORMExporter:
    """Exports learning paths to SCORM 1.2 packages."""

    def __init__(self, output_dir: Path):
        """Initialize exporter.

        Args:
            output_dir: Directory for output SCORM packages.
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export(
        self,
        learning_path: dict,
        config: Optional[SCORMConfig] = None,
    ) -> Path:
        """Export a learning path to SCORM 1.2 package.

        Args:
            learning_path: Learning path JSON data.
            config: SCORM configuration.

        Returns:
            Path to the generated .zip package.
        """
        if config is None:
            config = SCORMConfig(
                course_id=learning_path.get("path_id", "course"),
                course_title=learning_path.get("title", "Learning Path"),
            )

        # Create temp directory for package contents
        package_dir = self.output_dir / f"temp_{config.course_id}"
        package_dir.mkdir(exist_ok=True)

        try:
            # Generate package components
            self._create_manifest(package_dir, learning_path, config)
            self._create_html_player(package_dir, learning_path)
            self._create_scorm_api(package_dir)
            self._create_styles(package_dir)

            # Create ZIP package
            zip_path = self.output_dir / f"{config.course_id}.zip"
            self._create_zip(package_dir, zip_path)

            return zip_path

        finally:
            # Cleanup temp directory
            shutil.rmtree(package_dir, ignore_errors=True)

    def _create_manifest(
        self,
        package_dir: Path,
        learning_path: dict,
        config: SCORMConfig,
    ):
        """Create imsmanifest.xml for SCORM 1.2."""
        # Build XML structure
        manifest = ET.Element("manifest")
        manifest.set("identifier", config.course_id)
        manifest.set("version", config.version)
        manifest.set("xmlns", "http://www.imsproject.org/xsd/imscp_rootv1p1p2")
        manifest.set("xmlns:adlcp", "http://www.adlnet.org/xsd/adlcp_rootv1p2")

        # Metadata
        metadata = ET.SubElement(manifest, "metadata")
        schema = ET.SubElement(metadata, "schema")
        schema.text = "ADL SCORM"
        schemaversion = ET.SubElement(metadata, "schemaversion")
        schemaversion.text = "1.2"

        # Organizations
        organizations = ET.SubElement(manifest, "organizations")
        organizations.set("default", "org1")

        org = ET.SubElement(organizations, "organization")
        org.set("identifier", "org1")
        title = ET.SubElement(org, "title")
        title.text = config.course_title

        # Create items for each step
        for step in learning_path.get("steps", []):
            item = ET.SubElement(org, "item")
            item.set("identifier", f"item_{step['step_number']}")
            item.set("identifierref", f"res_{step['step_number']}")

            item_title = ET.SubElement(item, "title")
            item_title.text = f"Step {step['step_number']}: {step['title']}"

            # Mastery score
            mastery = ET.SubElement(item, "adlcp:masteryscore")
            mastery.text = str(config.mastery_score)

        # Resources
        resources = ET.SubElement(manifest, "resources")

        # Main resource
        resource = ET.SubElement(resources, "resource")
        resource.set("identifier", "res_main")
        resource.set("type", "webcontent")
        resource.set("adlcp:scormtype", "sco")
        resource.set("href", "index.html")

        file_elem = ET.SubElement(resource, "file")
        file_elem.set("href", "index.html")

        # Step resources
        for step in learning_path.get("steps", []):
            res = ET.SubElement(resources, "resource")
            res.set("identifier", f"res_{step['step_number']}")
            res.set("type", "webcontent")
            res.set("adlcp:scormtype", "sco")
            res.set("href", f"step_{step['step_number']}.html")

        # Write manifest
        tree = ET.ElementTree(manifest)
        ET.indent(tree, space="  ")
        tree.write(
            package_dir / "imsmanifest.xml",
            encoding="utf-8",
            xml_declaration=True,
        )

    def _create_html_player(self, package_dir: Path, learning_path: dict):
        """Create HTML player with learning path content."""
        # Main index page
        index_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{learning_path.get('title', 'Learning Path')}</title>
    <link rel="stylesheet" href="styles.css">
    <script src="scorm_api.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1>{learning_path.get('title', 'Learning Path')}</h1>
            <p class="query">Query: {learning_path.get('query', '')}</p>
            <div class="tags">
                {''.join(f'<span class="tag">{t}</span>' for t in learning_path.get('tags', []))}
            </div>
        </header>

        <nav class="steps-nav">
            <h2>Learning Steps</h2>
            <ul>
"""
        for step in learning_path.get("steps", []):
            index_html += f"""                <li>
                    <a href="step_{step['step_number']}.html" class="step-link" data-step="{step['step_number']}">
                        <span class="step-type {step['step_type']}">{step['step_type'].upper()}</span>
                        <span class="step-title">{step['title']}</span>
                        <span class="step-status" id="status-{step['step_number']}">○</span>
                    </a>
                </li>
"""

        index_html += """            </ul>
        </nav>

        <main id="content">
            <p>Select a step from the menu to begin your learning journey.</p>
        </main>

        <footer>
            <div class="progress">
                <span id="progress-text">Progress: 0%</span>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
            </div>
        </footer>
    </div>

    <script>
        // Initialize SCORM
        window.onload = function() {
            SCORM.init();
        };
        window.onunload = function() {
            SCORM.finish();
        };
    </script>
</body>
</html>
"""

        (package_dir / "index.html").write_text(index_html, encoding="utf-8")

        # Create individual step pages
        for step in learning_path.get("steps", []):
            self._create_step_page(package_dir, step, learning_path)

    def _create_step_page(self, package_dir: Path, step: dict, learning_path: dict):
        """Create HTML page for a single step."""
        step_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Step {step['step_number']}: {step['title']}</title>
    <link rel="stylesheet" href="styles.css">
    <script src="scorm_api.js"></script>
</head>
<body>
    <div class="container">
        <header class="step-header">
            <a href="index.html" class="back-link">← Back to Overview</a>
            <span class="step-type {step['step_type']}">{step['step_type'].upper()}</span>
            <h1>Step {step['step_number']}: {step['title']}</h1>
            <p>{step.get('description', '')}</p>
        </header>

        <main class="step-content">
            <h2>Learning Resources</h2>
            <div class="content-list">
"""

        for content in step.get("content", []):
            step_html += f"""                <article class="content-item">
                    <div class="content-type">{content.get('source_type', 'video').upper()}</div>
                    <h3>{content.get('title', 'Untitled')}</h3>
                    <a href="{content.get('url', '#')}" target="_blank" class="content-link">
                        Open Resource ↗
                    </a>
                    <div class="content-tags">
                        {''.join(f'<span class="tag small">{t}</span>' for t in content.get('matched_tags', []))}
                    </div>
                </article>
"""

        step_html += f"""            </div>

            <div class="completion-section">
                <h2>Mark as Complete</h2>
                <p>Once you've reviewed the resources above, mark this step complete.</p>
                <button onclick="completeStep({step['step_number']})" class="complete-btn" id="complete-btn">
                    ✓ Mark Step Complete
                </button>
            </div>
        </main>

        <nav class="step-nav">
"""

        # Previous/Next navigation
        step_num = step["step_number"]
        total_steps = len(learning_path.get("steps", []))

        if step_num > 1:
            step_html += f'            <a href="step_{step_num - 1}.html" class="nav-link prev">← Previous Step</a>\n'
        else:
            step_html += '            <span class="nav-link disabled">← Previous Step</span>\n'

        if step_num < total_steps:
            step_html += f'            <a href="step_{step_num + 1}.html" class="nav-link next">Next Step →</a>\n'
        else:
            step_html += '            <a href="index.html" class="nav-link next">Complete Course →</a>\n'

        step_html += """        </nav>
    </div>

    <script>
        window.onload = function() {
            SCORM.init();
            checkStepStatus();
        };
        window.onunload = function() {
            SCORM.finish();
        };

        function checkStepStatus() {
            const completed = SCORM.getStepComplete(""" + str(step["step_number"]) + """);
            if (completed) {
                document.getElementById('complete-btn').textContent = '✓ Completed';
                document.getElementById('complete-btn').disabled = true;
            }
        }

        function completeStep(stepNum) {
            SCORM.setStepComplete(stepNum);
            document.getElementById('complete-btn').textContent = '✓ Completed';
            document.getElementById('complete-btn').disabled = true;
        }
    </script>
</body>
</html>
"""

        (package_dir / f"step_{step['step_number']}.html").write_text(
            step_html, encoding="utf-8"
        )

    def _create_scorm_api(self, package_dir: Path):
        """Create SCORM 1.2 JavaScript API wrapper."""
        api_js = """// SCORM 1.2 API Wrapper
var SCORM = {
    api: null,
    initialized: false,

    // Find LMS API
    findAPI: function(win) {
        var tries = 0;
        while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
            tries++;
            if (tries > 7) return null;
            win = win.parent;
        }
        return win.API;
    },

    getAPI: function() {
        if (this.api == null) {
            this.api = this.findAPI(window);
            if ((this.api == null) && (window.opener != null)) {
                this.api = this.findAPI(window.opener);
            }
        }
        return this.api;
    },

    init: function() {
        var api = this.getAPI();
        if (api != null) {
            var result = api.LMSInitialize("");
            if (result == "true" || result == true) {
                this.initialized = true;
                // Set initial status
                api.LMSSetValue("cmi.core.lesson_status", "incomplete");
                return true;
            }
        }
        console.log("SCORM: Running in standalone mode (no LMS detected)");
        this.initialized = true; // Allow standalone testing
        return false;
    },

    finish: function() {
        if (this.initialized) {
            var api = this.getAPI();
            if (api != null) {
                api.LMSCommit("");
                api.LMSFinish("");
            }
        }
    },

    setStepComplete: function(stepNum) {
        var api = this.getAPI();
        var completed = this.getCompletedSteps();
        if (!completed.includes(stepNum)) {
            completed.push(stepNum);
        }

        // Store in suspend_data
        if (api != null) {
            api.LMSSetValue("cmi.suspend_data", JSON.stringify({completed: completed}));
            api.LMSCommit("");

            // Update score based on completion
            var totalSteps = document.querySelectorAll('.step-link').length || 4;
            var score = Math.round((completed.length / totalSteps) * 100);
            api.LMSSetValue("cmi.core.score.raw", score.toString());

            // Set completed if all steps done
            if (completed.length >= totalSteps) {
                api.LMSSetValue("cmi.core.lesson_status", "completed");
            }
        }

        // Local storage fallback
        localStorage.setItem('scorm_completed', JSON.stringify(completed));

        this.updateProgress(completed.length);
    },

    getStepComplete: function(stepNum) {
        return this.getCompletedSteps().includes(stepNum);
    },

    getCompletedSteps: function() {
        var api = this.getAPI();
        var data = null;

        if (api != null) {
            var suspendData = api.LMSGetValue("cmi.suspend_data");
            if (suspendData) {
                try {
                    data = JSON.parse(suspendData);
                } catch(e) {}
            }
        }

        // Fallback to localStorage
        if (!data) {
            var local = localStorage.getItem('scorm_completed');
            if (local) {
                try {
                    return JSON.parse(local);
                } catch(e) {}
            }
        }

        return data ? (data.completed || []) : [];
    },

    updateProgress: function(completedCount) {
        var totalSteps = document.querySelectorAll('.step-link').length || 4;
        var percent = Math.round((completedCount / totalSteps) * 100);

        var progressText = document.getElementById('progress-text');
        var progressFill = document.getElementById('progress-fill');

        if (progressText) progressText.textContent = 'Progress: ' + percent + '%';
        if (progressFill) progressFill.style.width = percent + '%';
    }
};
"""
        (package_dir / "scorm_api.js").write_text(api_js, encoding="utf-8")

    def _create_styles(self, package_dir: Path):
        """Create CSS styles for the player."""
        styles = """/* Learning Path SCORM Player Styles */
:root {
    --primary: #0ea5e9;
    --primary-dark: #0284c7;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
    --bg: #0f172a;
    --bg-card: #1e293b;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --border: #334155;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
}

.container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
}

header {
    margin-bottom: 2rem;
}

h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.query {
    color: var(--text-muted);
    font-style: italic;
}

.tags {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.tag {
    background: var(--primary);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
}

.tag.small {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
}

/* Navigation */
.steps-nav {
    background: var(--bg-card);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
}

.steps-nav h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
}

.steps-nav ul {
    list-style: none;
}

.steps-nav li {
    margin-bottom: 0.5rem;
}

.step-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg);
    border-radius: 0.5rem;
    text-decoration: none;
    color: var(--text);
    transition: background 0.2s;
}

.step-link:hover {
    background: var(--border);
}

.step-type {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.step-type.foundations { background: var(--primary); }
.step-type.diagnostics { background: var(--warning); }
.step-type.resolution { background: var(--success); }
.step-type.prevention { background: #8b5cf6; }

.step-title {
    flex: 1;
}

.step-status {
    font-size: 1.5rem;
}

/* Step Content */
.step-header {
    margin-bottom: 2rem;
}

.back-link {
    color: var(--primary);
    text-decoration: none;
    margin-bottom: 1rem;
    display: inline-block;
}

.content-list {
    display: grid;
    gap: 1rem;
}

.content-item {
    background: var(--bg-card);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border-left: 4px solid var(--primary);
}

.content-type {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
}

.content-item h3 {
    margin-bottom: 0.5rem;
}

.content-link {
    color: var(--primary);
    text-decoration: none;
}

.content-link:hover {
    text-decoration: underline;
}

.content-tags {
    margin-top: 1rem;
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
}

/* Completion */
.completion-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--bg-card);
    border-radius: 0.5rem;
    text-align: center;
}

.complete-btn {
    margin-top: 1rem;
    padding: 0.75rem 2rem;
    background: var(--success);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.complete-btn:hover:not(:disabled) {
    background: #16a34a;
}

.complete-btn:disabled {
    opacity: 0.7;
    cursor: default;
}

/* Navigation */
.step-nav {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
}

.nav-link {
    color: var(--primary);
    text-decoration: none;
}

.nav-link.disabled {
    color: var(--text-muted);
}

/* Progress */
footer {
    margin-top: 2rem;
}

.progress {
    text-align: center;
}

.progress-bar {
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin-top: 0.5rem;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--success));
    width: 0%;
    transition: width 0.3s;
}
"""
        (package_dir / "styles.css").write_text(styles, encoding="utf-8")

    def _create_zip(self, source_dir: Path, output_path: Path):
        """Create ZIP archive of package contents."""
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file in source_dir.rglob("*"):
                if file.is_file():
                    arcname = file.relative_to(source_dir)
                    zipf.write(file, arcname)


def main():
    """CLI for SCORM export."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m ui.scorm_exporter <path_to_learning_path.json>")
        print("  or:  python -m ui.scorm_exporter --generate <query>")
        return

    from pathlib import Path

    output_dir = Path("scorm_output")
    exporter = SCORMExporter(output_dir)

    if sys.argv[1] == "--generate":
        # Generate path first, then export
        query = " ".join(sys.argv[2:])
        print(f"🔍 Generating path for: '{query}'")

        from ingestion.path_generator import PathGenerator

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
                    "step_number": s.step_number,
                    "step_type": s.step_type,
                    "title": s.title,
                    "description": s.description,
                    "content": [
                        {
                            "title": c.title,
                            "source_type": c.source_type,
                            "url": c.url,
                            "matched_tags": c.matched_tags,
                        }
                        for c in s.content
                    ],
                }
                for s in path.steps
            ],
        }

        zip_path = exporter.export(path_dict)
        print(f"✅ SCORM package created: {zip_path}")

    else:
        # Load existing path
        path_file = Path(sys.argv[1])
        with open(path_file) as f:
            learning_path = json.load(f)

        zip_path = exporter.export(learning_path)
        print(f"✅ SCORM package created: {zip_path}")


if __name__ == "__main__":
    main()
