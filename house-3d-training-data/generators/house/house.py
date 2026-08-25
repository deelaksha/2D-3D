"""prompt.txt #30 -- deterministic dataset splits assigned by scene
*template*, not by individual generated sample, so near-duplicate houses
built from the same template can't leak across train/validation/test.

A template fixes a room's overall shape and which walls carry the door and
windows; per-sample randomization (exact dimensions, offsets, materials)
happens within the template's ranges, seeded by (seed, sample_id) so a run
is fully reproducible.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

from generators.house.room import DoorSpec, RoomResult, WindowSpec, build_room
from schemas.dataset_config import SplitConfig
from schemas.material import Material

WALL_MATERIALS = ["brick", "concrete", "plaster", "stone"]
FLOOR_MATERIALS = ["tile", "wood", "marble", "concrete"]
CEILING_MATERIALS = ["plaster", "concrete"]
DOOR_MATERIALS = ["wood", "steel", "glass"]
WINDOW_MATERIALS = ["glass"]


@dataclass(frozen=True)
class RoomTemplate:
    id: str
    width_range: tuple[float, float]
    depth_range: tuple[float, float]
    height_range: tuple[float, float]
    door_wall: str
    window_walls: tuple[str, ...]


TEMPLATES: tuple[RoomTemplate, ...] = (
    RoomTemplate(
        id="template_small_studio", width_range=(3.0, 3.6), depth_range=(3.4, 4.2),
        height_range=(2.5, 2.8), door_wall="south", window_walls=("north",),
    ),
    RoomTemplate(
        id="template_medium_bedroom", width_range=(3.6, 4.4), depth_range=(4.2, 5.2),
        height_range=(2.6, 3.0), door_wall="south", window_walls=("north", "east"),
    ),
    RoomTemplate(
        id="template_large_living", width_range=(5.0, 6.2), depth_range=(5.5, 7.0),
        height_range=(2.7, 3.2), door_wall="west", window_walls=("north", "south"),
    ),
    RoomTemplate(
        id="template_narrow_hall", width_range=(2.4, 2.8), depth_range=(6.0, 8.0),
        height_range=(2.5, 2.7), door_wall="south", window_walls=("east",),
    ),
    RoomTemplate(
        id="template_small_bathroom", width_range=(1.8, 2.4), depth_range=(2.2, 2.8),
        height_range=(2.4, 2.6), door_wall="east", window_walls=("south",),
    ),
    RoomTemplate(
        id="template_large_kitchen", width_range=(4.5, 5.5), depth_range=(4.0, 5.0),
        height_range=(2.7, 3.0), door_wall="north", window_walls=("east", "west"),
    ),
    RoomTemplate(
        id="template_compact_office", width_range=(2.8, 3.4), depth_range=(3.0, 3.6),
        height_range=(2.6, 2.8), door_wall="east", window_walls=("north",),
    ),
    RoomTemplate(
        id="template_master_bedroom", width_range=(4.2, 5.0), depth_range=(4.5, 5.5),
        height_range=(2.7, 3.0), door_wall="south", window_walls=("north", "west"),
    ),
    RoomTemplate(
        id="template_basement_room", width_range=(3.5, 4.5), depth_range=(4.0, 5.5),
        height_range=(2.2, 2.4), door_wall="north", window_walls=(),
    ),
    RoomTemplate(
        id="template_playroom", width_range=(3.8, 4.6), depth_range=(3.8, 4.6),
        height_range=(2.6, 2.8), door_wall="west", window_walls=("south", "east"),
    ),
    RoomTemplate(
        id="template_corner_bedroom", width_range=(3.2, 4.0), depth_range=(3.5, 4.2),
        height_range=(2.6, 2.9), door_wall="south", window_walls=("east", "north"),
    ),
    RoomTemplate(
        id="template_attic_room", width_range=(2.6, 3.4), depth_range=(3.0, 4.0),
        height_range=(2.2, 2.6), door_wall="south", window_walls=("west",),
    ),
)

_TEMPLATES_BY_ID = {t.id: t for t in TEMPLATES}

WALL_THICKNESS = 0.2
DOOR_WIDTH = 0.9
DOOR_HEIGHT = 2.1


def list_template_ids() -> list[str]:
    return [t.id for t in TEMPLATES]


def _wall_length(side: str, width: float, depth: float) -> float:
    return width if side in ("north", "south") else depth


def split_for_template(template_id: str, split: SplitConfig) -> str:
    """Stable hash of the template id -> train/validation/test. Independent
    of seed and sample id, so it never changes as more samples are added."""
    digest = hashlib.sha256(template_id.encode("utf-8")).hexdigest()
    frac = int(digest[:8], 16) / 0xFFFFFFFF
    if frac < split.train:
        return "train"
    if frac < split.train + split.validation:
        return "validation"
    return "test"


def build_house_sample(sample_id: str, template_id: str, seed: int) -> RoomResult:
    template = _TEMPLATES_BY_ID.get(template_id)
    if template is None:
        raise ValueError(f"unknown template {template_id!r}, expected one of {list_template_ids()}")

    rng = random.Random(f"{seed}:{sample_id}:{template_id}")

    width = rng.uniform(*template.width_range)
    depth = rng.uniform(*template.depth_range)
    height = rng.uniform(*template.height_range)

    door_length = _wall_length(template.door_wall, width, depth)
    door_offset = rng.uniform(DOOR_WIDTH, door_length - DOOR_WIDTH)
    doors = [
        DoorSpec(
            wall=template.door_wall, offset=door_offset, width=DOOR_WIDTH, height=DOOR_HEIGHT,
            hinge=rng.choice(["left", "right"]),
            material=Material(name=rng.choice(DOOR_MATERIALS)),
        )
    ]

    windows = []
    for wall in template.window_walls:
        wall_length = _wall_length(wall, width, depth)
        window_width = rng.uniform(1.0, 1.4)
        window_offset = rng.uniform(window_width, wall_length - window_width)
        windows.append(
            WindowSpec(
                wall=wall, offset=window_offset, width=window_width,
                height=rng.uniform(0.9, 1.3), sill_height=rng.uniform(0.8, 1.0),
                material=Material(name=rng.choice(WINDOW_MATERIALS)),
            )
        )

    return build_room(
        room_id=sample_id, width=width, depth=depth, height=height, wall_thickness=WALL_THICKNESS,
        wall_material=Material(name=rng.choice(WALL_MATERIALS)),
        floor_material=Material(name=rng.choice(FLOOR_MATERIALS)),
        ceiling_material=Material(name=rng.choice(CEILING_MATERIALS)),
        doors=doors, windows=windows,
    )
