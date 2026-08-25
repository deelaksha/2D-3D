"""prompt.txt #9 -- windows get their own `window` + subtype component,
`inserted_into` a wall via an explicit relationship (Phase 4), not implied
by coordinates. `sill` anchor sits at the bottom edge, offset outward along
the wall-thickness axis (+Y, same axis as wall thickness) to mark the sill
ledge -- a real point on the frame, not the same point as `bottom`."""

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
from schemas.taxonomy import WINDOW_SUBTYPES

_ANCHORS = {"top", "bottom", "left", "right", "center"}


def make_window(
    id: str,
    width: float,
    height: float,
    thickness: float,
    position: tuple[float, float, float],
    rotation_z: float = 0.0,
    subtype: str = "single_window",
    material: Material | None = None,
) -> tuple[trimesh.Trimesh, Component]:
    if subtype not in WINDOW_SUBTYPES:
        raise ValueError(f"subtype must be one of {sorted(WINDOW_SUBTYPES)}, got {subtype!r}")

    dimensions = Dimensions(width=width, height=height, depth=thickness)
    transform = Transform(
        position=Vec3.from_tuple(position),
        rotation=Vec3(x=0.0, y=0.0, z=rotation_z),
    )
    mesh = apply_transform(box_mesh(dimensions), transform)
    vertex_count, face_count = mesh_counts(mesh)

    anchors = anchors_from_local(dimensions, transform, _ANCHORS)
    sill_local = Vec3(x=0.0, y=thickness, z=-height / 2)
    anchors.append(Anchor(name="sill", position=transform_point(sill_local, transform)))

    component = Component(
        id=id,
        type="window",
        subtype=subtype,
        dimensions=dimensions,
        transform=transform,
        bounding_box=world_bounding_box(mesh),
        material=material,
        anchors=anchors,
        mesh=MeshInfo(vertex_count=vertex_count, face_count=face_count, formats=["obj", "glb"]),
    )
    return mesh, component
