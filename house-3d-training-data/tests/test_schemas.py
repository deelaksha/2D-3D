import math

import pytest
from pydantic import ValidationError

from schemas.component import Component, MeshInfo
from schemas.geometry import Anchor, BoundingBox, Dimensions, Transform, Vec3
from schemas.material import Material
from schemas.quality import QualityScore
from schemas.relationship import Relationship
from schemas.scene import Scene


def _wall(id_="wall_001", subtype="external_wall"):
    return Component(
        id=id_,
        type="wall",
        subtype=subtype,
        dimensions=Dimensions(width=4.0, height=3.0, depth=0.2),
        transform=Transform(position=Vec3(x=0, y=0, z=1.5)),
        bounding_box=BoundingBox(
            min=Vec3(x=-2, y=-0.1, z=0), max=Vec3(x=2, y=0.1, z=3)
        ),
        material=Material(name="concrete"),
        anchors=[Anchor(name="center", position=Vec3(x=0, y=0, z=1.5))],
        mesh=MeshInfo(vertex_count=8, face_count=12, formats=["obj"]),
    )


def test_dimensions_reject_zero_and_negative():
    Dimensions(width=1, height=1, depth=1)
    with pytest.raises(ValidationError):
        Dimensions(width=0, height=1, depth=1)
    with pytest.raises(ValidationError):
        Dimensions(width=-1, height=1, depth=1)


def test_dimensions_reject_nan_inf():
    with pytest.raises(ValidationError):
        Dimensions(width=math.nan, height=1, depth=1)
    with pytest.raises(ValidationError):
        Dimensions(width=math.inf, height=1, depth=1)


def test_bounding_box_min_must_be_le_max():
    BoundingBox(min=Vec3(x=0, y=0, z=0), max=Vec3(x=1, y=1, z=1))
    with pytest.raises(ValidationError):
        BoundingBox(min=Vec3(x=2, y=0, z=0), max=Vec3(x=1, y=1, z=1))


def test_component_rejects_unknown_type():
    with pytest.raises(ValidationError):
        Component(
            id="x",
            type="not_a_real_type",
            dimensions=Dimensions(width=1, height=1, depth=1),
            transform=Transform(position=Vec3(x=0, y=0, z=0)),
            bounding_box=BoundingBox(min=Vec3(x=0, y=0, z=0), max=Vec3(x=1, y=1, z=1)),
            mesh=MeshInfo(vertex_count=8, face_count=12, formats=["obj"]),
        )


def test_component_rejects_subtype_mismatch():
    with pytest.raises(ValidationError):
        _wall(subtype="sliding_door")  # a door subtype on a wall


def test_component_rejects_unknown_anchor_name():
    with pytest.raises(ValidationError):
        Component(
            id="w1",
            type="wall",
            dimensions=Dimensions(width=1, height=1, depth=1),
            transform=Transform(position=Vec3(x=0, y=0, z=0)),
            bounding_box=BoundingBox(min=Vec3(x=0, y=0, z=0), max=Vec3(x=1, y=1, z=1)),
            anchors=[Anchor(name="ridge", position=Vec3(x=0, y=0, z=0))],
            mesh=MeshInfo(vertex_count=8, face_count=12, formats=["obj"]),
        )


def test_scene_rejects_duplicate_component_ids():
    with pytest.raises(ValidationError):
        Scene(scene_id="s1", scene_type="house", components=[_wall(), _wall()])


def test_scene_rejects_relationship_to_unknown_component():
    with pytest.raises(ValidationError):
        Scene(
            scene_id="s1",
            scene_type="house",
            components=[_wall()],
            relationships=[
                Relationship(subject="door_999", predicate="inserted_into", object="wall_001")
            ],
        )


def test_scene_accepts_valid_relationship():
    wall = _wall()
    door = _wall(id_="door_001", subtype=None)
    scene = Scene(
        scene_id="s1",
        scene_type="house",
        components=[wall, door],
        relationships=[
            Relationship(subject="door_001", predicate="inserted_into", object="wall_001")
        ],
    )
    assert scene.component("wall_001") is wall


def test_quality_score_fills_overall_as_mean():
    q = QualityScore(
        geometry_quality=1.0,
        annotation_quality=1.0,
        segmentation_quality=0.5,
        physical_validity=0.5,
    )
    assert q.overall_quality == pytest.approx(0.75)


def test_quality_score_rejects_out_of_range():
    with pytest.raises(ValidationError):
        QualityScore(
            geometry_quality=1.5,
            annotation_quality=1.0,
            segmentation_quality=1.0,
            physical_validity=1.0,
        )
