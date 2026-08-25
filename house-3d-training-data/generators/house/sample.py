"""Phase 5 -- builds one full house-dataset sample end-to-end: assemble the
scene, render every configured view (RGB + depth + segmentation + exact
camera params), export the mesh, and write scene.json/metadata.json/index
rows to disk. No quality scoring or accept/reject here -- that is
Phase 6 (validation/).

Directory layout under `paths.root` (prompt.txt #3/#28/#29):
  scenes/<sample_id>/scene.json, metadata.json
  meshes/<sample_id>/mesh.obj, mesh.glb
  renders/<sample_id>/<view>.<image_format>
  depth/<sample_id>/<view>.npy, <view>_preview.png
  segmentation/<sample_id>/<view>_semantic.png, <view>_instance.png
  annotations/<sample_id>/<view>_camera.json
  metadata/index.jsonl   -- one row per (sample_id, view), split assigned once per sample
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import trimesh

from generators.house.house import build_house_sample, split_for_template
from generators.house.materials import resolve_color
from generators.render.camera import RenderCamera
from generators.render.io import save_depth, save_rgb, save_segmentation
from generators.render.rasterizer import downsample, rasterize
from schemas.camera import Camera
from schemas.dataset_config import DatasetYamlConfig
from schemas.dataset_sample import DatasetSample
from schemas.geometry import Vec3
from schemas.scene import Scene
from schemas.taxonomy import semantic_class_id
from validation.dataset import run_validation, write_rejection_reason

VIEW_PRESETS: dict[str, tuple[float, float]] = {
    "front": (0.0, 20.0),
    "back": (180.0, 20.0),
    "left": (-90.0, 20.0),
    "right": (90.0, 20.0),
    "top": (0.0, 85.0),
    "isometric": (45.0, 35.0),
}


def _orbit_position(center: np.ndarray, distance: float, az_deg: float, el_deg: float) -> tuple[float, float, float]:
    az, el = np.radians(az_deg), np.radians(el_deg)
    x = center[0] + distance * np.cos(el) * np.sin(az)
    y = center[1] - distance * np.cos(el) * np.cos(az)
    z = center[2] + distance * np.sin(el)
    return float(x), float(y), float(z)


def _fit_distance(radius: float, fov_degrees: float, margin: float) -> float:
    return radius / np.sin(np.radians(fov_degrees) / 2.0) * margin


def _view_camera(
    center: np.ndarray, radius: float, view_name: str, rng: random.Random,
    fov_degrees: float, near: float, far: float, width: int, height: int,
) -> RenderCamera:
    if view_name == "random":
        az, el = rng.uniform(0.0, 360.0), rng.uniform(15.0, 65.0)
        margin = rng.uniform(1.15, 1.5)
    else:
        if view_name not in VIEW_PRESETS:
            raise ValueError(f"unknown view {view_name!r}, expected one of {[*VIEW_PRESETS, 'random']}")
        az, el = VIEW_PRESETS[view_name]
        margin = 1.25
    distance = _fit_distance(radius, fov_degrees, margin)
    position = _orbit_position(center, distance, az, el)
    return RenderCamera(
        position=position, look_at=tuple(center.tolist()), up=(0.0, 0.0, 1.0),
        fov_degrees=fov_degrees, near=near, far=far, width=width, height=height,
    )


def _scene_bounds(scene: Scene) -> tuple[np.ndarray, np.ndarray]:
    mins = np.array([c.bounding_box.min.as_tuple() for c in scene.components])
    maxs = np.array([c.bounding_box.max.as_tuple() for c in scene.components])
    return mins.min(axis=0), maxs.max(axis=0)


def _gather_render_arrays(scene: Scene, meshes: dict[str, trimesh.Trimesh]):
    all_tris, all_colors, all_sem, all_inst = [], [], [], []
    for instance_id, comp in enumerate(scene.components, start=1):
        mesh = meshes[comp.id]
        tris = mesh.vertices[mesh.faces]
        n = tris.shape[0]
        all_tris.append(tris)
        all_colors.append(np.tile(resolve_color(comp.material), (n, 1)))
        all_sem.append(np.full(n, semantic_class_id(comp.type), dtype=np.uint16))
        all_inst.append(np.full(n, instance_id, dtype=np.uint16))
    return (
        np.concatenate(all_tris, axis=0),
        np.concatenate(all_colors, axis=0),
        np.concatenate(all_sem, axis=0),
        np.concatenate(all_inst, axis=0),
    )


def _export_mesh(meshes: dict[str, trimesh.Trimesh], obj_path: Path, glb_path: Path) -> tuple[int, int]:
    scene = trimesh.Scene()
    for comp_id, mesh in meshes.items():
        scene.add_geometry(mesh, node_name=comp_id, geom_name=comp_id)
    obj_path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(str(obj_path))
    scene.export(str(glb_path))
    combined = trimesh.util.concatenate(list(meshes.values()))
    return len(combined.vertices), len(combined.faces)


def _component_counts(scene: Scene) -> dict[str, int]:
    counts: dict[str, int] = {}
    for c in scene.components:
        counts[c.type] = counts.get(c.type, 0) + 1
    return counts


def generate_sample(
    config: DatasetYamlConfig,
    sample_id: str,
    template_id: str,
    seed: int,
) -> list[DatasetSample]:
    result = build_house_sample(sample_id=sample_id, template_id=template_id, seed=seed)
    scene, meshes = result.scene, result.meshes

    root = Path(config.paths.root)
    scene_dir = root / "scenes" / sample_id
    mesh_dir = root / "meshes" / sample_id
    for d in (scene_dir, mesh_dir, root / "renders" / sample_id, root / "depth" / sample_id,
              root / "segmentation" / sample_id, root / "annotations" / sample_id):
        d.mkdir(parents=True, exist_ok=True)

    scene_path = scene_dir / "scene.json"
    scene_path.write_text(scene.model_dump_json(indent=2))

    obj_path = mesh_dir / "mesh.obj"
    glb_path = mesh_dir / "mesh.glb"
    vertex_count, face_count = _export_mesh(meshes, obj_path, glb_path)

    triangles, base_colors, semantic_ids, instance_ids = _gather_render_arrays(scene, meshes)
    bbox_min, bbox_max = _scene_bounds(scene)
    center = (bbox_min + bbox_max) / 2.0
    radius = float(np.linalg.norm(bbox_max - bbox_min)) / 2.0

    gen = config.generation
    out_width, out_height = gen.resolution
    rng = random.Random(f"{seed}:{sample_id}:views")
    template_split = split_for_template(template_id, config.split)

    samples: list[DatasetSample] = []
    for view_name in gen.views:
        cam = _view_camera(
            center, radius, view_name, rng, gen.fov_degrees, gen.near, gen.far,
            out_width * gen.supersample, out_height * gen.supersample,
        )
        fb = rasterize(cam, triangles, base_colors, semantic_ids, instance_ids,
                        light_direction=gen.light_direction, ambient=gen.ambient)
        fb = downsample(fb, gen.supersample)

        image_rel = f"renders/{sample_id}/{view_name}.{gen.image_format}"
        depth_rel = f"depth/{sample_id}/{view_name}.npy"
        depth_preview_rel = f"depth/{sample_id}/{view_name}_preview.png"
        sem_rel = f"segmentation/{sample_id}/{view_name}_semantic.png"
        inst_rel = f"segmentation/{sample_id}/{view_name}_instance.png"
        camera_rel = f"annotations/{sample_id}/{view_name}_camera.json"

        save_rgb(fb, root / image_rel)
        save_depth(fb, root / depth_rel, preview_path=root / depth_preview_rel)
        save_segmentation(fb, root / sem_rel, root / inst_rel)

        camera_schema = Camera(
            view_name=view_name,
            position=Vec3.from_tuple(tuple(cam.position.tolist())),
            look_at=Vec3.from_tuple(tuple(cam.look_at.tolist())),
            up=Vec3.from_tuple(tuple(cam.up.tolist())),
            fov_degrees=cam.fov_degrees, near=cam.near, far=cam.far,
            resolution=(fb.width, fb.height),
        )
        (root / camera_rel).write_text(camera_schema.model_dump_json(indent=2))

        samples.append(DatasetSample(
            id=f"{sample_id}_{view_name}",
            image=image_rel,
            mesh=str(obj_path.relative_to(root)),
            scene=str(scene_path.relative_to(root)),
            depth=depth_rel,
            segmentation=sem_rel,
            camera=camera_rel,
            category=config.dataset.category,
            split=template_split,
        ))

    quality, issues, passed = run_validation(scene, meshes, root, sample_id, gen.views, config.quality)
    final_split = template_split if passed else "rejected"
    samples = [s.model_copy(update={"split": final_split, "quality": quality}) for s in samples]
    if not passed:
        write_rejection_reason(root, sample_id, quality, issues)

    metadata_dir = root / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    with open(metadata_dir / "index.jsonl", "a") as f:
        for s in samples:
            f.write(s.model_dump_json() + "\n")

    (scene_dir / "metadata.json").write_text(json.dumps({
        "sample_id": sample_id,
        "template_id": template_id,
        "category": config.dataset.category,
        "split": final_split,
        "quality": json.loads(quality.model_dump_json()),
        "component_counts": _component_counts(scene),
        "mesh": {"vertex_count": vertex_count, "face_count": face_count},
        "views": gen.views,
    }, indent=2))

    return samples
