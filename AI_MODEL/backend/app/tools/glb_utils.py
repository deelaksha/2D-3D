from __future__ import annotations

import json
import math
import struct
from pathlib import Path
from typing import Any, Optional

_GLB_MAGIC = 0x46546C67  # ascii 'glTF'
_GLB_VERSION = 2
_CHUNK_TYPE_JSON = 0x4E4F534A  # ascii 'JSON'
_CHUNK_TYPE_BIN = 0x004E4942  # ascii 'BIN\0'

COLOR_PALETTE: dict[str, list[float]] = {
    "black": [0.15, 0.15, 0.15, 1.0],
    "red": [0.85, 0.15, 0.15, 1.0],
    "blue": [0.15, 0.35, 0.85, 1.0],
    "green": [0.15, 0.75, 0.25, 1.0],
    "yellow": [0.95, 0.80, 0.15, 1.0],
    "white": [0.92, 0.92, 0.92, 1.0],
    "wood": [0.55, 0.35, 0.18, 1.0],
    "metal": [0.70, 0.72, 0.75, 1.0],
    "leather": [0.35, 0.20, 0.12, 1.0],
    "gold": [0.95, 0.75, 0.10, 1.0],
    "silver": [0.80, 0.82, 0.85, 1.0],
    "default": [0.60, 0.65, 0.70, 1.0],
}


def _pad(data: bytes, pad_byte: bytes) -> bytes:
    remainder = len(data) % 4
    if remainder == 0:
        return data
    return data + pad_byte * (4 - remainder)


def _color_for(name: str) -> list[float]:
    for key, color in COLOR_PALETTE.items():
        if key in name.lower():
            return color
    return COLOR_PALETTE["default"]


class _MeshPart:

    def __init__(
        self,
        positions: list[float],
        normals: list[float],
        indices: list[int],
        color: list[float],
        name: str = "part",
        metallic: float = 0.1,
        roughness: float = 0.5,
    ):
        self.positions = positions
        self.normals = normals
        self.indices = indices
        self.color = color
        self.name = name
        self.metallic = metallic
        self.roughness = roughness


def _create_box(
    cx: float, cy: float, cz: float, dx: float, dy: float, dz: float, color: list[float], name: str = "box"
) -> _MeshPart:
    hx, hy, hz = dx / 2.0, dy / 2.0, dz / 2.0

    # 6 faces * 4 vertices = 24 vertices
    positions = [
        # Front (+Z)
        cx - hx, cy - hy, cz + hz,  cx + hx, cy - hy, cz + hz,  cx + hx, cy + hy, cz + hz,  cx - hx, cy + hy, cz + hz,
        # Back (-Z)
        cx + hx, cy - hy, cz - hz,  cx - hx, cy - hy, cz - hz,  cx - hx, cy + hy, cz - hz,  cx + hx, cy + hy, cz - hz,
        # Top (+Y)
        cx - hx, cy + hy, cz + hz,  cx + hx, cy + hy, cz + hz,  cx + hx, cy + hy, cz - hz,  cx - hx, cy + hy, cz - hz,
        # Bottom (-Y)
        cx - hx, cy - hy, cz - hz,  cx + hx, cy - hy, cz - hz,  cx + hx, cy - hy, cz + hz,  cx - hx, cy - hy, cz + hz,
        # Right (+X)
        cx + hx, cy - hy, cz + hz,  cx + hx, cy - hy, cz - hz,  cx + hx, cy + hy, cz - hz,  cx + hx, cy + hy, cz + hz,
        # Left (-X)
        cx - hx, cy - hy, cz - hz,  cx - hx, cy - hy, cz + hz,  cx - hx, cy + hy, cz + hz,  cx - hx, cy + hy, cz - hz,
    ]

    normals = [
        0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ]

    indices = []
    for f in range(6):
        base = f * 4
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])

    return _MeshPart(positions, normals, indices, color, name)


