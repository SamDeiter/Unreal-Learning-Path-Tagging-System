"""Path Composer for atom-based learning path composition.

Composes learning paths from atomic steps using edge relationships.
Falls back to golden templates when atoms don't cover all requirements.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from .scored_matcher import ScoredTag

# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Verification:
    """How to verify a step was completed."""

    type: str  # "checklist", "test", "observe"
    items: list[str] = field(default_factory=list)


@dataclass
class Atom:
    """An atomic learning step."""

    atom_id: str
    step_type: str  # "foundation", "diagnostic", "remediation", "verification"
    title: str
    why: str  # Why this step is necessary
    evidence: list[str]  # Sources backing this step
    verification: Verification
    tags: list[str]  # Tags this atom is relevant for
    duration_minutes: int = 15
    prerequisites: list[str] = field(default_factory=list)  # Other atom_ids


@dataclass
class ComposedStep:
    """A step in a composed learning path."""

    step_number: int
    atom: Atom
    added_reason: str  # Why this step was added


@dataclass
class EdgeExpansion:
    """Record of an edge that was traversed."""

    source_tag: str
    target_tag: str
    relation: str
    weight: float


@dataclass
class ComposedPath:
    """A learning path composed from atoms."""

    path_id: str
    title: str
    tags: list[ScoredTag]
    steps: list[ComposedStep]
    edge_expansions: list[EdgeExpansion] = field(default_factory=list)
    fallback_template: str | None = None  # If we fell back to a template
    total_duration_minutes: int = 0

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        return {
            "path_id": self.path_id,
            "title": self.title,
            "tags": [
                {"tag_id": t.tag_id, "score": round(t.score, 4)}
                for t in self.tags
            ],
            "steps": [
                {
                    "step_number": s.step_number,
                    "atom_id": s.atom.atom_id,
                    "step_type": s.atom.step_type,
                    "title": s.atom.title,
                    "why": s.atom.why,
                    "evidence": s.atom.evidence,
                    "verification": {
                        "type": s.atom.verification.type,
                        "items": s.atom.verification.items,
                    },
                    "duration_minutes": s.atom.duration_minutes,
                    "added_reason": s.added_reason,
                }
                for s in self.steps
            ],
            "edge_expansions": [
                {
                    "source": e.source_tag,
                    "target": e.target_tag,
                    "relation": e.relation,
                    "weight": e.weight,
                }
                for e in self.edge_expansions
            ],
            "fallback_template": self.fallback_template,
            "total_duration_minutes": self.total_duration_minutes,
        }


# =============================================================================
# PATH COMPOSER
# =============================================================================

class PathComposer:
    """Composes learning paths from atoms using edge relationships.

    Follows the deterministic composition algorithm:
    1. Expand tags via prerequisite edges
    2. Find atoms that match expanded tags
    3. Order atoms by step_type and prerequisites
    4. Fall back to templates if atoms don't cover requirements
    """

    STEP_ORDER = ["foundation", "diagnostic", "remediation", "verification"]

    def __init__(
        self,
        atoms_dir: Path | None = None,
        edges_path: Path | None = None,
        templates_dir: Path | None = None,
    ):
        """Initialize with paths to atoms, edges, and templates.

        Args:
            atoms_dir: Path to steps/atoms/ directory
            edges_path: Path to edges.json
            templates_dir: Path to learning_paths/templates/ directory
        """
        base_dir = Path(__file__).parent.parent

        self.atoms_dir = atoms_dir or base_dir / "steps" / "atoms"
        self.edges_path = edges_path or base_dir / "tags" / "edges.json"
        self.templates_dir = templates_dir or base_dir / "learning_paths" / "templates"

        # Load edges
        self.edges = self._load_edges()

        # Load atoms
        self.atoms = self._load_atoms()

        # Load template index
        self.templates = self._load_template_index()

    def _load_edges(self) -> list[dict]:
        """Load edges from edges.json."""
        if self.edges_path.exists():
            with open(self.edges_path, encoding="utf-8") as f:
                data = json.load(f)
                return data.get("edges", [])
        return []

    def _load_atoms(self) -> dict[str, Atom]:
        """Load all atoms from atoms directory."""
        atoms = {}
        if self.atoms_dir.exists():
            for atom_file in self.atoms_dir.glob("*.json"):
                with open(atom_file, encoding="utf-8") as f:
                    data = json.load(f)
                    atom = Atom(
                        atom_id=data.get("atom_id", atom_file.stem),
                        step_type=data.get("step_type", "foundation"),
                        title=data.get("title", ""),
                        why=data.get("why", ""),
                        evidence=data.get("evidence", []),
                        verification=Verification(
                            type=data.get("verification", {}).get("type", "checklist"),
                            items=data.get("verification", {}).get("items", []),
                        ),
                        tags=data.get("tags", []),
                        duration_minutes=data.get("duration_minutes", 15),
                        prerequisites=data.get("prerequisites", []),
                    )
                    atoms[atom.atom_id] = atom
        return atoms

    def _load_template_index(self) -> dict[str, Path]:
        """Build index of templates by their required tags."""
        templates = {}
        if self.templates_dir.exists():
            for template_file in self.templates_dir.glob("*.json"):
                if template_file.name == "path_template.json":
                    continue  # Skip schema file
                templates[template_file.stem] = template_file
        return templates

    def compose_path(
        self,
        query: str,
        scored_tags: list[ScoredTag],
    ) -> ComposedPath:
        """Compose a learning path from scored tags.

        Args:
            query: Original user query
            scored_tags: Tags matched by ScoredMatcher

        Returns:
            ComposedPath with steps from atoms or template
        """
        # Step 1: Expand tags via edges
        expanded_tags, edge_expansions = self._expand_tags(scored_tags)

        # Step 2: Find matching atoms
        matching_atoms = self._find_matching_atoms(expanded_tags)

        # Step 3: Check if we have enough atoms
        step_types_covered = {a.step_type for a in matching_atoms}
        required_types = {"foundation", "diagnostic", "remediation", "verification"}

        # Step 4: If atoms don't cover all types, try fallback to template
        fallback_template = None
        if not required_types.issubset(step_types_covered):
            template_path = self._find_template(scored_tags)
            if template_path:
                return self._compose_from_template(
                    query, scored_tags, template_path, edge_expansions
                )
            # Continue with partial atoms if no template available

        # Step 5: Order atoms by step_type and prerequisites
        ordered_atoms = self._order_atoms(matching_atoms)

        # Step 6: Build composed path
        steps = []
        for i, atom in enumerate(ordered_atoms, 1):
            reason = self._determine_add_reason(atom, scored_tags, edge_expansions)
            steps.append(ComposedStep(
                step_number=i,
                atom=atom,
                added_reason=reason,
            ))

        # Generate path ID
        top_tag = scored_tags[0].tag_id if scored_tags else "unknown"
        path_id = f"lp.{top_tag}.composed"

        # Generate title
        title = self._generate_title(query, scored_tags)

        # Calculate total duration
        total_duration = sum(s.atom.duration_minutes for s in steps)

        return ComposedPath(
            path_id=path_id,
            title=title,
            tags=scored_tags,
            steps=steps,
            edge_expansions=edge_expansions,
            fallback_template=fallback_template,
            total_duration_minutes=total_duration,
        )

    def _expand_tags(
        self,
        scored_tags: list[ScoredTag],
    ) -> tuple[list[ScoredTag], list[EdgeExpansion]]:
        """Expand tags via prerequisite and symptom_of edges.

        Args:
            scored_tags: Initial matched tags

        Returns:
            Tuple of (expanded tags, edge expansions)
        """
        tag_ids = {t.tag_id for t in scored_tags}
        expanded = list(scored_tags)
        expansions = []

        for tag in scored_tags:
            for edge in self.edges:
                # If this tag is a symptom, add the root cause
                if edge.get("source") == tag.tag_id:
                    relation = edge.get("relation")
                    if relation in ("symptom_of", "often_caused_by", "subtopic"):
                        target = edge.get("target")
                        if target and target not in tag_ids:
                            # Create a synthetic ScoredTag for the expanded tag
                            weight = edge.get("weight", 0.5)
                            expanded_tag = ScoredTag(
                                tag_id=target,
                                display_name=target,  # Will be enriched later
                                score=tag.score * weight,
                                matched_rules=[],
                                trace=tag.trace,
                            )
                            expanded.append(expanded_tag)
                            tag_ids.add(target)

                            expansions.append(EdgeExpansion(
                                source_tag=tag.tag_id,
                                target_tag=target,
                                relation=relation,
                                weight=weight,
                            ))

        return expanded, expansions

    def _find_matching_atoms(self, tags: list[ScoredTag]) -> list[Atom]:
        """Find atoms that match any of the given tags.

        Args:
            tags: Tags to match against

        Returns:
            List of matching atoms
        """
        tag_ids = {t.tag_id for t in tags}
        matching = []

        for atom in self.atoms.values():
            # Check if any of the atom's tags match
            if any(t in tag_ids for t in atom.tags):
                matching.append(atom)

        return matching

    def _find_template(self, tags: list[ScoredTag]) -> Path | None:
        """Find a golden template that matches the tags.

        Args:
            tags: Scored tags to match

        Returns:
            Path to template file, or None
        """
        # Look for template that matches the top tag
        if not tags:
            return None

        top_tag = tags[0].tag_id
        # Try to find template like "lp.build.exitcode_25.v1"
        for template_id, template_path in self.templates.items():
            if top_tag.replace(".", "_") in template_id or top_tag in template_id:
                return template_path

        return None

    def _compose_from_template(
        self,
        query: str,
        tags: list[ScoredTag],
        template_path: Path,
        edge_expansions: list[EdgeExpansion],
    ) -> ComposedPath:
        """Compose a path from a golden template.

        Args:
            query: Original query
            tags: Matched tags
            template_path: Path to template JSON
            edge_expansions: Edge expansions that were made

        Returns:
            ComposedPath based on template
        """
        with open(template_path, encoding="utf-8") as f:
            template = json.load(f)

        # Convert template steps to ComposedSteps
        steps = []
        for step_data in template.get("steps", []):
            # Create a synthetic atom from template step
            atom = Atom(
                atom_id=f"template_{step_data.get('step_id', 0)}",
                step_type=step_data.get("step_type", "foundation"),
                title=step_data.get("title", ""),
                why=step_data.get("description", ""),
                evidence=["Golden template"],
                verification=Verification(
                    type="checklist",
                    items=step_data.get("actions", [])
                    or [step_data.get("checkpoint", {}).get("expected_action", "")],
                ),
                tags=step_data.get("tags_referenced", []),
                duration_minutes=self._parse_duration(step_data.get("duration", "15")),
            )
            steps.append(ComposedStep(
                step_number=step_data.get("step_id", len(steps) + 1),
                atom=atom,
                added_reason="From golden template",
            ))

        total_duration = sum(s.atom.duration_minutes for s in steps)

        return ComposedPath(
            path_id=template.get("template_id", "unknown"),
            title=template.get("display_name", "Learning Path"),
            tags=tags,
            steps=steps,
            edge_expansions=edge_expansions,
            fallback_template=template_path.name,
            total_duration_minutes=total_duration,
        )

    def _parse_duration(self, duration_str: str) -> int:
        """Parse duration string like '15-20 min' to int."""
        import re
        match = re.search(r"(\d+)", duration_str)
        if match:
            return int(match.group(1))
        return 15

    def _order_atoms(self, atoms: list[Atom]) -> list[Atom]:
        """Order atoms by step_type and prerequisites.

        Args:
            atoms: Unordered atoms

        Returns:
            Ordered atoms
        """
        # First, sort by step_type order
        def step_order(atom: Atom) -> int:
            try:
                return self.STEP_ORDER.index(atom.step_type)
            except ValueError:
                return 999

        sorted_by_type = sorted(atoms, key=step_order)

        # TODO: Topological sort by prerequisites
        # For now, just return sorted by type
        return sorted_by_type

    def _determine_add_reason(
        self,
        atom: Atom,
        tags: list[ScoredTag],
        expansions: list[EdgeExpansion],
    ) -> str:
        """Determine why an atom was added to the path.

        Args:
            atom: The atom being added
            tags: Original matched tags
            expansions: Edge expansions

        Returns:
            Human-readable reason
        """
        # Check if atom matches an original tag
        original_tag_ids = {t.tag_id for t in tags}
        for atom_tag in atom.tags:
            if atom_tag in original_tag_ids:
                return f"Matches query tag: {atom_tag}"

        # Check if added via edge expansion
        for exp in expansions:
            if exp.target_tag in atom.tags:
                return f"Added via {exp.relation} edge from {exp.source_tag}"

        return "Matches path requirements"

    def _generate_title(self, query: str, tags: list[ScoredTag]) -> str:
        """Generate a title for the composed path.

        Args:
            query: Original query
            tags: Matched tags

        Returns:
            Human-readable title
        """
        if tags:
            top_tag = tags[0]
            return f"Learning Path: {top_tag.display_name}"
        return "Learning Path"


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    """CLI for testing path composer."""
    import sys

    from .scored_matcher import ScoredMatcher

    if len(sys.argv) < 2:
        print("Usage: python path_composer.py <query>")
        sys.exit(1)

    query = " ".join(sys.argv[1:])

    # First, get scored tags
    matcher = ScoredMatcher()
    tags = matcher.match_query(query)

    if not tags:
        print(f"No tags matched for query: {query}")
        sys.exit(1)

    # Compose path
    composer = PathComposer()
    path = composer.compose_path(query, tags)

    print("\n=== Composed Path ===\n")
    print(f"ID: {path.path_id}")
    print(f"Title: {path.title}")
    print(f"Duration: {path.total_duration_minutes} minutes")
    print(f"\nTags ({len(path.tags)}):")
    for tag in path.tags:
        print(f"  - {tag.tag_id}: {tag.score:.3f}")

    print(f"\nEdge Expansions ({len(path.edge_expansions)}):")
    for exp in path.edge_expansions:
        print(f"  - {exp.source_tag} --{exp.relation}--> {exp.target_tag}")

    print(f"\nSteps ({len(path.steps)}):")
    for step in path.steps:
        print(f"  {step.step_number}. [{step.atom.step_type}] {step.atom.title}")
        print(f"     Why: {step.atom.why}")
        print(f"     Added: {step.added_reason}")

    if path.fallback_template:
        print(f"\n(Used fallback template: {path.fallback_template})")


if __name__ == "__main__":
    main()
