#!/usr/bin/env python
"""Independently re-validates every generated sample straight from disk --
does not trust the quality score cached in metadata.json at generation
time. Re-loads scene.json and the exported mesh.glb (named nodes match
component ids) and re-runs all four Phase 6 checks.

Usage:
    uv run python tools/validate_dataset.py --dataset house
    uv run python tools/validate_dataset.py --dataset house --sample house_000003
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import trimesh

from schemas.dataset_config import DatasetYamlConfig
from schemas.scene import Scene
from validation.dataset import run_validation


def _list_sample_ids(root: Path) -> list[str]:
    scenes_dir = root / "scenes"
    if not scenes_dir.is_dir():
        return []
    return sorted(p.name for p in scenes_dir.iterdir() if (p / "scene.json").is_file())


def _load_meshes(root: Path, sample_id: str) -> dict[str, trimesh.Trimesh]:
    loaded = trimesh.load(root / "meshes" / sample_id / "mesh.glb")
    if isinstance(loaded, trimesh.Scene):
        return {name: geom for name, geom in loaded.geometry.items()}
    raise ValueError(f"{sample_id}: expected a multi-geometry glTF scene, got {type(loaded)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--sample", default=None, help="validate one sample id only (default: all)")
    args = parser.parse_args()

    config = DatasetYamlConfig.load(f"configs/dataset_{args.dataset}.yaml")
    root = Path(config.paths.root)
    sample_ids = [args.sample] if args.sample else _list_sample_ids(root)

    if not sample_ids:
        print(f"no samples found under {root}/scenes/")
        return

    total_pass = 0
    for sample_id in sample_ids:
        scene = Scene.model_validate_json((root / "scenes" / sample_id / "scene.json").read_text())
        meshes = _load_meshes(root, sample_id)
        meta = json.loads((root / "scenes" / sample_id / "metadata.json").read_text())

        quality, issues, passed = run_validation(scene, meshes, root, sample_id, meta["views"], config.quality)
        total_pass += int(passed)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {sample_id}: overall={quality.overall_quality:.3f} "
              f"(geometry={quality.geometry_quality:.2f} annotation={quality.annotation_quality:.2f} "
              f"segmentation={quality.segmentation_quality:.2f} physical={quality.physical_validity:.2f})")
        for issue in issues:
            print(f"    - {issue}")

    print(f"\n{total_pass}/{len(sample_ids)} samples pass (min_overall_quality={config.quality.min_overall_quality})")
    if total_pass < len(sample_ids):
        sys.exit(1)


if __name__ == "__main__":
    main()