def _create_cylinder(
    cx: float, cy: float, cz: float, radius: float, height: float, color: list[float], segments: int = 12, name: str = "cylinder"
) -> _MeshPart:
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []

    half_h = height / 2.0

    # Side vertices
    for i in range(segments):
        theta = (2.0 * math.pi * i) / segments
        nx = math.cos(theta)
        nz = math.sin(theta)
        x = cx + radius * nx
        z = cz + radius * nz

        # Bottom vertex
        positions.extend([x, cy - half_h, z])
        normals.extend([nx, 0.0, nz])
        # Top vertex
        positions.extend([x, cy + half_h, z])
        normals.extend([nx, 0.0, nz])

    for i in range(segments):
        next_i = (i + 1) % segments
        b1, t1 = i * 2, i * 2 + 1
        b2, t2 = next_i * 2, next_i * 2 + 1
        indices.extend([b1, b2, t1, t1, b2, t2])

    return _MeshPart(positions, normals, indices, color, name)


def _build_parts(obj_name: str, colors: list[str], materials: list[str], scale: float = 1.0) -> list[_MeshPart]:
    name = obj_name.lower()
    c1 = _color_for(colors[0]) if colors else COLOR_PALETTE["default"]
    c2 = _color_for(colors[1]) if len(colors) > 1 else (_color_for(materials[0]) if materials else COLOR_PALETTE["metal"])

    parts: list[_MeshPart] = []

    if "chair" in name:
        # Gaming chair / office chair
        seat_color = c1
        leg_color = c2
        parts.append(_create_box(0, 0.45 * scale, 0, 0.5 * scale, 0.08 * scale, 0.5 * scale, seat_color, "Seat"))
        parts.append(_create_box(0, 0.85 * scale, -0.21 * scale, 0.48 * scale, 0.75 * scale, 0.08 * scale, seat_color, "Backrest"))
        # 4 Legs
        parts.append(_create_cylinder(-0.2 * scale, 0.2 * scale, -0.2 * scale, 0.03 * scale, 0.4 * scale, leg_color, name="Leg_FL"))
        parts.append(_create_cylinder(0.2 * scale, 0.2 * scale, -0.2 * scale, 0.03 * scale, 0.4 * scale, leg_color, name="Leg_FR"))
        parts.append(_create_cylinder(-0.2 * scale, 0.2 * scale, 0.2 * scale, 0.03 * scale, 0.4 * scale, leg_color, name="Leg_BL"))
        parts.append(_create_cylinder(0.2 * scale, 0.2 * scale, 0.2 * scale, 0.03 * scale, 0.4 * scale, leg_color, name="Leg_BR"))
        # Armrests
        parts.append(_create_box(-0.24 * scale, 0.65 * scale, 0, 0.05 * scale, 0.25 * scale, 0.35 * scale, leg_color, "Armrest_L"))
        parts.append(_create_box(0.24 * scale, 0.65 * scale, 0, 0.05 * scale, 0.25 * scale, 0.35 * scale, leg_color, "Armrest_R"))

    elif "table" in name or "desk" in name:
        top_color = c1
        leg_color = c2
        parts.append(_create_box(0, 0.75 * scale, 0, 1.2 * scale, 0.08 * scale, 0.7 * scale, top_color, "Tabletop"))
        parts.append(_create_cylinder(-0.5 * scale, 0.35 * scale, -0.28 * scale, 0.04 * scale, 0.7 * scale, leg_color, name="Leg_FL"))
        parts.append(_create_cylinder(0.5 * scale, 0.35 * scale, -0.28 * scale, 0.04 * scale, 0.7 * scale, leg_color, name="Leg_FR"))
        parts.append(_create_cylinder(-0.5 * scale, 0.35 * scale, 0.28 * scale, 0.04 * scale, 0.7 * scale, leg_color, name="Leg_BL"))
        parts.append(_create_cylinder(0.5 * scale, 0.35 * scale, 0.28 * scale, 0.04 * scale, 0.7 * scale, leg_color, name="Leg_BR"))

    elif "car" in name or "vehicle" in name:
        body_color = c1
        wheel_color = COLOR_PALETTE["black"]
        parts.append(_create_box(0, 0.3 * scale, 0, 1.4 * scale, 0.3 * scale, 0.7 * scale, body_color, "Body"))
        parts.append(_create_box(-0.1 * scale, 0.55 * scale, 0, 0.7 * scale, 0.25 * scale, 0.6 * scale, body_color, "Cabin"))
        parts.append(_create_cylinder(-0.45 * scale, 0.15 * scale, -0.35 * scale, 0.15 * scale, 0.1 * scale, wheel_color, name="Wheel_FL"))
        parts.append(_create_cylinder(0.45 * scale, 0.15 * scale, -0.35 * scale, 0.15 * scale, 0.1 * scale, wheel_color, name="Wheel_FR"))
        parts.append(_create_cylinder(-0.45 * scale, 0.15 * scale, 0.35 * scale, 0.15 * scale, 0.1 * scale, wheel_color, name="Wheel_BL"))
        parts.append(_create_cylinder(0.45 * scale, 0.15 * scale, 0.35 * scale, 0.15 * scale, 0.1 * scale, wheel_color, name="Wheel_BR"))

    elif "sword" in name or "weapon" in name or "tool" in name:
        blade_color = COLOR_PALETTE["silver"]
        handle_color = c1
        parts.append(_create_box(0, 0.75 * scale, 0, 0.06 * scale, 1.0 * scale, 0.02 * scale, blade_color, "Blade"))
        parts.append(_create_box(0, 0.2 * scale, 0, 0.25 * scale, 0.04 * scale, 0.06 * scale, handle_color, "Guard"))
        parts.append(_create_cylinder(0, 0.05 * scale, 0, 0.03 * scale, 0.25 * scale, handle_color, name="Handle"))

    elif any(w in name for w in ["house", "building", "home", "room", "cottage", "architecture"]):
        wall_color = c1
        roof_color = _color_for("red") if "red" in colors or "roof" in name else c2
        floor_color = _color_for("wood") if "wood" in materials else COLOR_PALETTE["default"]
        door_color = _color_for("wood")
        window_color = _color_for("blue")

        # 1. Floor & Foundation
        parts.append(_create_box(0, 0.05 * scale, 0, 1.5 * scale, 0.1 * scale, 1.5 * scale, floor_color, "Floor"))

        # 2. Walls
        # Back wall (-Z)
        parts.append(_create_box(0, 0.55 * scale, -0.68 * scale, 1.4 * scale, 0.9 * scale, 0.08 * scale, wall_color, "Wall_Back"))
        # Left wall (-X)
        parts.append(_create_box(-0.68 * scale, 0.55 * scale, 0, 0.08 * scale, 0.9 * scale, 1.4 * scale, wall_color, "Wall_Left"))
        # Right wall (+X)
        parts.append(_create_box(0.68 * scale, 0.55 * scale, 0, 0.08 * scale, 0.9 * scale, 1.4 * scale, wall_color, "Wall_Right"))
        # Front wall right (+Z)
        parts.append(_create_box(0.35 * scale, 0.55 * scale, 0.68 * scale, 0.7 * scale, 0.9 * scale, 0.08 * scale, wall_color, "Wall_Front_R"))
        # Front wall left (+Z)
        parts.append(_create_box(-0.45 * scale, 0.55 * scale, 0.68 * scale, 0.4 * scale, 0.9 * scale, 0.08 * scale, wall_color, "Wall_Front_L"))
        # Wall over door
        parts.append(_create_box(-0.1 * scale, 0.85 * scale, 0.68 * scale, 0.3 * scale, 0.3 * scale, 0.08 * scale, wall_color, "Wall_Over_Door"))

        # 3. Door & Windows
        parts.append(_create_box(-0.1 * scale, 0.38 * scale, 0.68 * scale, 0.26 * scale, 0.6 * scale, 0.06 * scale, door_color, "Door"))
        parts.append(_create_box(-0.35 * scale, 0.65 * scale, -0.68 * scale, 0.35 * scale, 0.35 * scale, 0.06 * scale, window_color, "Window_Back"))
        parts.append(_create_box(0.68 * scale, 0.65 * scale, 0, 0.06 * scale, 0.35 * scale, 0.4 * scale, window_color, "Window_Right"))

        # 4. Roof & Gable
        parts.append(_create_box(0, 1.05 * scale, 0, 1.6 * scale, 0.1 * scale, 1.6 * scale, roof_color, "Roof_Base"))
        parts.append(_create_box(0, 1.22 * scale, 0, 1.3 * scale, 0.25 * scale, 1.3 * scale, roof_color, "Roof_Peak"))

    else:
        # Default compound object
        main_color = c1
        parts.append(_create_box(0, 0.5 * scale, 0, 0.8 * scale, 0.8 * scale, 0.8 * scale, main_color, "MainBox"))

    return parts


