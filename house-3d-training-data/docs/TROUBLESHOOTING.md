# Troubleshooting

## Disk space (shared host)

This is a shared, disk-constrained machine -- check free space before
scaling up sample counts or resolution:

```bash
df -h /
du -sh datasets/house/*/
```

If space is tight: lower `generation.resolution` or `generation.supersample`
in `configs/dataset_house.yaml`, and prefer `mesh_formats: [glb]` over
`[glb, obj]` (an `.obj` + `.mtl` pair roughly doubles mesh storage for no
extra ground truth -- the `.glb` alone is sufficient for reloading named
per-component geometry, which is what `tools/validate_dataset.py` and
`generators/house/sample.py::_export_mesh` both rely on).

`depth/<sample_id>/<view>.npy` is the largest per-view file (uncompressed
float32) -- if depth ground truth isn't needed for a given experiment,
consider not shipping it rather than not generating it (validation depends
on it existing at generation time, via `check_render_completeness`).

## `uv run ...` fails / wrong Python version

`pyproject.toml` requires Python >=3.11. Run `uv python list` /
`uv sync` to confirm `uv` resolved an interpreter that satisfies it. This
project has no system dependencies beyond what `uv sync` installs
(`pydantic`, `numpy`, `pillow`, `pyyaml`, `trimesh`, `manifold3d`, `rtree`,
`opencv-python-headless`, `tqdm`, `click`) -- no Blender, no GPU driver, no
sudo step (see `docs/ARCHITECTURE.md`).

## A sample keeps landing in `rejected/`

Read `rejected/<sample_id>/rejection_reason.json` first -- it has the full
`QualityScore` breakdown and every specific issue string, so you shouldn't
need to re-derive the cause. Common causes:

- **`geometry_quality` low**: a mesh isn't watertight or has near-zero
  volume -- usually a boolean-cut edge case in `generators/house/wall.py`
  (door/window openings) at extreme template dimension ranges. Try the
  same `template_id` + `seed` with `tools/inspect_dataset.py` to see the
  exact dimensions that produced it.
- **`physical_validity` low**: a door/window doesn't fit inside its host
  wall's bounding box, or falls outside the plausible size ranges in
  `validation/physical.py`. Usually means a template's `width_range`/
  `depth_range` is too small relative to the fixed `DOOR_WIDTH`/
  `DOOR_HEIGHT` in `generators/house/house.py`.
- **`segmentation_quality` low**: a render came out mostly background (e.g.
  camera framing put the room bounding sphere out of frame) -- check the
  `random` view's drawn azimuth/elevation/margin first, since it's the only
  non-deterministic-by-design view (`generators/house/sample.py::_view_camera`).

## Validation-time vs re-validation disagree

`generate_sample` validates once at creation time and caches the result in
`metadata.json`/`index.jsonl`. `tools/validate_dataset.py` reloads
`scene.json` and `mesh.glb` from disk and re-runs the same checks
independently. If they disagree, trust `tools/validate_dataset.py` -- it
means something on disk changed (or was corrupted/truncated) after
generation, since generation-time validation runs against the in-memory
scene/mesh, not the exported files.

## Split looks skewed / one split is empty

Split is assigned per *template*, not per sample -- see "Templates and
splits" in `docs/GENERATION.md`. This has actually happened during
development (all 4 original templates hashed into `train`). Recompute the
per-template split distribution (command in `docs/GENERATION.md`) before
assuming it's a bug in `split_for_template` itself.

## Empty `datasets/<other-category>/` directories

`datasets/{architecture,custom,furniture,mechanical,vehicles}/` contain only
`.gitkeep` -- they're placeholders for future categories (see
`docs/ADDING_CUSTOM_DATA.md`), not a sign anything is broken. Only
`datasets/house/` has an implemented generator pipeline.
