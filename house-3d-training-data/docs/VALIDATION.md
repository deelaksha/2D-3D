# Validation

Every sample is validated at generation time
(`generators/house/sample.py::generate_sample` calls
`validation/dataset.py::run_validation` before writing `split` into the
sample's rows) -- there is no such thing as an unvalidated sample in the
index. `tools/validate_dataset.py` re-runs the same checks independently,
reloading `scene.json` and `mesh.glb` from disk rather than trusting the
cached `quality` in `metadata.json`, so it also catches drift between what
was written and what's actually on disk.

## `QualityScore` (`schemas/quality.py`)

Four independent dimensions, each `[0, 1]`, plus an auto-computed mean:

```
geometry_quality: float
annotation_quality: float
segmentation_quality: float
physical_validity: float
overall_quality: float   # = mean of the above four, if not supplied
```

A sample passes if `overall_quality >= quality.min_overall_quality`
(`configs/dataset_house.yaml`, currently `0.85`).

## The four checks

Every `validation/*.py` module exposes `check_X(...) -> tuple[float, list[str]]`
-- a score and a list of human-readable issue strings, combined in
`validation/dataset.py::run_validation`.

### `validation/geometry.py::check_geometry` -> `geometry_quality`

Per component: mesh exists, `mesh.is_watertight`, `mesh.volume` above a
`1e-6 m^3` floor, and vertex/face counts match the `MeshInfo` written into
`scene.json`. Score is `(components - failed) / components`.

### `validation/physical.py::check_physical` -> `physical_validity`

- Every `door`/`window` has an `inserted_into` relationship to a real `wall`
  component, and its bounding box actually fits inside that wall's bounding
  box.
- Door/window dimensions fall in a plausible range (door: 0.5-1.6m wide,
  1.6-2.6m tall; window: 0.2-3.2m wide, 0.2-2.6m tall).
- Wall thickness falls in `0.05-0.6m`.

Score is `(checks - failed) / checks` (`1.0` if there was nothing to check,
e.g. a scene with no walls yet).

### `validation/annotation.py::check_annotation` -> `annotation_quality`

Every component with a defined anchor set in `schemas.taxonomy.ANCHOR_NAMES`
actually has all of those anchors present; every door/window has an
`inserted_into` relationship (annotation completeness, not physical fit --
`check_physical` re-checks the geometry of that same relationship).

### `validation/dataset.py::check_render_completeness` -> `segmentation_quality`

Per configured view: the render, depth `.npy`, semantic segmentation,
instance segmentation, and camera JSON files all exist and are non-empty;
depth has more than 2% non-background pixels (catches an empty/degenerate
render); segmentation has at least 2 distinct class ids; `camera.json`
round-trips through `Camera.model_validate_json`. Score is
`(3 * views - failed) / (3 * views)`.

## Rejection

A sample that fails (`overall_quality < min_overall_quality`) is **not**
deleted or silently dropped:

- All its generated files stay exactly where the typed-pool layout put them
  (`scenes/`, `meshes/`, `renders/`, ...) -- nothing is reorganized.
- Its `DatasetSample` rows get `split="rejected"` in `metadata/index.jsonl`
  (and therefore in `rejected/index.jsonl` after
  `tools/build_split_indexes.py`).
- `validation/dataset.py::write_rejection_reason` writes
  `rejected/<sample_id>/rejection_reason.json` with the full `QualityScore`
  breakdown and every issue string, so a rejection is always traceable back
  to a specific check.

## Running validation directly

```bash
# Every sample in the dataset, re-loaded from disk (exits 1 if any fail)
uv run python tools/validate_dataset.py --dataset house

# One sample
uv run python tools/validate_dataset.py --dataset house --sample house_000003
```
