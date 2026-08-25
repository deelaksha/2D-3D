"""Phase 6 -- render completeness checks (prompt.txt #46 segmentation_quality)
plus the top-level orchestrator that combines all four validation dimensions
into one QualityScore and decides accept/reject.

Rejected samples are not deleted or silently dropped: their files stay where
they were written (typed-pool layout, prompt.txt #29), their index.jsonl
rows get split="rejected", and a rejection_reason.json documenting exactly
why is written under `<root>/rejected/<sample_id>/` (prompt.txt #46 --
rejection with reasons, not a silent drop).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

from schemas.camera import Camera
from schemas.dataset_config import QualityConfig
from schemas.quality import QualityScore
from schemas.scene import Scene
from validation.annotation import check_annotation
from validation.geometry import check_geometry
from validation.physical import check_physical

MIN_NONBACKGROUND_FRACTION = 0.02


def check_render_completeness(root: Path, sample_id: str, views: list[str]) -> tuple[float, list[str]]:
    issues: list[str] = []
    if not views:
        return 0.0, ["no views configured"]

    for view in views:
        render_path = root / "renders" / sample_id / f"{view}.png"
        depth_path = root / "depth" / sample_id / f"{view}.npy"
        sem_path = root / "segmentation" / sample_id / f"{view}_semantic.png"
        inst_path = root / "segmentation" / sample_id / f"{view}_instance.png"
        camera_path = root / "annotations" / sample_id / f"{view}_camera.json"

        for label, path in (
            ("render", render_path), ("depth", depth_path),
            ("semantic segmentation", sem_path), ("instance segmentation", inst_path),
            ("camera", camera_path),
        ):
            if not path.is_file() or path.stat().st_size == 0:
                issues.append(f"{view}: missing or empty {label} file ({path})")

        if depth_path.is_file():
            depth = np.load(depth_path)
            nonzero_frac = float((depth > 0).mean())
            if nonzero_frac < MIN_NONBACKGROUND_FRACTION:
                issues.append(f"{view}: depth is almost entirely background ({nonzero_frac:.3%} non-background)")

        if sem_path.is_file():
            semantic = np.array(Image.open(sem_path))
            if len(np.unique(semantic)) < 2:
                issues.append(f"{view}: segmentation has no foreground classes")

        if camera_path.is_file():
            try:
                Camera.model_validate_json(camera_path.read_text())
            except Exception as exc:
                issues.append(f"{view}: camera.json does not validate ({exc})")

    total_checks = len(views) * 3  # files-present, depth-coverage, segmentation-content (camera counted with files)
    score = max(0.0, (total_checks - len(issues)) / total_checks)
    return score, issues


def run_validation(
    scene: Scene,
    meshes: dict[str, trimesh.Trimesh],
    root: Path,
    sample_id: str,
    views: list[str],
    quality_config: QualityConfig,
) -> tuple[QualityScore, list[str], bool]:
    geometry_score, geometry_issues = check_geometry(scene, meshes)
    physical_score, physical_issues = check_physical(scene)
    annotation_score, annotation_issues = check_annotation(scene)
    segmentation_score, segmentation_issues = check_render_completeness(root, sample_id, views)

    quality = QualityScore(
        geometry_quality=geometry_score,
        annotation_quality=annotation_score,
        segmentation_quality=segmentation_score,
        physical_validity=physical_score,
    )
    issues = [
        *(f"[geometry] {i}" for i in geometry_issues),
        *(f"[physical] {i}" for i in physical_issues),
        *(f"[annotation] {i}" for i in annotation_issues),
        *(f"[render] {i}" for i in segmentation_issues),
    ]
    passed = quality.overall_quality >= quality_config.min_overall_quality
    return quality, issues, passed


def write_rejection_reason(root: Path, sample_id: str, quality: QualityScore, issues: list[str]) -> None:
    rejected_dir = root / "rejected" / sample_id
    rejected_dir.mkdir(parents=True, exist_ok=True)
    (rejected_dir / "rejection_reason.json").write_text(json.dumps({
        "sample_id": sample_id,
        "quality": json.loads(quality.model_dump_json()),
        "issues": issues,
    }, indent=2))
