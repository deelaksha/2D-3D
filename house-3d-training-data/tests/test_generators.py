import math

from generators.house.ceiling import make_ceiling
from generators.house.door import make_door
from generators.house.floor import make_floor
from generators.house.wall import make_wall
from generators.house.window import make_window
from schemas.material import Material


def test_wall_mesh_and_component_agree():
    mesh, wall = make_wall(
        id="wall_1", width=4.0, height=2.7, thickness=0.2,
        position=(0.0, 0.0, 1.35), subtype="external_wall",
        material=Material(name="brick"),
    )
    assert mesh.is_watertight
    assert wall.dimensions.width == 4.0
    assert wall.dimensions.height == 2.7
    assert wall.mesh.vertex_count == len(mesh.vertices)
    assert wall.mesh.face_count == len(mesh.faces)
    # bounding box must actually bound the mesh
    assert wall.bounding_box.min.x <= mesh.vertices[:, 0].min() + 1e-9
    assert wall.bounding_box.max.x >= mesh.vertices[:, 0].max() - 1e-9
    anchor_names = {a.name for a in wall.anchors}
    assert anchor_names == {"top", "bottom", "left", "right", "center"}
    top = next(a for a in wall.anchors if a.name == "top")
    bottom = next(a for a in wall.anchors if a.name == "bottom")
    assert math.isclose(top.position.z - bottom.position.z, 2.7, rel_tol=1e-9)


def test_wall_rotation_moves_anchors_consistently_with_mesh():
    mesh, wall = make_wall(
        id="wall_2", width=3.0, height=2.5, thickness=0.2,
        position=(0.0, 0.0, 1.25), rotation_z=90.0,
    )
    left = next(a for a in wall.anchors if a.name == "left")
    right = next(a for a in wall.anchors if a.name == "right")
    # a wall rotated 90 degrees about Z has its width axis along world Y
    assert math.isclose(left.position.x, 0.0, abs_tol=1e-9)
    assert math.isclose(right.position.x, 0.0, abs_tol=1e-9)
    assert math.isclose(abs(left.position.y - right.position.y), 3.0, rel_tol=1e-9)
    assert mesh.bounds[1][1] - mesh.bounds[0][1] > mesh.bounds[1][0] - mesh.bounds[0][0]


def test_door_inserted_into_wall_footprint():
    _, wall = make_wall(id="wall_3", width=4.0, height=2.7, thickness=0.2, position=(0, 0, 1.35))
    _, door = make_door(
        id="door_1", width=0.9, height=2.1, thickness=0.05,
        position=(0.5, 0.0, 1.05), hinge="left",
    )
    # door must sit fully within the wall's horizontal (X) and vertical (Z) footprint
    assert wall.bounding_box.min.x <= door.bounding_box.min.x
    assert wall.bounding_box.max.x >= door.bounding_box.max.x
    assert wall.bounding_box.min.z <= door.bounding_box.min.z
    assert door.bounding_box.max.z <= wall.bounding_box.max.z
    hinge = next(a for a in door.anchors if a.name == "hinge_side")
    assert math.isclose(hinge.position.x, 0.5 - 0.45, rel_tol=1e-9)


def test_window_sill_anchor_present_and_below_top():
    _, window = make_window(
        id="win_1", width=1.2, height=1.0, thickness=0.15,
        position=(0.0, 0.0, 1.6), subtype="fixed_window",
        material=Material(name="glass"),
    )
    names = {a.name for a in window.anchors}
    assert "sill" in names
    sill = next(a for a in window.anchors if a.name == "sill")
    top = next(a for a in window.anchors if a.name == "top")
    assert sill.position.z < top.position.z


def test_floor_and_ceiling_span_room_and_stack_correctly():
    _, floor = make_floor(id="floor_1", width=4.0, depth=5.0, thickness=0.15, position=(0, 0, -0.075))
    _, ceiling = make_ceiling(id="ceiling_1", width=4.0, depth=5.0, thickness=0.15, position=(0, 0, 2.7 + 0.075))
    assert math.isclose(floor.bounding_box.max.z, 0.0, abs_tol=1e-9)
    assert math.isclose(ceiling.bounding_box.min.z, 2.7, abs_tol=1e-9)
    assert {a.name for a in floor.anchors} == {"center"}
    assert {a.name for a in ceiling.anchors} == {"center"}


def test_invalid_subtype_rejected():
    try:
        make_wall(id="bad", width=1, height=1, thickness=0.1, position=(0, 0, 0), subtype="door")
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for a subtype from the wrong taxonomy family")
