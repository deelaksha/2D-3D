import numpy as np
import trimesh

from generators.house.door import make_door
from generators.house.room import DoorSpec, WindowSpec, build_room
from generators.house.wall import make_wall
from schemas.material import Material
from schemas.relationship import Relationship
from schemas.scene import Scene
from validation.annotation import check_annotation
from validation.dataset import check_render_completeness
from validation.geometry import check_geometry
from validation.physical import check_physical


def _valid_room_scene():
    return build_room(
        room_id="v", width=4.0, depth=5.0, height=2.7, wall_thickness=0.2,
        wall_material=Material(name="brick"),
        doors=[DoorSpec(wall="south", offset=1.5, width=0.9, height=2.1)],
        windows=[WindowSpec(wall="north", offset=1.0, width=1.2, height=1.0)],
    )


def test_check_geometry_passes_for_a_valid_room():
    result = _valid_room_scene()
    score, issues = check_geometry(result.scene, result.meshes)
    assert score == 1.0
    assert issues == []


def test_check_geometry_flags_non_watertight_mesh():
    result = _valid_room_scene()
    wall_id = next(c.id for c in result.scene.components if c.type == "wall")
    broken = result.meshes[wall_id].copy()
    broken.update_faces(np.arange(len(broken.faces) - 1))  # drop one face -> no longer watertight
    meshes = {**result.meshes, wall_id: broken}

    score, issues = check_geometry(result.scene, meshes)
    assert score < 1.0
    assert any(wall_id in issue for issue in issues)


def test_check_physical_passes_for_a_valid_room():
    result = _valid_room_scene()
    score, issues = check_physical(result.scene)
    assert score == 1.0
    assert issues == []


def test_check_physical_flags_opening_outside_host_wall():
    wall_mesh, wall = make_wall(
        id="w1", width=4.0, height=2.7, thickness=0.2, position=(0.0, -2.5, 1.35),
    )
    door_mesh, door = make_door(
        id="d1", width=0.9, height=2.1, thickness=0.2, position=(3.0, -2.5, 1.05),
    )
    scene = Scene(
        scene_id="s", scene_type="room", components=[wall, door],
        relationships=[Relationship(subject=door.id, predicate="inserted_into", object=wall.id)],
    )
    score, issues = check_physical(scene)
    assert score < 1.0
    assert any("not contained within host wall" in issue for issue in issues)


def test_check_physical_flags_implausible_door_size():
    wall_mesh, wall = make_wall(
        id="w1", width=8.0, height=4.0, thickness=0.2, position=(0.0, -4.0, 2.0),
    )
    door_mesh, door = make_door(
        id="d1", width=4.0, height=3.5, thickness=0.2, position=(0.0, -4.0, 1.75),
    )
    scene = Scene(
        scene_id="s", scene_type="room", components=[wall, door],
        relationships=[Relationship(subject=door.id, predicate="inserted_into", object=wall.id)],
    )
    score, issues = check_physical(scene)
    assert score < 1.0
    assert any("implausible door size" in issue for issue in issues)


def test_check_annotation_flags_opening_without_relationship():
    wall_mesh, wall = make_wall(id="w1", width=4.0, height=2.7, thickness=0.2, position=(0.0, -2.5, 1.35))
    door_mesh, door = make_door(id="d1", width=0.9, height=2.1, thickness=0.2, position=(0.0, -2.5, 1.05))
    scene = Scene(scene_id="s", scene_type="room", components=[wall, door], relationships=[])

    score, issues = check_annotation(scene)
    assert score < 1.0
    assert any("no inserted_into relationship" in issue for issue in issues)


def test_check_render_completeness_flags_missing_files(tmp_path):
    score, issues = check_render_completeness(tmp_path, "missing_sample", ["front"])
    assert score == 0.0
    assert len(issues) > 0
