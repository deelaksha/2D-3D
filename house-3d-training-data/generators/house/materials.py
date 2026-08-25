"""Default render colors per material (prompt.txt #10 -- material is metadata,
never part of a component's type/subtype identity). Generators use these
unless a Material.color_rgb override is set."""

from __future__ import annotations

from schemas.material import Material

DEFAULT_MATERIAL_COLORS: dict[str, tuple[float, float, float]] = {
    "concrete": (0.72, 0.71, 0.68),
    "brick": (0.55, 0.27, 0.22),
    "cement": (0.66, 0.65, 0.62),
    "plaster": (0.88, 0.86, 0.80),
    "wood": (0.52, 0.35, 0.20),
    "glass": (0.75, 0.88, 0.92),
    "steel": (0.62, 0.64, 0.66),
    "aluminium": (0.75, 0.76, 0.78),
    "marble": (0.90, 0.89, 0.86),
    "granite": (0.35, 0.35, 0.37),
    "ceramic": (0.92, 0.92, 0.90),
    "tile": (0.80, 0.78, 0.74),
    "stone": (0.58, 0.56, 0.52),
}

FALLBACK_COLOR: tuple[float, float, float] = (0.7, 0.7, 0.7)


def resolve_color(material: Material | None) -> tuple[float, float, float]:
    if material is None:
        return FALLBACK_COLOR
    if material.color_rgb is not None:
        return material.color_rgb
    return DEFAULT_MATERIAL_COLORS.get(material.name, FALLBACK_COLOR)
