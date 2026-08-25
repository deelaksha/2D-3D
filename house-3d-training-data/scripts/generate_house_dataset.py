#!/usr/bin/env python
"""Batch-generate N house samples, round-robining across templates
(prompt.txt #30 -- template determines the train/validation/test split, so
spreading samples across templates keeps every split populated as the
dataset grows). Rebuilds the per-split index files at the end.

Usage:
    uv run python scripts/generate_house_dataset.py --count 16 --seed 42
    uv run python scripts/generate_house_dataset.py --count 50 --seed 42 --resume
"""

from __future__ import annotations

import argparse
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from generators.house.house import list_template_ids
from generators.house.sample import generate_sample
from schemas.dataset_config import DatasetYamlConfig
from tools.build_split_indexes import build_split_indexes


def _sample_id(index: int) -> str:
    return f"house_{index:06d}"


def _already_generated(root: Path, sample_id: str) -> bool:
    return (root / "scenes" / sample_id / "metadata.json").is_file()


def _generate_one(config_path: str, sample_id: str, template_id: str, seed: int) -> tuple[str, str, float]:
    config = DatasetYamlConfig.load(config_path)
    samples = generate_sample(config, sample_id=sample_id, template_id=template_id, seed=seed)
    return sample_id, samples[0].split, samples[0].quality.overall_quality


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/dataset_house.yaml")
    parser.add_argument("--count", type=int, required=True, help="number of samples to generate")
    parser.add_argument("--start-index", type=int, default=1)
    parser.add_argument("--seed", type=int, default=0, help="base seed; combined with sample_id for reproducibility")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--resume", action="store_true", help="skip sample ids that already exist on disk")
    args = parser.parse_args()

    config = DatasetYamlConfig.load(args.config)
    root = Path(config.paths.root)
    templates = list_template_ids()

    jobs = []
    for i in range(args.count):
        index = args.start_index + i
        sample_id = _sample_id(index)
        if args.resume and _already_generated(root, sample_id):
            continue
        template_id = templates[index % len(templates)]
        jobs.append((sample_id, template_id))

    print(f"generating {len(jobs)} sample(s) ({args.count - len(jobs)} skipped by --resume)")

    results = []
    if args.workers <= 1:
        for sample_id, template_id in jobs:
            results.append(_generate_one(args.config, sample_id, template_id, args.seed))
            print(f"  {results[-1][0]}: split={results[-1][1]} quality={results[-1][2]:.3f}")
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [
                pool.submit(_generate_one, args.config, sample_id, template_id, args.seed)
                for sample_id, template_id in jobs
            ]
            for future in futures:
                results.append(future.result())
                print(f"  {results[-1][0]}: split={results[-1][1]} quality={results[-1][2]:.3f}")

    counts = build_split_indexes(root)
    print("split totals (by rendered view, not sample):")
    for split, count in counts.items():
        print(f"  {split}: {count}")


if __name__ == "__main__":
    main()
