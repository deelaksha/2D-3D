# Dataset schema

All ground truth is a Pydantic v2 model (`schemas/`, every model
`frozen=True`) -- nothing downstream trusts a hand-written dict. This
documents the actual fields, not an aspirational shape.

## `scene.json` (`schemas/scene.py::Scene`)

```
scene_id: str
scene_type: str
units: str = "meters"
components: list[Component]
relationships: list[Relationship] = []
```

Validated: component ids are unique; every relationship's `subject`/`object`
must reference a real component id in the same scene.

### `Component` (`schemas/component.py`)

```
id: str
type: str                    # must be in schemas.taxonomy.ALL_COMPONENT_TYPES
subtype: str | None          # if set, must be valid for `type` (e.g. wall -> WALL_SUBTYPES)
material: Material | None    # metadata only -- never part of type/subtype identity
transform: Transform         # position (Vec3) + rotation (Vec3), world space
dimensions: Dimensions        # width/height/depth in meters, strictly > 0
bounding_box: BoundingBox     # min/max Vec3, world space, min <= max enforced
anchors: list[Anchor]         # named semantic points (schemas.taxonomy.ANCHOR_NAMES)
mesh: MeshInfo                # vertex_count/face_count, > 0
```

Only `type`+`subtype`+`dimensions`+`transform` describe *what the thing is*;
`material` is always a separate, optional attribute (prompt.txt #10) -- a
`wall` with `material=brick` and the same `wall` with `material=concrete` are
the same semantic component.

Component types actually produced by the current generators:
`schemas.taxonomy.IMPLEMENTED_TYPES = {"wall", "door", "window", "floor",
"ceiling"}`. The schema accepts the full taxonomy (structural, opening,
architectural, interior space/object, building system types) for future
generators -- see `docs/ADDING_CUSTOM_DATA.md`.

### `Relationship` (`schemas/relationship.py`)

```
subject: str      # component id
predicate: str    # must be in schemas.taxonomy.RELATIONSHIP_PREDICATES
object: str       # component id
```

Explicit assembly relationships, not just proximate coordinates (prompt.txt
#24) -- e.g. `wall_north --attached_to--> floor`, `wall_north --supports-->
ceiling`, `door_0 --inserted_into--> wall_south`.

### `Anchor` (`schemas/geometry.py`)

```
name: str        # e.g. "center", "top", "hinge_side", "sill" -- see ANCHOR_NAMES
position: Vec3    # world space
```

## `camera.json` (`schemas/camera.py::Camera`, one per rendered view)

```
view_name: str
position: Vec3
look_at: Vec3
up: Vec3 = (0, 0, 1)
fov_degrees: float      # 0 < fov < 180
near: float              # > 0, finite
far: float               # > 0, finite
resolution: tuple[int, int]   # both > 0
```

Written to `annotations/<sample_id>/<view>_camera.json`. These are the
*exact* parameters used to render that view -- never reconstructed or
estimated after the fact.

## `metadata.json` (per sample, `scenes/<sample_id>/metadata.json`)

Hand-assembled in `generators/house/sample.py::generate_sample` (not a
standalone schema, since it's a generation-time summary, not ground truth):

```
sample_id: str
template_id: str
category: str
split: "train" | "validation" | "test" | "rejected"
quality: QualityScore          # see docs/VALIDATION.md
component_counts: dict[str, int]   # e.g. {"wall": 4, "door": 1, "window": 2, ...}
mesh: {vertex_count: int, face_count: int}
views: list[str]
```

## `metadata/index.jsonl` (`schemas/dataset_sample.py::DatasetSample`, one row per rendered view)

```
id: str            # "<sample_id>_<view_name>"
image: str          # path relative to dataset root
mesh: str
scene: str
depth: str
segmentation: str
camera: str
category: str
split: "train" | "validation" | "test" | "rejected"
quality: QualityScore | None
```

All paths are relative to `paths.root` in the dataset's YAML config --
never absolute, never machine-specific (enforced by a field validator).
`train/index.jsonl`, `validation/index.jsonl`, `test/index.jsonl`,
`rejected/index.jsonl` are the same rows, grouped by `split`
(`tools/build_split_indexes.py`).

## Segmentation

- **Semantic**: `segmentation/<sample_id>/<view>_semantic.png`, pixel value
  is `schemas.taxonomy.SEMANTIC_CLASS_IDS[component_type]` (0 = background,
  stable and append-only -- never renumbered).
- **Instance**: `segmentation/<sample_id>/<view>_instance.png`, pixel value
  is a 1-based per-component instance id, assigned in
  `generators/house/sample.py::_gather_render_arrays`.

Both come from the same rasterization pass as the RGB render and the depth
buffer (`generators/render/rasterizer.py`), so all four outputs are
pixel-aligned by construction -- there is no separate inference step that
could desync them.

## Depth

`depth/<sample_id>/<view>.npy` -- camera-space z-buffer, `float32`, one value
per pixel from the same rasterization pass (not inferred from the RGB
render). `<view>_preview.png` is an 8-bit visualization only, not for
training use.
