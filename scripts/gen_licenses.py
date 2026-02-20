"""Generate THIRD_PARTY_NOTICES.md from license-checker JSON output."""
import json
import os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_licenses(path):
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)

def parse_package(pkg_key):
    """Parse 'name@version' or '@scope/name@version'."""
    if pkg_key.startswith("@"):
        # Scoped package: @scope/name@version
        rest = pkg_key[1:]  # remove leading @
        parts = rest.split("@")
        name = "@" + parts[0]
        version = parts[1] if len(parts) > 1 else ""
    else:
        parts = pkg_key.rsplit("@", 1)
        name = parts[0]
        version = parts[1] if len(parts) > 1 else ""
    return name, version

def main():
    frontend = load_licenses(os.path.join(ROOT, "licenses_frontend.json"))
    backend = load_licenses(os.path.join(ROOT, "licenses_backend.json"))

    packages = {}

    for label, data in [("Frontend", frontend), ("Backend", backend)]:
        for pkg_key, info in data.items():
            name, version = parse_package(pkg_key)
            lic = info.get("licenses", "Unknown")
            repo = info.get("repository", "")
            publisher = info.get("publisher", "")

            if name in packages:
                packages[name]["components"].add(label)
                if version > packages[name]["version"]:
                    packages[name]["version"] = version
            else:
                packages[name] = {
                    "version": version,
                    "license": lic,
                    "repo": repo,
                    "publisher": publisher,
                    "components": {label},
                }

    # Group by license type
    by_license = {}
    for name, info in sorted(packages.items()):
        lic = info["license"]
        if lic not in by_license:
            by_license[lic] = []
        by_license[lic].append((name, info))

    # Generate markdown
    lines = []
    lines.append("# Third-Party Software Notices and Licenses")
    lines.append("")
    lines.append("This document lists all open-source software packages used in the")
    lines.append("**Unreal Learning Path Tagging System** project.")
    lines.append("")
    lines.append(f"_Generated on {datetime.now().strftime('%Y-%m-%d')}_")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Summary table
    lines.append("## License Summary")
    lines.append("")
    lines.append("| License | Package Count |")
    lines.append("|---------|--------------|")
    for lic in sorted(by_license.keys(), key=lambda x: -len(by_license[x])):
        lines.append(f"| {lic} | {len(by_license[lic])} |")
    lines.append(f"| **Total** | **{len(packages)}** |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Detailed listing by license
    for lic in sorted(by_license.keys(), key=lambda x: -len(by_license[x])):
        lines.append(f"## {lic}")
        lines.append("")
        lines.append("| Package | Version | Component | Repository |")
        lines.append("|---------|---------|-----------|------------|")
        for name, info in by_license[lic]:
            comps = ", ".join(sorted(info["components"]))
            repo = info["repo"] or ""
            if repo and not repo.startswith("http"):
                repo = "https://github.com/" + repo if "/" in repo else repo
            repo_link = f"[Link]({repo})" if repo else ""
            lines.append(f"| {name} | {info['version']} | {comps} | {repo_link} |")
        lines.append("")

    # Legal notice
    lines.append("---")
    lines.append("")
    lines.append("## Notice")
    lines.append("")
    lines.append("This software incorporates components from the open-source projects listed above.")
    lines.append("Each project is licensed under its respective license terms. The full text of")
    lines.append("each license can be found in the respective project's repository or in the")
    lines.append("`node_modules/<package>/LICENSE` file within this project.")
    lines.append("")
    lines.append("This document is provided for informational purposes and to comply with the")
    lines.append("attribution requirements of the open-source licenses used by this project.")
    lines.append("")

    out_path = os.path.join(ROOT, "THIRD_PARTY_NOTICES.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Generated {out_path}")
    print(f"Total packages: {len(packages)}")
    print(f"License types: {len(by_license)}")

if __name__ == "__main__":
    main()
