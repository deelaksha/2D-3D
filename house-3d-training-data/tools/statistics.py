#!/usr/bin/env python
"""Dataset-wide statistics: split sizes, category distribution, component
type distribution vs the configured target (prompt.txt #40), mesh size and
quality score summaries. Reads only metadata/index.jsonl and per-sample
metadata.json -- no re-rendering or re-validation (see tools/validate_dataset.py
for that).

Usage:
    uv run python tools/statistics.py --dataset house
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schemas.dataset_config import DatasetYamlConfig


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    args = parser.parse_args()

    config = DatasetYamlConfig.load(f"configs/dataset_{args.dataset}.yaml")
    root = Path(config.paths.root)
    index_path = root / "metadata" / "index.jsonl"

    if not index_path.is_file():
        print(f"no index at {index_path}")
        return

    rows = [json.loads(line) for line in index_path.read_text().splitlines() if line.strip()]
    sample_ids = sorted({row["id"].rsplit("_", 1)[0] for row in rows})

    split_counts = Counter(row["split"] for row in rows)
    category_counts = Counter(row["category"] for row in rows)

    component_counts: Counter[str] = Counter()
    quality_scores: list[float] = []
    vertex_counts: list[int] = []
    face_counts: list[int] = []
    for sample_id in sample_ids:
        meta_path = root / "scenes" / sample_id / "metadata.json"
        if not meta_path.is_file():
            continue
        meta = json.loads(meta_path.read_text())
        component_counts.update(meta["component_counts"])
        quality_scores.append(meta["quality"]["overall_quality"])
        vertex_counts.append(meta["mesh"]["vertex_count"])
        face_counts.append(meta["mesh"]["face_count"])

    print(f"dataset: {args.dataset}  samples: {len(sample_ids)}  rendered views: {len(rows)}")
    print("\nsplit (by rendered view):")
    for split, count in split_counts.most_common():
        print(f"  {split:12s} {count}")

    print("\ncategory:")
    for category, count in category_counts.most_common():
        print(f"  {category:12s} {count}")

    total_components = sum(component_counts.values()) or 1
    print("\ncomponent type distribution (actual vs configured target):")
    for comp_type, target in config.component_priority.items():
        actual = component_counts.get(comp_type, 0) / total_components
        print(f"  {comp_type:24s} actual={actual:.2%}  target={target:.2%}")

    if quality_scores:
        print(f"\nquality: mean={sum(quality_scores) / len(quality_scores):.3f} "
              f"min={min(quality_scores):.3f} max={max(quality_scores):.3f}")
    if vertex_counts:
        print(f"mesh size: mean {sum(vertex_counts) / len(vertex_counts):.0f}v / "
              f"{sum(face_counts) / len(face_counts):.0f}f per sample")


if __name__ == "__main__":
    main()
