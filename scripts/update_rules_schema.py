"""Script to update match_rules.json with scoring schema."""

import json
from pathlib import Path


def main():
    """Update match_rules.json with rule_weight and negative_patterns."""
    # Load existing rules
    rules_path = Path(__file__).parent.parent / "ingestion" / "match_rules.json"

    with open(rules_path, encoding="utf-8") as f:
        data = json.load(f)

    # Update version
    data["version"] = "1.0.0"
    data["description"] = (
        "Deterministic matching rules with scoring for mapping text to tags. "
        "No embeddings or ML."
    )

    # Add schema fields to each rule
    for rule in data["rules"]:
        # Add rule_weight based on priority (high priority = high weight)
        priority = rule.get("priority", 50)
        if priority >= 100:
            rule["rule_weight"] = 0.95
        elif priority >= 80:
            rule["rule_weight"] = 0.85
        elif priority >= 60:
            rule["rule_weight"] = 0.75
        else:
            rule["rule_weight"] = 0.65

        # Add signal_type to patterns
        for pattern in rule.get("patterns", []):
            value = pattern.get("value", "")
            # Error codes and hex values are exact signatures
            if any(
                marker in value
                for marker in ["0x", "DXGI", "EXCEPTION", "LNK", "Error:"]
            ):
                pattern["signal_type"] = "exact_signature"
            elif pattern.get("type") == "regex":
                pattern["signal_type"] = "regex"
            else:
                pattern["signal_type"] = "contains"

        # Add empty negative_patterns array if not present
        if "negative_patterns" not in rule:
            rule["negative_patterns"] = []

    # Add specific negative patterns
    negative_patterns_map = {
        "exitcode_25": [
            {"type": "contains", "value": "ExitCode=0", "case_insensitive": True},
            {"type": "contains", "value": "BUILD SUCCESSFUL", "case_insensitive": True},
        ],
        "exitcode_6": [
            {"type": "contains", "value": "ExitCode=0", "case_insensitive": True},
        ],
        "d3d_device_lost": [
            {"type": "contains", "value": "fixed", "case_insensitive": True},
            {"type": "contains", "value": "resolved", "case_insensitive": True},
        ],
    }

    for rule in data["rules"]:
        rule_id = rule.get("rule_id")
        if rule_id in negative_patterns_map:
            rule["negative_patterns"] = negative_patterns_map[rule_id]

    # Save updated rules
    with open(rules_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("Updated match_rules.json with scoring schema")
    print(f"Total rules: {len(data['rules'])}")


if __name__ == "__main__":
    main()
