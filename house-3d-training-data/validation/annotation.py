"""Phase 6 -- annotation completeness checks (prompt.txt #46 annotation_quality).

Every component of a type with defined semantic anchors (prompt.txt #25)
must actually carry all of them, and every opening must be wired into the
scene graph via an explicit relationship (prompt.txt #24) -- coordinates
alone are not an acceptable substitute.
"""

from __future__ import annotations

from schemas.scene import Scene
from schemas.taxonomy import ANCHOR_NAMES


def check_annotation(scene: Scene) -> tuple[float, list[str]]:
    issues: list[str] = []
    checks = 0

    for comp in scene.components:
        expected = ANCHOR_NAMES.get(comp.type)
        if expected is None:
            continue
        checks += 1
        have = {a.name for a in comp.anchors}
        missing = expected - have
        if missing:
            issues.append(f"{comp.id}: missing anchors {sorted(missing)}")

    for comp in scene.components:
        if comp.type not in ("door", "window"):
            continue
        checks += 1
        if not any(r.subject == comp.id and r.predicate == "inserted_into" for r in scene.relationships):
            issues.append(f"{comp.id}: opening has no inserted_into relationship")

    if checks == 0:
        return 1.0, issues
    score = max(0.0, (checks - len(issues)) / checks)
    return score, issues