def generate_procedural_glb(
    spec: Any, path: Path, edits: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """Generate a procedural binary GLB asset matching spec and edits."""
    scale = 1.0
    colors = list(getattr(spec, "colors", []))
    materials = list(getattr(spec, "materials", []))
    obj_name = getattr(spec, "object", "model")

    if edits:
        if "width" in edits or "scale" in edits:
            scale = 1.2
        if "color" in edits:
            colors.insert(0, str(edits["color"]))

    mesh_parts = _build_parts(obj_name, colors, materials, scale=scale)

    bin_data = bytearray()
    nodes = []
    meshes = []
    materials_list = []
    accessors = []
    buffer_views = []

    total_polygons = 0

    for idx, part in enumerate(mesh_parts):
        pos_bytes = struct.pack(f"<{len(part.positions)}f", *part.positions)
        norm_bytes = struct.pack(f"<{len(part.normals)}f", *part.normals)
        idx_bytes = struct.pack(f"<{len(part.indices)}H", *part.indices)

        pos_offset = len(bin_data)
        bin_data.extend(pos_bytes)
        norm_offset = len(bin_data)
        bin_data.extend(norm_bytes)
        idx_offset = len(bin_data)
        bin_data.extend(idx_bytes)

        pos_count = len(part.positions) // 3
        idx_count = len(part.indices)
        total_polygons += idx_count // 3

        # Min/max for position accessor
        xs = part.positions[0::3]
        ys = part.positions[1::3]
        zs = part.positions[2::3]
        min_pos = [min(xs), min(ys), min(zs)]
        max_pos = [max(xs), max(max(ys), 0), max(zs)]

        pos_bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": pos_offset, "byteLength": len(pos_bytes), "target": 34962})

        norm_bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": norm_offset, "byteLength": len(norm_bytes), "target": 34962})

        idx_bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": idx_offset, "byteLength": len(idx_bytes), "target": 34963})

        pos_acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": pos_bv_idx,
                "componentType": 5126,
                "count": pos_count,
                "type": "VEC3",
                "min": min_pos,
                "max": max_pos,
            }
        )

        norm_acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": norm_bv_idx,
                "componentType": 5126,
                "count": pos_count,
                "type": "VEC3",
            }
        )

        idx_acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": idx_bv_idx,
                "componentType": 5123,
                "count": idx_count,
                "type": "SCALAR",
            }
        )

        mat_idx = len(materials_list)
        materials_list.append(
            {
                "name": f"Material_{part.name}",
                "pbrMetallicRoughness": {
                    "baseColorFactor": part.color,
                    "metallicFactor": part.metallic,
                    "roughnessFactor": part.roughness,
                },
            }
        )

        mesh_idx = len(meshes)
        meshes.append(
            {
                "name": part.name,
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_acc_idx, "NORMAL": norm_acc_idx},
                        "indices": idx_acc_idx,
                        "material": mat_idx,
                        "mode": 4,
                    }
                ],
            }
        )

        node_idx = len(nodes)
        nodes.append({"name": part.name, "mesh": mesh_idx})

    gltf = {
        "asset": {"version": "2.0", "generator": "ProceduralThreeDGenerator"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials_list,
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_chunk = _pad(json.dumps(gltf).encode("utf-8"), b" ")
    bin_chunk = _pad(bytes(bin_data), b"\x00")
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", _GLB_MAGIC, _GLB_VERSION, total_length))
        f.write(struct.pack("<II", len(json_chunk), _CHUNK_TYPE_JSON))
        f.write(json_chunk)
        f.write(struct.pack("<II", len(bin_chunk), _CHUNK_TYPE_BIN))
        f.write(bin_chunk)

    return {"polygon_count": total_polygons, "vertex_count": sum(len(p.positions) // 3 for p in mesh_parts)}


def write_placeholder_glb(path: Path) -> None:
    """Fallback simple placeholder GLB generator."""
    from app.models.schemas import ThreeDSpecification
    spec = ThreeDSpecification(object="chair", colors=["black", "red"])
    generate_procedural_glb(spec, path)


def estimate_polygon_count(complexity: str) -> int:
    return {"low": 500, "medium": 12000, "high": 45000}.get(complexity, 12000)

