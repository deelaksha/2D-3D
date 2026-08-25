"""prompt.txt #6 -- ceiling slab as its own `ceiling` component (no subtype)."""

from __future__ import annotations

import trimesh

from generators.house.primitives import (
    anchors_from_local,
    apply_transform,
    box_mesh,
    mesh_counts,
    world_bounding_box,
)
from schemas.component import Component, MeshInfo
from schemas.geometry import Dimensions, Transform, Vec3
from schemas.material import Material

_ANCHORS = {"center"}


def make_ceiling(
    id: str,
    width: float,
    depth: float,
    thickness: float = 0.15,
    position: tuple[float, float, float] = (0.0, 0.0, 0.0),
    material: Material | None = None,
) -> tuple[trimesh.Trimesh, Component]:
    dimensions = Dimensions(width=width, height=thickness, depth=depth)
    transform = Transform(position=Vec3.from_tuple(position))
    mesh = apply_transform(box_mesh(dimensions), transform)
    vertex_count, face_count = mesh_counts(mesh)

    component = Component(
        id=id,
        type="ceiling",
        dimensions=dimensions,
        transform=transform,
        bounding_box=world_bounding_box(mesh),
        material=material,
        anchors=anchors_from_local(dimensions, transform, _ANCHORS),
        mesh=MeshInfo(vertex_count=vertex_count, face_count=face_count, formats=["obj", "glb"]),
    )
    return mesh, component
