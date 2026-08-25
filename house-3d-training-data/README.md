# house-3d-training-data

Reusable training-data generation and management system for architectural /
house-related 2D-to-3D AI training. Fully independent from
`/home/sonic-claude2/mythra/2D-3D` (a separate, unrelated app — WoodKit
Designer) — no code, data, or assets are shared.

Pipeline this project produces ground truth for:

```
2D Image -> component understanding -> semantic component -> dimensions
   -> geometry -> 3D mesh -> position -> rotation -> relationships -> assembly
```

**Data first. Model second.** See `prompt` (project spec) for the full
design brief this repo implements, and `docs/` for living documentation.

## Status

Implementation proceeds in phases (see `docs/GENERATION.md` for the phase
log). Only `datasets/house/` is implemented; every other `datasets/*`
category is an empty placeholder for future work — no synthetic data is
generated for categories that aren't actively being built.

## Requirements

- Python 3.11+ (managed with `uv`)
- No Blender, no GPU, no sudo needed. Mesh generation is `numpy` +
  `trimesh`; rendering (RGB/depth/segmentation) is a from-scratch software
  rasterizer in `generators/render/` — everything runs in one venv, one
  interpreter. See `docs/ARCHITECTURE.md` for why.
- Keep resolution/sample counts modest (see `configs/dataset_house.yaml`) —
  this is a shared, disk-constrained machine (see `docs/TROUBLESHOOTING.md`).

## Quick start

```bash
uv sync
uv run python scripts/generate_one_sample.py   # first milestone: one full sample
uv run python scripts/generate_house_dataset.py --count 16 --seed 42   # small batch
uv run python tools/validate_dataset.py --dataset house
uv run python tools/inspect_dataset.py --dataset house --sample 0
uv run python tools/statistics.py --dataset house
```

## Layout

```
datasets/          per-category data (only house/ is implemented)
generators/         pure-Python procedural generators: house/*.py (mesh + scene
                    assembly) and render/*.py (camera, rasterizer, shading) --
                    run in this project's own venv, no external application
schemas/            Pydantic schemas shared by generators, validation, and tools
validation/         geometry / annotation / physical-plausibility / dataset checks
preprocessing/       normalization run after generation, before train/val/test split
training/           LoRA/QLoRA fine-tuning runs, checkpoints, logs (gitignored)
evaluation/          base-vs-fine-tuned model comparison
tools/               CLI utilities: inspect, validate, statistics, build_split_indexes
configs/             per-dataset YAML config (name/category/version/paths/splits)
scripts/             sample generation entrypoints (generate_one_sample.py, generate_house_dataset.py)
docs/                ARCHITECTURE, DATASET_SCHEMA, GENERATION, VALIDATION, TRAINING, ADDING_CUSTOM_DATA, TROUBLESHOOTING
tests/               pytest suite
outputs/             scratch outputs (gitignored)
```

## Adding a future dataset (e.g. furniture)

See `docs/ADDING_CUSTOM_DATA.md`. In short: add
`datasets/<name>/{raw,generated,processed,...}`, a
`configs/dataset_<name>.yaml`, and generators under `generators/<name>/` —
the shared `schemas/`, `validation/`, and `tools/` are dataset-agnostic and
require no changes.
