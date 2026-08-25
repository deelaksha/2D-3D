"""Phase 6 -- physical plausibility checks (prompt.txt #46 physical_validity).

Generic over any Scene: does not assume a specific room layout, only the
explicit relationships (prompt.txt #24) and real-world size ranges for
openings and walls. Every generator is expected to already satisfy these --
this exists to catch regressions, not to encode generator-specific logic.
"""

from __future__ import annotations

from schemas.scene import Scene

EPS = 1e-6

WALL_THICKNESS_RANGE = (0.05, 0.6)
DOOR_WIDTH_RANGE = (0.5, 1.6)
DOOR_HEIGHT_RANGE = (1.6, 2.6)
WINDOW_WIDTH_RANGE = (0.2, 3.2)
WINDOW_HEIGHT_RANGE = (0.2, 2.6)


def _in_range(value: float, bounds: tuple[float, float]) -> bool:
    lo, hi = bounds
    return lo - EPS <= value <= hi + EPS


def _opening_fits_wall(scene: Scene, opening_id: str, wall_id: str) -> str | None:
    opening = scene.component(opening_id)
    wall = scene.component(wall_id)
    ob, wb = opening.bounding_box, wall.bounding_box
    if not (
        wb.min.x - EPS <= ob.min.x and ob.max.x <= wb.max.x + EPS
        and wb.min.y - EPS <= ob.min.y and ob.max.y <= wb.max.y + EPS
        and wb.min.z - EPS <= ob.min.z and ob.max.z <= wb.max.z + EPS
    ):
        return f"{opening_id}: opening bounding box is not contained within host wall {wall_id!r}"
    return None


def check_physical(scene: Scene) -> tuple[float, list[str]]:
    issues: list[str] = []
    checks = 0

    inserted = {r.subject: r.object for r in scene.relationships if r.predicate == "inserted_into"}

    for comp in scene.components:
        if comp.type not in ("door", "window"):
            continue
        checks += 1
        host_wall_id = inserted.get(comp.id)
        if host_wall_id is None:
            issues.append(f"{comp.id}: opening has no inserted_into relationship")
            continue
        if scene.component(host_wall_id).type != "wall":
            issues.append(f"{comp.id}: inserted_into target {host_wall_id!r} is not a wall")
            continue

        fit_issue = _opening_fits_wall(scene, comp.id, host_wall_id)
        if fit_issue is not None:
            issues.append(fit_issue)
            continue

        width, height = comp.dimensions.width, comp.dimensions.height
        w_range, h_range = (
            (DOOR_WIDTH_RANGE, DOOR_HEIGHT_RANGE) if comp.type == "door" else (WINDOW_WIDTH_RANGE, WINDOW_HEIGHT_RANGE)
        )
        if not (_in_range(width, w_range) and _in_range(height, h_range)):
            issues.append(f"{comp.id}: implausible {comp.type} size {width:.2f}m x {height:.2f}m")

    for comp in scene.components:
        if comp.type != "wall":
            continue
        checks += 1
        thickness = comp.dimensions.depth
        if not _in_range(thickness, WALL_THICKNESS_RANGE):
            issues.append(f"{comp.id}: implausible wall thickness {thickness:.2f}m")

    if checks == 0:
        return 1.0, issues

    failed = len(issues)
    score = max(0.0, (checks - failed) / checks)
    return score, issues
