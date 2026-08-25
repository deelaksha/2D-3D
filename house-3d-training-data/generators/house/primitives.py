"""Shared box-mesh + transform/bounding-box/anchor helpers used by every
Phase 3 generator (wall/door/window/floor/ceiling).

Convention: a component's `Transform.position` is the world-space centroid
of its bounding box (not a corner). `box_mesh` builds a box centered at the
local origin with extents (width=X, depth=Y, height=Z) matching
`schemas.geometry.Dimensions`, and `apply_transform` rotates (Euler XYZ,
applied X then Y then Z, per Transform's docstring) then translates it into
place. Anchor points are computed the same way, in local space then mapped
through the same rotation+translation, so anchors always stay consistent
with the actual mesh -- never hand-estimated separately.
"""

from __future__ import annotations

import numpy as np
import trimesh

from schemas.geometry import Anchor, BoundingBox, Dimensions, Transform, Vec3


def box_mesh(dimensions: Dimensions) -> trimesh.Trimesh:
    return trimesh.creation.box(extents=[dimensions.width, dimensions.depth, dimensions.height])


def rotation_matrix(rotation: Vec3) -> np.ndarray:
    rx, ry, rz = np.radians([rotation.x, rotation.y, rotation.z])
    cx, sx = np.cos(rx), np.sin(rx)
    cy, sy = np.cos(ry), np.sin(ry)
    cz, sz = np.cos(rz), np.sin(rz)
    r_x = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    r_y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    r_z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return r_z @ r_y @ r_x


def transform_point(point: Vec3, transform: Transform) -> Vec3:
    r = rotation_matrix(transform.rotation)
    p = r @ np.array(point.as_tuple()) + np.array(transform.position.as_tuple())
    return Vec3(x=float(p[0]), y=float(p[1]), z=float(p[2]))


def apply_transform(mesh: trimesh.Trimesh, transform: Transform) -> trimesh.Trimesh:
    mesh = mesh.copy()
    matrix = np.eye(4)
    matrix[:3, :3] = rotation_matrix(transform.rotation)
    matrix[:3, 3] = transform.position.as_tuple()
    mesh.apply_transform(matrix)
    return mesh


def world_bounding_box(mesh: trimesh.Trimesh) -> BoundingBox:
    mn, mx = mesh.bounds
    return BoundingBox(
        min=Vec3(x=float(mn[0]), y=float(mn[1]), z=float(mn[2])),
        max=Vec3(x=float(mx[0]), y=float(mx[1]), z=float(mx[2])),
    )


def local_anchor_points(dimensions: Dimensions) -> dict[str, Vec3]:
    hw, hd, hh = dimensions.width / 2, dimensions.depth / 2, dimensions.height / 2
    return {
        "center": Vec3(x=0.0, y=0.0, z=0.0),
        "top": Vec3(x=0.0, y=0.0, z=hh),
        "bottom": Vec3(x=0.0, y=0.0, z=-hh),
        "left": Vec3(x=-hw, y=0.0, z=0.0),
        "right": Vec3(x=hw, y=0.0, z=0.0),
    }


def anchors_from_local(
    dimensions: Dimensions, transform: Transform, names: set[str]
) -> list[Anchor]:
    local = local_anchor_points(dimensions)
    return [
        Anchor(name=name, position=transform_point(local[name], transform))
        for name in names
        if name in local
    ]


def mesh_counts(mesh: trimesh.Trimesh) -> tuple[int, int]:
    return len(mesh.vertices), len(mesh.faces)


def opening_cutter_mesh(
    width: float, height: float, thickness: float, transform: Transform, pad: float = 0.05
) -> trimesh.Trimesh:
    """A box slightly deeper than `thickness` along the local depth axis, for
    boolean-cutting a clean through-opening out of a wall -- avoids leaving a
    razor-thin coplanar sliver exactly at the wall face (z-fighting)."""
    dims = Dimensions(width=width, height=height, depth=thickness + 2 * pad)
    return apply_transform(box_mesh(dims), transform)
