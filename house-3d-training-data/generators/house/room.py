"""prompt.txt #4-#10, #24, #25 -- assembles a floor + four walls + a door +
windows + a ceiling into one validated Scene, wired together with explicit
relationships (inserted_into / attached_to / supports), not just coordinates.

Room convention: the floor's top surface is world z=0, centered in X/Y over
[-width/2, width/2] x [-depth/2, depth/2]. "north"/"south" walls run along
X (at y=+depth/2 / y=-depth/2); "east"/"west" walls run along Y (at
x=+width/2 / x=-width/2). An opening's `offset` is measured in meters from
the negative end of its wall's long axis to the opening's own center.
"""

from __future__ import annotations

from dataclasses import dataclass

import trimesh

from generators.house.ceiling import make_ceiling
from generators.house.door import make_door
from generators.house.floor import make_floor
from generators.house.primitives import mesh_counts, opening_cutter_mesh
from generators.house.wall import make_wall
from generators.house.window import make_window
from schemas.component import MeshInfo
from schemas.geometry import Transform, Vec3
from schemas.material import Material
from schemas.relationship import Relationship
from schemas.scene import Scene

WALL_SIDES = ("north", "south", "east", "west")


@dataclass
class DoorSpec:
    wall: str
    offset: float
    width: float = 0.9
    height: float = 2.1
    hinge: str = "left"
    subtype: str = "single_door"
    material: Material | None = None


@dataclass
class WindowSpec:
    wall: str
    offset: float
    width: float = 1.2
    height: float = 1.0
    sill_height: float = 0.9
    subtype: str = "fixed_window"
    material: Material | None = None


@dataclass
class RoomResult:
    scene: Scene
    meshes: dict[str, trimesh.Trimesh]


def _wall_layout(side: str, width: float, depth: float, height: float, thickness: float):
    """-> (length_along_wall, center_x, center_y, rotation_z)."""
    if side == "north":
        return width, 0.0, depth / 2 - thickness / 2, 0.0
    if side == "south":
        return width, 0.0, -depth / 2 + thickness / 2, 0.0
    if side == "east":
        return depth, width / 2 - thickness / 2, 0.0, 90.0
    if side == "west":
        return depth, -width / 2 + thickness / 2, 0.0, 90.0
    raise ValueError(f"unknown wall side {side!r}, expected one of {WALL_SIDES}")


def _opening_position(
    side: str, length: float, center_x: float, center_y: float, rotation_z: float,
    offset: float, elevation: float,
) -> tuple[float, float, float]:
    if not (0.0 <= offset <= length):
        raise ValueError(f"offset {offset} out of range for a {length}m {side} wall")
    if rotation_z == 0.0:
        return -length / 2 + offset, center_y, elevation
    return center_x, -length / 2 + offset, elevation


