# Training

**Not implemented yet.** Per `README.md`'s guiding principle -- "data first,
model second" -- no training loop, fine-tuning script, or model code exists
in this repo. This is scaffolding for that later phase, documented now so
its shape is clear before it's built.

## What exists today

- `training/{experiments,datasets,runs,checkpoints,logs}/` -- empty,
  `.gitkeep`-only directories, gitignored contents (per `README.md`'s
  layout table). Nothing writes to them yet.
- `evaluation/` -- same, empty placeholder for base-vs-fine-tuned model
  comparison.
- `preprocessing/` -- has an `__init__.py` but no normalization logic yet.
  Intended to run after generation, before the train/val/test split is
  consumed by a training run (e.g. image normalization, resizing to a
  model's expected input, packing `scene.json`/`camera.json` into whatever
  format a specific trainer wants) -- deliberately kept separate from
  generation itself, since generation output (`docs/DATASET_SCHEMA.md`) is
  meant to be a stable, trainer-agnostic ground truth format.

## Before starting this phase

- A real batch should exist and pass validation end to end
  (`docs/VALIDATION.md`, `docs/GENERATION.md`) -- training against
  `datasets/house/rejected/` samples defeats the point of validating them.
- `train/index.jsonl` / `validation/index.jsonl` / `test/index.jsonl`
  (`tools/build_split_indexes.py`) are the entrypoint: each row is a
  `schemas.dataset_sample.DatasetSample` with paths relative to
  `paths.root`, ready to feed a `Dataset`/`DataLoader` without re-deriving
  anything from `scene.json`.
- Check `tools/statistics.py --dataset house` output against
  `component_priority` in `configs/dataset_house.yaml` before training --
  it's an advisory target, not enforced, so a real batch may be skewed
  relative to it (e.g. as of the current small batch, `roof`/`staircase`/
  `column`/`beam`/`balcony`/`complete_room_or_house` are all 0% because
  those generators don't exist yet -- see `docs/ADDING_CUSTOM_DATA.md`).
