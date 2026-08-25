"""prompt.txt #9 -- doors get their own `door` + subtype component; where a
door sits in a wall is an explicit `inserted_into` relationship built by the
room assembler (Phase 4), not implied by coordinates alone. `hinge_side` is
a real anchor derived from the same local geometry as the mesh, not a
separate estimate."""

from __future__ import annotations

import trimesh

from generators.house.primitives import (
    anchors_from_local,
    apply_transform,
    box_mesh,
    mesh_counts,
    transform_point,
    world_bounding_box,
)
from schemas.component import Component, MeshInfo
from schemas.geometry import Anchor, Dimensions, Transform, Vec3
from schemas.material import Material
from schemas.taxonomy import DOOR_SUBTYPES

_ANCHORS = {"top", "bottom", "left", "right", "center"}


def make_door(
    id: str,
    width: float,
    height: float,
    thickness: float,
    position: tuple[float, float, float],
    rotation_z: float = 0.0,
    subtype: str = "single_door",
    hinge: str = "left",
    material: Material | None = None,
) -> tuple[trimesh.Trimesh, Component]:
    if subtype not in DOOR_SUBTYPES:
        raise ValueError(f"subtype must be one of {sorted(DOOR_SUBTYPES)}, got {subtype!r}")
    if hinge not in ("left", "right"):
        raise ValueError(f"hinge must be 'left' or 'right', got {hinge!r}")

    dimensions = Dimensions(width=width, height=height, depth=thickness)
    transform = Transform(
        position=Vec3.from_tuple(position),
        rotation=Vec3(x=0.0, y=0.0, z=rotation_z),
    )
    mesh = apply_transform(box_mesh(dimensions), transform)
    vertex_count, face_count = mesh_counts(mesh)

    anchors = anchors_from_local(dimensions, transform, _ANCHORS)
    hinge_x = -width / 2 if hinge == "left" else width / 2
    anchors.append(
        Anchor(name="hinge_side", position=transform_point(Vec3(x=hinge_x, y=0.0, z=0.0), transform))
    )

    component = Component(
        id=id,
        type="door",
        subtype=subtype,
        dimensions=dimensions,
        transform=transform,
        bounding_box=world_bounding_box(mesh),
        material=material,
        anchors=anchors,
        mesh=MeshInfo(vertex_count=vertex_count, face_count=face_count, formats=["obj", "glb"]),
    )
    return mesh, component
