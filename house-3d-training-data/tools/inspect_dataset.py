#!/usr/bin/env python
"""Human-readable dump of one generated sample: components, materials,
relationships, anchors, quality scores, and output file paths. For quickly
sanity-checking a sample without hand-reading JSON (prompt.txt's
"inspect at every stage" mandate).

Usage:
    uv run python tools/inspect_dataset.py --dataset house --sample 0
    uv run python tools/inspect_dataset.py --dataset house --sample house_000003
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schemas.dataset_config import DatasetYamlConfig
from schemas.scene import Scene


def _resolve_sample_id(root: Path, sample_arg: str) -> str:
    if (root / "scenes" / sample_arg / "metadata.json").is_file():
        return sample_arg

    index_path = root / "metadata" / "index.jsonl"
    seen: list[str] = []
    for line in index_path.read_text().splitlines():
        sample_id = json.loads(line)["id"].rsplit("_", 1)[0]
        if sample_id not in seen:
            seen.append(sample_id)
    try:
        return seen[int(sample_arg)]
    except (ValueError, IndexError) as exc:
        raise SystemExit(f"could not resolve --sample {sample_arg!r} (have {len(seen)} samples)") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--sample", required=True, help="0-based index into metadata/index.jsonl, or a sample id")
    args = parser.parse_args()

    config = DatasetYamlConfig.load(f"configs/dataset_{args.dataset}.yaml")
    root = Path(config.paths.root)
    sample_id = _resolve_sample_id(root, args.sample)

    meta = json.loads((root / "scenes" / sample_id / "metadata.json").read_text())
    scene = Scene.model_validate_json((root / "scenes" / sample_id / "scene.json").read_text())

    print(f"=== {sample_id} (template={meta['template_id']}, split={meta['split']}) ===")
    print(f"quality: {json.dumps(meta['quality'])}")
    print(f"mesh: {meta['mesh']['vertex_count']}v / {meta['mesh']['face_count']}f")
    print()
    print(f"components ({len(scene.components)}):")
    for c in scene.components:
        material = c.material.name if c.material else "-"
        dims = f"{c.dimensions.width:.2f}x{c.dimensions.height:.2f}x{c.dimensions.depth:.2f}m"
        anchors = ",".join(a.name for a in c.anchors) or "-"
        print(f"  {c.id:28s} {c.type:8s} {c.subtype or '-':16s} material={material:8s} dims={dims:18s} anchors=[{anchors}]")
    print()
    print(f"relationships ({len(scene.relationships)}):")
    for r in scene.relationships:
        print(f"  {r.subject} --{r.predicate}--> {r.object}")
    print()
    print(f"views ({len(meta['views'])}): {', '.join(meta['views'])}")
    for view in meta["views"]:
        render = root / "renders" / sample_id / f"{view}.{config.generation.image_format}"
        depth = root / "depth" / sample_id / f"{view}.npy"
        seg = root / "segmentation" / sample_id / f"{view}_semantic.png"
        ok = all(p.is_file() for p in (render, depth, seg))
        print(f"  {view:12s} {'OK' if ok else 'MISSING'}  {render}")


if __name__ == "__main__":
    main()