def build_room(
    room_id: str,
    width: float,
    depth: float,
    height: float = 2.7,
    wall_thickness: float = 0.2,
    floor_thickness: float = 0.15,
    ceiling_thickness: float = 0.15,
    wall_material: Material | None = None,
    floor_material: Material | None = None,
    ceiling_material: Material | None = None,
    doors: list[DoorSpec] | None = None,
    windows: list[WindowSpec] | None = None,
) -> RoomResult:
    doors = doors or []
    windows = windows or []

    components: dict[str, object] = {}
    meshes: dict[str, trimesh.Trimesh] = {}
    relationships: list[Relationship] = []
    wall_cutters: dict[str, list[trimesh.Trimesh]] = {}

    def _id(local: str) -> str:
        return f"{room_id}_{local}"

    floor_mesh, floor = make_floor(
        id=_id("floor"), width=width, depth=depth, thickness=floor_thickness,
        position=(0.0, 0.0, -floor_thickness / 2), material=floor_material,
    )
    components[floor.id] = floor
    meshes[floor.id] = floor_mesh

    ceiling_mesh, ceiling = make_ceiling(
        id=_id("ceiling"), width=width, depth=depth, thickness=ceiling_thickness,
        position=(0.0, 0.0, height + ceiling_thickness / 2), material=ceiling_material,
    )
    components[ceiling.id] = ceiling
    meshes[ceiling.id] = ceiling_mesh

    wall_ids: dict[str, str] = {}
    wall_layouts: dict[str, tuple[float, float, float, float]] = {}
    for side in WALL_SIDES:
        length, cx, cy, rot = _wall_layout(side, width, depth, height, wall_thickness)
        wall_layouts[side] = (length, cx, cy, rot)
        wall_mesh, wall = make_wall(
            id=_id(f"wall_{side}"), width=length, height=height, thickness=wall_thickness,
            position=(cx, cy, height / 2), rotation_z=rot,
            subtype="external_wall", material=wall_material,
        )
        components[wall.id] = wall
        meshes[wall.id] = wall_mesh
        wall_ids[side] = wall.id
        wall_cutters[wall.id] = []
        relationships.append(Relationship(subject=wall.id, predicate="attached_to", object=floor.id))
        relationships.append(Relationship(subject=wall.id, predicate="supports", object=ceiling.id))

    for i, spec in enumerate(doors):
        length, cx, cy, rot = wall_layouts[spec.wall]
        pos = _opening_position(spec.wall, length, cx, cy, rot, spec.offset, spec.height / 2)
        door_mesh, door = make_door(
            id=_id(f"door_{i}"), width=spec.width, height=spec.height, thickness=wall_thickness,
            position=pos, rotation_z=rot, subtype=spec.subtype, hinge=spec.hinge,
            material=spec.material,
        )
        components[door.id] = door
        meshes[door.id] = door_mesh
        host_wall_id = wall_ids[spec.wall]
        relationships.append(
            Relationship(subject=door.id, predicate="inserted_into", object=host_wall_id)
        )
        cutter_transform = Transform(position=Vec3.from_tuple(pos), rotation=Vec3(x=0.0, y=0.0, z=rot))
        wall_cutters[host_wall_id].append(
            opening_cutter_mesh(spec.width, spec.height, wall_thickness, cutter_transform)
        )

    for i, spec in enumerate(windows):
        length, cx, cy, rot = wall_layouts[spec.wall]
        elevation = spec.sill_height + spec.height / 2
        pos = _opening_position(spec.wall, length, cx, cy, rot, spec.offset, elevation)
        window_mesh, window = make_window(
            id=_id(f"window_{i}"), width=spec.width, height=spec.height, thickness=wall_thickness,
            position=pos, rotation_z=rot, subtype=spec.subtype, material=spec.material,
        )
        components[window.id] = window
        meshes[window.id] = window_mesh
        host_wall_id = wall_ids[spec.wall]
        relationships.append(
            Relationship(subject=window.id, predicate="inserted_into", object=host_wall_id)
        )
        cutter_transform = Transform(position=Vec3.from_tuple(pos), rotation=Vec3(x=0.0, y=0.0, z=rot))
        wall_cutters[host_wall_id].append(
            opening_cutter_mesh(spec.width, spec.height, wall_thickness, cutter_transform)
        )

    # Cut every door/window opening out of its host wall's mesh, so the wall
    # has a real hole (prompt.txt: ground truth must be real geometry, not
    # implied by overlapping boxes). The wall Component's dimensions/
    # bounding_box/anchors describe the nominal solid envelope; only `mesh`
    # is refreshed to match the actual (now non-solid) exported geometry.
    for wall_id, cutters in wall_cutters.items():
        if not cutters:
            continue
        cut_mesh = meshes[wall_id]
        for cutter in cutters:
            cut_mesh = cut_mesh.difference(cutter)
        meshes[wall_id] = cut_mesh
        vertex_count, face_count = mesh_counts(cut_mesh)
        components[wall_id] = components[wall_id].model_copy(
            update={"mesh": MeshInfo(vertex_count=vertex_count, face_count=face_count, formats=["obj", "glb"])}
        )

    scene = Scene(
        scene_id=room_id, scene_type="room",
        components=list(components.values()), relationships=relationships,
    )
    return RoomResult(scene=scene, meshes=meshes)
