"""Single source of truth for the house/architecture component taxonomy.

prompt.txt sections 4-10: hierarchical labels, not one generic "house" class.
Material is metadata on a component, never part of its primary type/subtype
identity (prompt.txt #10) -- `wall` + material=concrete and `wall` +
material=brick are the same semantic object.
"""

from __future__ import annotations

BUILDING_TYPES = {
    "house",
    "apartment",
    "villa",
    "office",
    "commercial_building",
    "garage",
    "warehouse",
}

STRUCTURAL_TYPES = {
    "wall",
    "floor",
    "ceiling",
    "roof",
    "foundation",
    "slab",
    "column",
    "pillar",
    "beam",
    "staircase",
    "landing",
}

WALL_SUBTYPES = {
    "external_wall",
    "internal_wall",
    "partition_wall",
    "load_bearing_wall",
    "non_load_bearing_wall",
    "curved_wall",
}

OPENING_TYPES = {
    "door",
    "window",
    "arch",
    "doorway",
    "ventilation_opening",
    "skylight",
}

DOOR_SUBTYPES = {
    "single_door",
    "double_door",
    "sliding_door",
    "folding_door",
    "glass_door",
    "wood_door",
    "metal_door",
    "garage_door",
}

WINDOW_SUBTYPES = {
    "single_window",
    "double_window",
    "sliding_window",
    "casement_window",
    "bay_window",
    "arched_window",
    "fixed_window",
    "skylight",
}

ARCHITECTURAL_TYPES = {
    "balcony",
    "railing",
    "parapet",
    "cornice",
    "molding",
    "trim",
    "facade",
    "awning",
    "canopy",
    "porch",
    "veranda",
    "terrace",
}

INTERIOR_SPACE_TYPES = {
    "room",
    "kitchen",
    "bathroom",
    "bedroom",
    "living_room",
    "dining_room",
    "hallway",
    "garage",
    "storage_room",
}

INTERIOR_OBJECT_TYPES = {
    "cabinet",
    "wardrobe",
    "kitchen_counter",
    "sink",
    "toilet",
    "bathtub",
    "shower",
    "bed",
    "sofa",
    "chair",
    "table",
    "desk",
    "shelf",
}

BUILDING_SYSTEM_TYPES = {
    "electrical_switch",
    "electrical_socket",
    "light",
    "ceiling_fan",
    "air_conditioner",
    "pipe",
    "drain",
    "water_tank",
    "radiator",
}

MATERIALS = {
    "concrete",
    "brick",
    "cement",
    "plaster",
    "wood",
    "glass",
    "steel",
    "aluminium",
    "marble",
    "granite",
    "ceramic",
    "tile",
    "stone",
}

# Components actually implemented by generators/house/ (Phase 3). Everything
# above is the full taxonomy the schema will accept; this is what the
# generator code currently produces.
IMPLEMENTED_TYPES = {"wall", "door", "window", "floor", "ceiling"}

ALL_COMPONENT_TYPES = (
    STRUCTURAL_TYPES
    | OPENING_TYPES
    | ARCHITECTURAL_TYPES
    | INTERIOR_SPACE_TYPES
    | INTERIOR_OBJECT_TYPES
    | BUILDING_SYSTEM_TYPES
)

ALL_SUBTYPES = WALL_SUBTYPES | DOOR_SUBTYPES | WINDOW_SUBTYPES

# prompt.txt #26 -- semantic segmentation class ids. 0 is reserved for
# background/unlabeled. Stable and append-only: never renumber, only add.
SEMANTIC_CLASS_IDS: dict[str, int] = {
    "background": 0,
    "wall": 1,
    "door": 2,
    "window": 3,
    "floor": 4,
    "ceiling": 5,
    "roof": 6,
    "staircase": 7,
    "column": 8,
    "beam": 9,
    "balcony": 10,
    "railing": 11,
    "foundation": 12,
    "slab": 13,
    "pillar": 14,
    "landing": 15,
}


def semantic_class_id(component_type: str) -> int:
    return SEMANTIC_CLASS_IDS.get(component_type, 0)


# prompt.txt #24 -- explicit assembly relationship predicates.
RELATIONSHIP_PREDICATES = {
    "inserted_into",
    "mounted_on",
    "attached_to",
    "connected_to",
    "supports",
    "part_of",
}

# prompt.txt #25 -- semantic anchor names per component type.
ANCHOR_NAMES: dict[str, set[str]] = {
    "wall": {"top", "bottom", "left", "right", "center"},
    "door": {"top", "bottom", "left", "right", "hinge_side", "center"},
    "window": {"top", "bottom", "left", "right", "center", "sill"},
    "roof": {"ridge", "eave_left", "eave_right", "center"},
    "floor": {"center"},
    "ceiling": {"center"},
}
