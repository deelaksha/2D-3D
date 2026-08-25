"""prompt.txt #4/#5 -- walls are `wall` + subtype (never a generic box with a
material-based label). `position` is the world-space center of the wall
volume; `rotation_z` is yaw around the vertical (Z) axis, which is all a
wall needs (walls don't tilt or roll)."""

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
from schemas.taxonomy import WALL_SUBTYPES

_ANCHORS = {"top", "bottom", "left", "right", "center"}


def make_wall(
    id: str,
    width: float,
    height: float,
    thickness: float,
    position: tuple[float, float, float],
    rotation_z: float = 0.0,
    subtype: str = "external_wall",
    material: Material | None = None,
) -> tuple[trimesh.Trimesh, Component]:
    if subtype not in WALL_SUBTYPES:
        raise ValueError(f"subtype must be one of {sorted(WALL_SUBTYPES)}, got {subtype!r}")

    dimensions = Dimensions(width=width, height=height, depth=thickness)
    transform = Transform(
        position=Vec3.from_tuple(position),
        rotation=Vec3(x=0.0, y=0.0, z=rotation_z),
    )
    mesh = apply_transform(box_mesh(dimensions), transform)
    vertex_count, face_count = mesh_counts(mesh)

    component = Component(
        id=id,
        type="wall",
        subtype=subtype,
        dimensions=dimensions,
        transform=transform,
        bounding_box=world_bounding_box(mesh),
        material=material,
        anchors=anchors_from_local(dimensions, transform, _ANCHORS),
        mesh=MeshInfo(vertex_count=vertex_count, face_count=face_count, formats=["obj", "glb"]),
    )
    return mesh, component
