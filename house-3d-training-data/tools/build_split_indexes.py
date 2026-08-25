#!/usr/bin/env python
"""Groups datasets/<name>/metadata/index.jsonl rows by `split` into
datasets/<name>/{train,validation,test,rejected}/index.jsonl.

Deferred from Phase 5 on purpose: split assignment can only be finalized
after Phase 6 validation runs (a sample's split becomes "rejected" if it
fails quality checks), so building these files is a separate, idempotent
pass over the master index rather than something generate_sample() does
incrementally.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from schemas.dataset_config import DatasetYamlConfig


def build_split_indexes(root: Path) -> dict[str, int]:
    index_path = root / "metadata" / "index.jsonl"
    rows_by_split: dict[str, list[str]] = defaultdict(list)

    if index_path.is_file():
        for line in index_path.read_text().splitlines():
            if not line.strip():
                continue
            split = json.loads(line)["split"]
            rows_by_split[split].append(line)

    counts: dict[str, int] = {}
    for split in ("train", "validation", "test", "rejected"):
        split_dir = root / split
        split_dir.mkdir(parents=True, exist_ok=True)
        rows = rows_by_split.get(split, [])
        (split_dir / "index.jsonl").write_text("\n".join(rows) + ("\n" if rows else ""))
        counts[split] = len(rows)
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="configs/dataset_house.yaml")
    args = parser.parse_args()

    config = DatasetYamlConfig.load(args.config)
    counts = build_split_indexes(Path(config.paths.root))
    for split, count in counts.items():
        print(f"{split}: {count} rows")


if __name__ == "__main__":
    main()
