# Adding a new dataset category

`schemas/`, `validation/`, and `generators/render/` are dataset-agnostic --
none of them import anything from `generators/house/`. Adding a new category
(e.g. `furniture`) means adding generators and a config, not touching shared
code, as long as the new category's ground truth fits the same schemas
(`Scene`/`Component`/`Relationship`/`Camera`/`QualityScore`).

`datasets/{architecture,custom,furniture,mechanical,vehicles}/` already
exist as empty placeholders (`.gitkeep` only) for exactly this -- see
`README.md`'s "Status" section. None of them have generators wired up yet;
only `house/` is implemented.

## Steps

1. **Pick component types.** If your category's components fit the existing
   taxonomy (`schemas/taxonomy.py`), use it as-is. If not, extend the
   relevant set there (e.g. add to `INTERIOR_OBJECT_TYPES`) rather than
   inventing a parallel taxonomy -- `Component.type` validates against
   `ALL_COMPONENT_TYPES`, and segmentation needs a
   `SEMANTIC_CLASS_IDS` entry (stable, append-only -- never renumber
   existing ids, only add new ones).

2. **Write generators** under `generators/<name>/`, mirroring
   `generators/house/`:
   - One function per component type that returns
     `(trimesh.Trimesh, Component)` -- the mesh and its *exact* ground-truth
     metadata built from the same numbers used to construct the mesh (never
     estimate `dimensions`/`bounding_box`/`transform` after the fact).
   - An assembly function (like `generators/house/room.py::build_room`) that
     composes components into one `Scene`, with explicit `Relationship`s and
     named `Anchor`s.
   - A template system (like `generators/house/house.py::TEMPLATES` +
     `split_for_template`) if you want deterministic, leak-proof
     train/validation/test splits -- see `docs/GENERATION.md`'s "Templates
     and splits" section, including the degenerate-split pitfall with too
     few templates.
   - A `generate_sample(config, sample_id, template_id, seed)` orchestrator
     (like `generators/house/sample.py`) that builds the scene, exports
     meshes, renders every configured view via `generators/render/`
     (unchanged -- the rasterizer takes flattened triangle/color/semantic/
     instance arrays, it doesn't know what a "house" is), runs validation,
     and writes the same typed-pool layout (`scenes/`, `meshes/`,
     `renders/`, `depth/`, `segmentation/`, `annotations/`,
     `metadata/index.jsonl`).

3. **Reuse validation as-is.** `validation/geometry.py`,
   `validation/physical.py` (or a category-specific replacement if physical
   plausibility means something different for your category),
   `validation/annotation.py`, and `validation/dataset.py::run_validation`
   all operate on the generic `Scene`/`Component` schema -- they don't know
   about houses specifically. Only write a new check module if your
   category needs a genuinely new kind of plausibility check.

4. **Add `configs/dataset_<name>.yaml`** (`schemas/dataset_config.py::DatasetYamlConfig`):
   ```yaml
   dataset: {name: <name>, category: <name>, version: "0.1"}
   paths: {root: datasets/<name>}
   split: {train: 0.8, validation: 0.1, test: 0.1}
   generation: {resolution: [512, 512], views: [front, back, left, right, top, isometric, random], ...}
   quality: {min_overall_quality: 0.85}
   component_priority: {...}   # advisory target distribution, see tools/statistics.py
   ```

5. **Add CLI entrypoints** under `scripts/` mirroring
   `generate_one_sample.py`/`generate_house_dataset.py`. `tools/inspect_dataset.py`,
   `tools/validate_dataset.py`, `tools/statistics.py`, and
   `tools/build_split_indexes.py` all take `--dataset <name>` and load
   `configs/dataset_<name>.yaml` generically -- no changes needed there.

6. **Test the same way**: get one sample fully validated and hand-inspected
   before generating a batch (`docs/GENERATION.md`'s phase log). Write
   `tests/test_<name>.py` mirroring `tests/test_sample.py`.
