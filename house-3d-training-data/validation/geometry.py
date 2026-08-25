"""Phase 6 -- mesh integrity checks (prompt.txt #46 geometry_quality).

A component's mesh must actually be the solid it claims to be: watertight
(no holes from a bad boolean cut) and enclosing positive volume (no
degenerate/inverted geometry). These are checked directly on the real mesh,
never estimated.
"""

from __future__ import annotations

import trimesh

from schemas.scene import Scene

MIN_VOLUME_M3 = 1e-6


def check_geometry(scene: Scene, meshes: dict[str, trimesh.Trimesh]) -> tuple[float, list[str]]:
    issues: list[str] = []
    total = len(scene.components)
    if total == 0:
        return 0.0, ["scene has no components"]

    failed = 0
    for comp in scene.components:
        mesh = meshes.get(comp.id)
        if mesh is None:
            issues.append(f"{comp.id}: no mesh found")
            failed += 1
            continue
        comp_issues = []
        if not mesh.is_watertight:
            comp_issues.append("mesh is not watertight")
        if mesh.volume <= MIN_VOLUME_M3:
            comp_issues.append(f"mesh volume too small ({mesh.volume:.6f} m^3)")
        if len(mesh.vertices) != comp.mesh.vertex_count or len(mesh.faces) != comp.mesh.face_count:
            comp_issues.append(
                f"mesh info mismatch (component says {comp.mesh.vertex_count}v/{comp.mesh.face_count}f, "
                f"actual mesh has {len(mesh.vertices)}v/{len(mesh.faces)}f)"
            )
        if comp_issues:
            failed += 1
            issues.append(f"{comp.id}: " + "; ".join(comp_issues))

    return (total - failed) / total, issues
