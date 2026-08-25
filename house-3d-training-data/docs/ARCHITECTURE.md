# Architecture

## Pure Python, one interpreter, no Blender

Everything runs inside the project's own `uv`-managed venv:
`schemas/`, `generators/`, `validation/`, `tools/`, `preprocessing/`,
`training/` all share one Python process per sample. There is no external
3D application to shell out to and no second interpreter/IPC boundary to
maintain.

```
spec (dimensions, seed, component list)
   |
   v
generators/house/*.py   -- builds numpy vertex arrays -> trimesh.Trimesh per component
   |
   v
generators/house/room.py -- assembles components into one Scene (schemas/scene.py),
                             with explicit relationships + anchors
   |
   +--> mesh export (trimesh): mesh.glb, mesh.obj           (schemas/component.py ground truth)
   +--> generators/render/*.py: RGB, depth.npy, segmentation (rasterizer, see below)
   +--> scene.json / camera.json / metadata.json            (schemas/*, pydantic .model_dump_json())
   |
   v
validation/*.py  -- geometry + physical-plausibility + schema checks, reject on failure
```

Why not Blender: this host has no system Blender, no sudo, and no GPU.
Driving a downloaded portable Blender headless would mean a second Python
interpreter (Blender's bundled one) that can't `pip install` this project's
dependencies, plus a subprocess/JSON hand-off boundary purely to work around
environment constraints. A dependency-free renderer avoids that boundary
entirely and is exactly as reproducible as the rest of the pipeline (same
interpreter, same `uv.lock`).

## Mesh generation

`generators/house/primitives.py` builds axis-aligned boxes (and boolean
cut/union variants for openings) directly as `numpy` vertex/face arrays,
wrapped in `trimesh.Trimesh`. Every parametric generator
(`wall.py`, `door.py`, `window.py`, `floor.py`, `ceiling.py`) composes these
primitives and returns `(trimesh.Trimesh, schemas.component.Component)` --
the mesh and its ground-truth metadata are produced from the *same* numbers,
so `dimensions`/`bounding_box`/`transform` in `scene.json` are never
estimated after the fact, they are the exact inputs used to build the mesh
(prompt.txt #11).

`trimesh` also gives free geometry validation (`is_watertight`,
`is_winding_consistent`, duplicate-vertex merge, `nondegenerate_faces`) used
by `validation/geometry.py` (prompt.txt #32).

## Rendering: a from-scratch software rasterizer

`generators/render/` is a small perspective-projection, z-buffered triangle
rasterizer written in `numpy` (`camera.py`, `rasterizer.py`, `shading.py`).
No OpenGL/EGL/OSMesa context is required, so it runs on a plain CPU host
with no GPU and no X server -- appropriate for this shared, headless machine.

For one camera it produces, in a single rasterization pass over the scene's
triangles:

- **RGB** (`image_*.png`) -- flat per-material base color (`materials.py`)
  with single-directional-light Lambertian shading + a constant ambient
  term. Not photorealistic, but every pixel's color is a deterministic
  function of real geometry and material, not learned or estimated.
- **Depth** (`depth.npy`, float32 meters, camera-space Z) -- the exact
  z-buffer from the same rasterization pass. This satisfies prompt.txt #27
  ("do not estimate depth for synthetic samples") by construction: depth
  *is* the z-buffer, not a separate estimation step. A normalized
  `depth_preview.png` (8-bit) is written alongside for quick human
  inspection only and is never used as training ground truth.
- **Segmentation** (`segmentation_semantic.png`, `segmentation_instance.png`)
  -- each triangle is tagged with its owning component's semantic class id
  and instance id at generation time (prompt.txt #26); the rasterizer writes
  those ids directly instead of a color, so segmentation is exact, not
  inferred from the RGB render.

Because RGB/depth/segmentation come from one shared z-buffer pass, they are
pixel-aligned by construction -- there is no separate render engine per
output to keep in sync.

## Camera

`generators/render/camera.py` implements a standard pinhole camera
(position, look-at rotation, vertical FOV, near/far). `generators/house/sample.py`
(`VIEW_PRESETS` + `_view_camera`) generates the fixed view set
(front/back/left/right/top/isometric/random) plus randomized distance/height/FOV
for the `"random"` view per prompt.txt #19, and every camera's exact
parameters are written to `annotations/<sample_id>/<view>_camera.json`.

## No GPU on this host

`nvidia-smi` is absent. The rasterizer is pure CPU/numpy, so this is a
non-issue rather than a constraint to work around -- there is no GPU render
path to fall back from.

## Disk

`/` has ~300GB free on a 3.4TB, 96%-full shared volume (freed ~1.2GB by
removing the earlier vendored Blender download). `configs/*.yaml` keeps
default resolution/view-count conservative for exactly this reason
(prompt.txt #52, storage management). Re-check free space before scaling
past the Phase 7 milestone (prompt.txt #56/#57).
