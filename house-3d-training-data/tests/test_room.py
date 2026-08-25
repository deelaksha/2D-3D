import numpy as np

from generators.house.room import DoorSpec, WindowSpec, build_room
from schemas.material import Material


def _sample_room():
    return build_room(
        room_id="room_1", width=4.0, depth=5.0, height=2.7, wall_thickness=0.2,
        wall_material=Material(name="brick"),
        floor_material=Material(name="tile"),
        ceiling_material=Material(name="plaster"),
        doors=[DoorSpec(wall="south", offset=1.5, width=0.9, height=2.1)],
        windows=[
            WindowSpec(wall="north", offset=1.0, width=1.2, height=1.0),
            WindowSpec(wall="east", offset=2.0, width=1.0, height=1.2),
        ],
    )


def test_room_component_count_and_ids():
    result = _sample_room()
    scene = result.scene
    types = sorted(c.type for c in scene.components)
    assert types == sorted(["floor", "ceiling", "wall", "wall", "wall", "wall", "door", "window", "window"])
    assert set(result.meshes.keys()) == {c.id for c in scene.components}


def test_room_relationships_reference_real_components_and_openings_inserted():
    scene = _sample_room().scene
    door = next(c for c in scene.components if c.type == "door")
    window_ids = {c.id for c in scene.components if c.type == "window"}

    inserted = {r.subject: r.object for r in scene.relationships if r.predicate == "inserted_into"}
    assert door.id in inserted
    assert window_ids <= inserted.keys()

    host_wall = scene.component(inserted[door.id])
    assert host_wall.type == "wall"


def test_openings_fit_within_their_host_wall_footprint():
    scene = _sample_room().scene
    inserted = {r.subject: r.object for r in scene.relationships if r.predicate == "inserted_into"}
    for comp in scene.components:
        if comp.type not in ("door", "window"):
            continue
        wall = scene.component(inserted[comp.id])
        assert wall.bounding_box.min.x - 1e-6 <= comp.bounding_box.min.x
        assert comp.bounding_box.max.x <= wall.bounding_box.max.x + 1e-6
        assert wall.bounding_box.min.y - 1e-6 <= comp.bounding_box.min.y
        assert comp.bounding_box.max.y <= wall.bounding_box.max.y + 1e-6
        assert wall.bounding_box.min.z - 1e-6 <= comp.bounding_box.min.z
        assert comp.bounding_box.max.z <= wall.bounding_box.max.z + 1e-6


def test_floor_and_ceiling_bracket_the_walls_vertically():
    scene = _sample_room().scene
    floor = next(c for c in scene.components if c.type == "floor")
    ceiling = next(c for c in scene.components if c.type == "ceiling")
    walls = [c for c in scene.components if c.type == "wall"]
    for wall in walls:
        assert abs(wall.bounding_box.min.z - floor.bounding_box.max.z) < 1e-6
        assert abs(wall.bounding_box.max.z - ceiling.bounding_box.min.z) < 1e-6


def test_wall_openings_are_real_holes_not_coincident_boxes():
    result = _sample_room()
    scene = result.scene
    inserted = {r.subject: r.object for r in scene.relationships if r.predicate == "inserted_into"}

    for comp in scene.components:
        if comp.type not in ("door", "window"):
            continue
        wall_id = inserted[comp.id]
        wall_mesh = result.meshes[wall_id]
        assert wall_mesh.is_watertight

        # a ray fired straight through the opening's center, perpendicular to
        # the wall, must NOT hit the (now-holed) wall mesh -- proves the cut
        # actually removed material rather than leaving a coincident box.
        wall = scene.component(wall_id)
        center = np.array(comp.transform.position.as_tuple())
        thickness_axis = np.array([0.0, 1.0, 0.0]) if wall.transform.rotation.z == 0.0 else np.array([1.0, 0.0, 0.0])
        origin = center - thickness_axis * 5.0
        locations, *_ = wall_mesh.ray.intersects_location(
            ray_origins=[origin], ray_directions=[thickness_axis]
        )
        assert len(locations) == 0


def test_walls_attached_to_floor_and_support_ceiling():
    scene = _sample_room().scene
    floor = next(c for c in scene.components if c.type == "floor")
    ceiling = next(c for c in scene.components if c.type == "ceiling")
    walls = {c.id for c in scene.components if c.type == "wall"}

    attached = {r.subject for r in scene.relationships if r.predicate == "attached_to" and r.object == floor.id}
    supports = {r.subject for r in scene.relationships if r.predicate == "supports" and r.object == ceiling.id}
    assert attached == walls
    assert supports == walls
