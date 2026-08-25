# Generation

## Phase log

1. **Schemas** (`schemas/`) -- strict Pydantic v2 models for geometry,
   materials, components, relationships, scenes, cameras, quality, and the
   dataset YAML config. Nothing downstream writes a field that isn't
   validated here.
2. **Renderer core** (`generators/render/`) -- pinhole camera, numpy
   z-buffer rasterizer, Lambertian shading, RGB/depth/segmentation from one
   shared pass. No Blender, no GPU (see `docs/ARCHITECTURE.md`).
3. **Component generators** (`generators/house/`) -- `wall.py`, `door.py`,
   `window.py`, `floor.py`, `ceiling.py`. Each returns a real
   `trimesh.Trimesh` plus the exact `schemas.component.Component` metadata
   used to build it (never estimated after the fact).
4. **Room assembly** (`generators/house/room.py`) -- composes components into
   one `Scene`, with explicit `Relationship`s (`attached_to`, `supports`,
   `inserted_into`) and named `Anchor`s, not just coordinates.
5. **Sample orchestrator** (`generators/house/sample.py`) -- one call,
   `generate_sample(config, sample_id, template_id, seed)`, builds the scene,
   exports meshes, renders every configured view, runs validation, and
   writes every output file for one sample. This is the unit of work.
6. **Validation** (`validation/`) -- geometry, physical plausibility,
   annotation completeness, render completeness. See `docs/VALIDATION.md`.
7. **First milestone** -- one fully validated sample, inspected by hand
   (`tools/inspect_dataset.py`) before scaling to a batch.
8. **Small batch + tooling** -- `scripts/generate_house_dataset.py` for
   batch generation, `tools/validate_dataset.py` for independent
   re-validation from disk, `tools/statistics.py` for dataset-wide summaries.

## Templates and splits

`generators/house/house.py::TEMPLATES` defines a fixed set of `RoomTemplate`s
-- overall room shape ranges (`width_range`/`depth_range`/`height_range`),
which wall carries the door (`door_wall`), and which walls carry windows
(`window_walls`, may be empty -- e.g. `template_basement_room` has none).
Per-sample values (exact dimensions, door/window offsets, materials) are
drawn from those ranges, seeded by `f"{seed}:{sample_id}:..."` so a run is
fully reproducible.

**Split is assigned per template, not per sample**
(`split_for_template(template_id, split_config)` -- a stable sha256 hash of
the template id mapped into `[0, 1)` against the configured train/validation/
test ratios). This means every sample built from `template_narrow_hall` lands
in the same split forever, regardless of seed or sample count -- so
near-duplicate rooms from the same template can never leak across splits.

**Known limitation**: this only approximates the configured ratio (0.8/0.1/0.1
in `configs/dataset_house.yaml`) as the number of *distinct templates* grows.
With too few templates the hash outcome can degenerate (this actually
happened during development: the original 4 templates all hashed into
`train`, leaving `validation`/`test` permanently empty). The template pool
was expanded to 12 to fix it (8 train / 2 validation / 2 test by template
count, verified in `tests/`... see the `split_for_template` calls in
`scripts/generate_house_dataset.py`'s docstring). If you add templates,
recompute the split distribution before relying on it:

```bash
uv run python -c "
from generators.house.house import list_template_ids, split_for_template
from schemas.dataset_config import DatasetYamlConfig
from collections import Counter
config = DatasetYamlConfig.load('configs/dataset_house.yaml')
print(Counter(split_for_template(t, config.split) for t in list_template_ids()))
"
```

Batch generation round-robins `templates[index % len(templates)]`
(`scripts/generate_house_dataset.py`), so sample *counts* per split track
template *counts* per split, not the configured ratio directly -- with 12
templates (8/2/2) a batch is roughly 67%/17%/17% train/validation/test by
sample, not 80/10/10. Add more validation/test-bucket templates (or weight
the round-robin) if you need the sample-level ratio to track the configured
one more tightly at scale.

## Running generation

```bash
# One sample (first milestone / smoke test)
uv run python scripts/generate_one_sample.py --id house_000001 --template template_small_studio --seed 0

# A batch, round-robining across all templates
uv run python scripts/generate_house_dataset.py --count 16 --seed 42

# Resume a partial batch (skips sample ids that already have metadata.json)
uv run python scripts/generate_house_dataset.py --count 200 --seed 42 --resume

# Parallel (ProcessPoolExecutor) -- default is sequential; this is a shared,
# disk-constrained host (docs/TROUBLESHOOTING.md), so only raise --workers
# deliberately
uv run python scripts/generate_house_dataset.py --count 200 --seed 42 --workers 4
```

## Output layout

Each sample writes into a typed pool (not per-sample subfolders mixed with
other types), keyed by `sample_id` under `datasets/house/`:

```
scenes/<sample_id>/scene.json         # schemas.scene.Scene, ground truth
scenes/<sample_id>/metadata.json      # sample_id, template_id, split, quality, component_counts, mesh, views
meshes/<sample_id>/mesh.obj
meshes/<sample_id>/mesh.glb           # named nodes == component ids
renders/<sample_id>/<view>.png
depth/<sample_id>/<view>.npy          # camera-space z-buffer, float32
depth/<sample_id>/<view>_preview.png  # 8-bit visualization only
segmentation/<sample_id>/<view>_semantic.png   # schemas.taxonomy.SEMANTIC_CLASS_IDS
segmentation/<sample_id>/<view>_instance.png   # 1-based per-component instance id
annotations/<sample_id>/<view>_camera.json     # schemas.camera.Camera, exact params
metadata/index.jsonl                  # one schemas.dataset_sample.DatasetSample row per view
train/index.jsonl                     # rows filtered by split (tools/build_split_indexes.py)
validation/index.jsonl
test/index.jsonl
rejected/index.jsonl
rejected/<sample_id>/rejection_reason.json    # only for samples that failed validation
```

`views` is configured in `configs/dataset_house.yaml::generation.views`
(default `front, back, left, right, top, isometric, random`). Every view of
a sample shares the same `split` and `quality` (computed once per sample,
copied onto each view's `DatasetSample` row).

`tools/build_split_indexes.py` (also called automatically at the end of
`generate_house_dataset.py`) is a separate, idempotent pass over
`metadata/index.jsonl` -- deliberately deferred from the per-sample write,
since a sample's final split can only be known after Phase 6 validation
runs (`split="rejected"` overrides the template split on failure).
