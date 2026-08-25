#!/usr/bin/env python
"""CLI: generate exactly one house sample (all configured views) and print a
summary. This is the Phase 5 smoke-test entry point -- prompt.txt's "DATA
FIRST" mandate: get one validated complete sample working before scaling.

Usage:
    uv run python scripts/generate_one_sample.py --id house_000001 --template template_small_studio --seed 0
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from generators.house.house import list_template_ids
from generators.house.sample import generate_sample
from schemas.dataset_config import DatasetYamlConfig


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/dataset_house.yaml")
    parser.add_argument("--id", dest="sample_id", default="house_000001")
    parser.add_argument("--template", default=list_template_ids()[0])
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    config = DatasetYamlConfig.load(args.config)
    samples = generate_sample(config, sample_id=args.sample_id, template_id=args.template, seed=args.seed)

    print(f"generated {len(samples)} view(s) for {args.sample_id} (template={args.template}, seed={args.seed})")
    for s in samples:
        print(f"  {s.id}: split={s.split} image={s.image} depth={s.depth} segmentation={s.segmentation}")


if __name__ == "__main__":
    main()
