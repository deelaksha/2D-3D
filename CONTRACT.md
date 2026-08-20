# WoodKit Designer — Build Contract (READ FIRST)

You are building ONE module of a Vite + React 18 + TypeScript design app. Many
agents build in parallel against this frozen contract. Follow it EXACTLY so
everything compiles and integrates on the first try.

## Golden rules
1. **Do NOT edit any "frozen" file** (listed below). Only create the file(s) you
   were assigned. Never touch `package.json`, `App.tsx`, `main.tsx`,
   `src/tools/index.ts`, `src/tools/runtime.ts`, `src/tools/registry.ts`,
   `src/tools/toolTypes.ts`, `src/core/model/*`, `src/core/store/*`,
   `src/core/units.ts`, `src/core/geometry/*`, `src/styles/*`.
2. **Do NOT run npm/vite/tsc** or install anything. Just write source files.
3. **All lengths are millimetres (mm).** Angles are degrees, CW, 0 = +X.
4. **Never mutate store state directly.** Call the semantic actions in
   `@/core/store/actions`. Reads may use `store.getState()` or hooks.
5. **Imports use the `@/` alias for `src/`** (e.g. `import { store } from "@/core/store/store"`).
6. UI components are **default-exported React function components taking NO
   required props** (they read the store via hooks), unless stated otherwise.
7. Strict TypeScript. No `any` unless unavoidable. Type every export.
8. Match the existing code style (see any frozen file). Keep comments purposeful.

## Frozen modules you import from

### `@/core/model/types` — the data model
Key types: `Vec2, Vec3, Bounds, Unit, ID, Shape, ShapeKind, PathPoint,
ShapeModifier, BooleanOp, Material, MaterialKind, Connector, ConnectorType,
Constraint, ConstraintKind, Dimension, DimensionKind, Part, PartType,
Transform2D, PartGroup, Connection, ConnectionStatus ('valid'|'invalid'|'possible'|'unknown'),
Placement, Assembly, Project, ProjectMeta, ValidationIssue, ValidationReport,
IssueLevel ('ok'|'warning'|'error')`. See the file for exact fields. `SCHEMA_VERSION` is exported.

A **Part** owns: `id, name, type, transform (Transform2D), width, height,
thickness, materialId, color?, shape (Shape), modifiers (ShapeModifier[]),
connectors (Connector[]), constraints[], visible, locked, order, groupId?`.

A **Connector**: `id, partId, name, type, position (Vec2 local), orientation
(deg), width, height, depth, diameter?, tolerance, compatibleWith (string[]),
metadata?`.

### `@/core/model/defaults` — factories
`makeProject(name?), makePart(name, materialId, overrides?), makeShape(kind, overrides?),
makeConnector(partId, type, position, overrides?), makeMaterial(kind, overrides?),
defaultMaterials(), MATERIAL_PRESETS, identityTransform(x?,y?), emptyAssembly(),
materialOf(project, id)`.

### `@/core/model/ids`
`uid(prefix?) -> string`, `seedIdCounter(n)`, `idOrdinal(id)`.

### `@/core/units`
`fromMm(v, unit), toMm(v, unit), roundForUnit(v, unit), formatLength(v, unit), UNIT_LABELS`.

### `@/core/geometry` (barrel) — pure geometry
- vec: `v,add,sub,scale,dot,len,dist,normalize,rotate,rotateAround,dir,lerp,DEG`
- outline: `shapeOutline(shape) -> Vec2[][]` (closed loops, local mm),
  `shapeBounds(shape) -> Bounds`, `isClosedShape(kind)`, `boundsOfPoints(pts)`,
  `pointInLoop(pt, loop)`.
- world: `partToWorld(part, p)`, `worldToPart(part, p)`, `partOutlineWorld(part) -> Vec2[][]`,
  `partModifiersWorld(part) -> {op, loops}[]`, `partBoundsWorld(part)`, `partBoundsLocal(part)`,
  `pointInPart(part, world) -> boolean`, `connectorWorld(part, c) -> Vec2`,
  `connectorWorldOrientation(part, c) -> number`.

### `@/core/store/store` — the store
`store` singleton with: `getState() -> {project, ui}`, `subscribe(fn)`,
`setUI(patch|fn)`, `status(msg, level?)`, `commit(label, recipe)`, `loadProject(project, label?)`,
`undo()`, `redo()`, `canUndo()`, `canRedo()`, `undoLabel()`, `redoLabel()`.
Hooks: `useStore(selector)`, `useProject()`, `useUI()`.
`UIState` fields: `mode ('2d'|'3d'), activeToolId, selection (string[]), activePartId,
hoverConnectorId, selectedConnectorId, panelTab ('layers'|'parts'), camera2d {x,y,zoom},
grid {size, snap, visible}, showConnectorLabels, showDimensions, commandPaletteOpen,
draggingPartId, statusMessage, statusLevel, recentToolIds, favoriteToolIds`.

### `@/core/store/actions` — semantic mutations (USE THESE)
Parts: `createPart(name, opts?) -> id`, `addPart(part)`, `updatePart(id, patch, label?)`,
`updatePartTransform(id, patch, label?)`, `renamePart(id, name)`, `setPartVisibility(id, v)`,
`setPartLock(id, v)`, `setPartMaterial(id, matId)`, `deletePart(id)`, `deleteParts(ids)`,
`duplicatePart(id) -> id|null`, `reorderPart(id, order)`, `findPart(id)`, `findConnector(id)`.
Shape/cutouts: `setPartShape(id, patch)`, `addModifier(partId, op, shape, name?)`,
`addHole(partId, pos, diameter?)`, `updateModifier`, `deleteModifier`.
Connectors: `addConnector(partId, type, position, overrides?) -> id`,
`updateConnector(connectorId, patch, label?)`, `renameConnector(id, name)`, `deleteConnector(id)`.
Constraints: `addConstraint(partId, c)`, `deleteConstraint(partId, id)`.
Groups: `addGroup(name)`, `updateGroup(id, patch)`, `setPartGroup(partId, groupId|null)`.
Dimensions: `addDimension(dim)`, `updateDimension(id, patch)`, `deleteDimension(id)`.
Materials: `addMaterial(m)`, `updateMaterial(id, patch)`.
Assembly: `updatePlacement(partId, patch, label?)`, `placePart(partId, position, rotation?)`,
`addConnection(conn) -> id`, `setConnectionStatus(id, status, reason?)`, `removeConnection(id)`.
Selection/UI: `select(ids)`, `selectOne(id|null)`, `toggleSelect(id)`, `clearSelection()`,
`selectConnector(id|null)`, `setMode('2d'|'3d')`, `setActiveTool(id)`, `toggleFavoriteTool(id)`.

### `@/tools/registry` — `registry`
`registry.get(id)`, `.all()`, `.byCategory(cat)`, `.categories()`, `.search(q, limit?)`, `.size`.

### `@/tools/toolTypes`
`ToolDefinition, ToolContext, ToolParam, ToolCategory, ToolKind
('command'|'draw'|'transform'|'connector'|'mode'), CATEGORY_META`.

### `@/tools/runtime`
`activateTool(toolId, point?, params?) -> boolean`, `buildContext(point?, params?)`, `defaultParams(tool)`.

## Engine module signatures (implement EXACTLY — other agents import these)

### `@/core/connectors/compat` (engine agent)
```ts
export interface CompatResult { status: ConnectionStatus; score: number; reason: string; }
export function connectorFamily(t: ConnectorType): "insert" | "receive" | "neutral";
export function areTypesComplementary(a: ConnectorType, b: ConnectorType): boolean;
export function checkCompatibility(
  a: { part: Part; connector: Connector },
  b: { part: Part; connector: Connector },
): CompatResult;
```
Rules: insert family = peg/pin/dowel/tab/snap/corner; receive = hole/slot/notch/edge;
neutral = magnet/surface/hinge. Complementary pairs: tab↔slot, peg↔hole, pin↔hole,
dowel↔hole, tab↔notch, snap↔slot, magnet↔magnet, surface↔surface, hinge↔hinge,
edge↔edge/tab. Score also considers size match (width/height/diameter within tolerance),
and material thickness for slot depth. Return status 'valid' (>=0.75), 'possible'
(0.4–0.75), 'invalid' (<0.4 or non-complementary), 'unknown' (missing data).

### `@/core/assembly/snapping` (engine agent) — depends on compat + geometry
```ts
export interface SnapCandidate {
  sourceConnectorId: string; targetPartId: string; targetConnectorId: string;
  distance: number; result: CompatResult; snapPosition: Vec3; snapRotation: Vec3;
}
// Given the moving part at a proposed 3D transform, find the best compatible
// connector pairing on ANY other placed part within `threshold` mm, and return
// the corrected position/rotation that makes the two connector points coincide.
export function findSnap(
  project: Project, movingPartId: string, movingPos: Vec3, movingRot: Vec3, threshold?: number,
): SnapCandidate | null;
export function connectorWorld3D(
  part: Part, c: Connector, pos: Vec3, rot: Vec3,
): { position: Vec3; normal: Vec3 };
```

### `@/core/convert/to3d` (engine agent)
```ts
export interface PartMesh3D {
  partId: string; width: number; height: number; thickness: number; color: string;
  // connector markers in the part's local 3D frame (panel centered at origin,
  // extruded along +Z by thickness). x = local2D.x - width/2, y = -(local2D.y - height/2).
  connectors: { id: string; type: ConnectorType; name: string; position: Vec3; }[];
}
export function partTo3D(part: Part, material: Material): PartMesh3D;
```

### `@/core/assembly/validate` (engine agent) — depends on compat
```ts
export function validateAssembly(project: Project): ValidationReport;
export function validateDesign(project: Project): ValidationReport;
```
Checks: parts without connectors, duplicate connector names, connections whose
connectors are incompatible, overlapping/duplicate connections, unplaced parts,
zero-size parts. Aggregate `level` = worst issue.

### `@/core/constraints/solver` (engine agent)
```ts
export function applyConstraints(project: Project): void; // mutate parts to satisfy simple constraints
export function describeConstraint(c: Constraint): string;
```

### `@/core/persist/io` (engine agent) — imported by main.tsx
```ts
export function exportProjectJSON(): string;           // stringify current project
export function downloadProject(): void;               // trigger a file download
export function importProjectFromText(text: string): boolean; // parse + loadProject
export function openImportDialog(): void;              // <input type=file> flow
export function saveToLocalStorage(): void;
export function loadFromLocalStorage(): Project | null;
export function bootstrapProject(): void;              // load saved OR the House demo; also autosave on store changes
```
`bootstrapProject` must: try `loadFromLocalStorage()`; if null, `store.loadProject(houseDemo())`
from `@/data/houseDemo`; then subscribe to the store to autosave (debounced/throttled ok).

### `@/data/houseDemo` (data agent)
```ts
export function houseDemo(): Project; // Base + Wall 1..4 + Roof Left + Roof Right,
// each a Part with a rect shape, correct materials, and NAMED connectors
// (base has 4 wall connectors as slots; each wall has 2 bottom tabs + side
// connectors; roofs have wall connectors). Author connector positions/orientations.
export const HOUSE_ASSEMBLY: Record<string, { position: Vec3; rotation: Vec3 }>;
// A known-good final 3D transform per part id-by-name, used by the "Assemble House"
// helper. Because ids are generated, expose it as a function too:
export function houseAssemblyTargets(project: Project): { partId: string; position: Vec3; rotation: Vec3 }[];
```

## UI component contracts (default export, no required props)
- `@/ui/shell/TopBar` — brand, File/Edit/View/Design/Connect/Export menu buttons,
  Undo/Redo (use `store.undo/redo`, `store.canUndo/canRedo`, labels), the mode
  switch (2D Design / 3D Assembly via `setMode`), an **Assemble in 3D** primary
  button (switches to 3D), and a command-palette trigger (⌘K). Use `.wk-topbar`,
  `.wk-brand`, `.wk-menu`, `.wk-modeswitch`, `.wk-btn`.
- `@/ui/shell/StatusBar` — `.wk-status`; show status dot+message (`ui.statusMessage/statusLevel`),
  part count, connection count, zoom %, unit `<select>` (updates `project.meta.displayUnit`
  via `updateProject`? there is none — use `store.commit` is frozen; instead expose via a
  small local: call `store.commit("Unit", d => { d.meta.displayUnit = u })`), and tool count `registry.size`.
- `@/ui/toolbox/LeftToolbox` — `.wk-panel`; a search box (filters `registry.search`),
  Favorites + Recent rows, then collapsible categories (`CATEGORY_META`) each with a
  `.wk-toolgrid` of `.wk-tool` buttons. Clicking calls `activateTool(tool.id)`. Highlight
  when `tool.id === ui.activeToolId`. On hover show `<ToolTooltip tool x y/>` from
  `@/ui/tooltip/ToolTooltip`. Filter tools by `supportedModes` including `ui.mode`.
- `@/ui/tooltip/ToolTooltip` — **props**: `{ tool: ToolDefinition; x: number; y: number }`.
  Renders `.wk-tooltip` with title+icon, a `.wk-tooltip__stage` containing an animated
  SVG/CSS demo chosen by `tool.tooltipAnimation` (build a small `ToolAnimation` in the
  same folder mapping animation ids like 'draw-rect','draw-circle','tab-slot','cut-hole',
  'join','split','move','rotate' to short looping animations; fall back to the tool icon),
  the description, and the shortcut as `.wk-kbd`. Also export the folder's animations.
- `@/ui/canvas2d/Canvas2D` — SVG-based. Render grid (`ui.grid`), all visible parts
  (`partOutlineWorld`, fill by material/part color, holes via modifier loops in bg color),
  connectors (typed glyphs, colored per type, labels when `ui.showConnectorLabels`),
  selection highlight, dimensions when `ui.showDimensions`. Support pan (space/middle-drag),
  zoom (wheel → `camera2d.zoom`), click-select (`pointInPart`, `selectOne`/`toggleSelect` with shift),
  and DRAW tools: when `registry.get(ui.activeToolId)` has `kind==='draw'` create a new Part
  via `createPart` + `setPartShape` on drag; `kind==='connector'` add a connector to the part
  under the cursor via `addConnector`; move tool drags selected part via `updatePartTransform`.
  Snap to grid when `ui.grid.snap`. Keep it performant (one SVG, memo where easy).
- `@/ui/canvas3d/Canvas3D` — raw **three.js** (`import * as THREE from "three"`) in a
  `useEffect`. Render a ground grid + each PLACED part as a box mesh (`partTo3D` dims,
  material color) at its `placement.position/rotation`. Orbit-ish camera (implement simple
  mouse-drag orbit + wheel zoom; do NOT import OrbitControls from examples—write minimal).
  Parts list drag: accept HTML5 drop from PartsPanel/AssemblyTree (dataTransfer partId) →
  `placePart` at a raycast point on the ground. While dragging a placed part, call
  `findSnap`; if a candidate within threshold, show ghost + highlight both connectors and a
  `.wk-toast` "✓ Compatible: A → B" or "✕ mismatch"; on release, if valid, `placePart` at the
  snapped transform and `addConnection({..., status:'valid'})` and toast "✓ connected".
  Provide an **Assemble House** button overlay (`.wk-hud-card`) that places all parts at
  `houseAssemblyTargets(project)`. Render connector markers as small spheres colored per type.
- `@/ui/panels/LayersPanel` — `.wk-panel`; list parts (ordered by `order`) as `.wk-row`
  with visibility eye (`setPartVisibility`), lock (`setPartLock`), inline rename (dbl-click →
  `renamePart`), select (`selectOne`/`toggleSelect`), duplicate + delete actions, and
  HTML5 drag-to-reorder (`reorderPart`). Show connector children indented (`.wk-row--child`).
  Active when `ui.selection.includes(part.id)`.
- `@/ui/panels/PartsPanel` — `.wk-panel`; a "House" root then each part as a `.wk-row`
  (draggable with `dataTransfer.setData('partId', id)` so 3D can accept it). Selecting a
  part `selectOne`. Show a small badge with connector count. Include an "Add Part" button
  (`createPart`).
- `@/ui/panels/Inspector` — `.wk-panel`; when a connector is selected (`ui.selectedConnectorId`)
  edit connector (name, type, position x/y, orientation, width/height/depth, diameter, tolerance,
  compatibleWith) via `updateConnector`/`renameConnector`. Else when a part is active
  (`ui.activePartId`) edit name, width, height (→`setPartShape`), thickness, material (`<select>`),
  rotation (`updatePartTransform`), color, and list its connectors + constraints. Use `.wk-field`.
  Show values in `project.meta.displayUnit` (convert with units helpers) but store mm.
- `@/ui/panels/AssemblyTree` — `.wk-panel`; tree of parts showing their connections
  ("connected → OtherPart") from `project.assembly.connections`. Each part draggable into 3D.
  A "Validate" button runs `validateAssembly` and lists issues with ok/warn/err badges,
  click focuses refs. Show placed/unplaced state.
- `@/ui/palette/CommandPalette` — `.wk-palette-overlay`; input filters `registry.search(q)`,
  arrow keys + enter run `activateTool(id)` then close (`store.setUI({commandPaletteOpen:false})`).
  Show icon, name, description, category. Esc closes. Autofocus input.

## Tool module contracts (each file exports a `ToolDefinition[]`)
Files + export names (create the file, export the named const):
- `src/tools/geometry.tools.ts` → `geometryTools` (rect, roundedRect, square, circle,
  ellipse, triangle, polygon, star, line, arc, hexagon, octagon, ring, capsule, slot,
  trapezoid, diamond, parallelogram — kind 'draw', `createsShape`, shortcuts for common
  ones: R, C, L, P, star=S). Each with icon (emoji/glyph), child-friendly description,
  `tooltipAnimation` (e.g. 'draw-rect','draw-circle'), `supportedModes:['2d']`,
  `parameters` (width/height/radius where relevant).
- `src/tools/boolean.tools.ts` → `booleanTools` (union, subtract 'Cut Shape', intersect,
  kind 'command'; operate on `ctx.selection` — for milestone: subtract adds a subtract
  modifier of the 2nd selected part's shape into the 1st via `addModifier`, and delete the
  consumed part; union/intersect can be simple stubs that set a status message if <2 selected).
- `src/tools/connector.tools.ts` → `connectorTools` (tab, slot, hole, peg, pin, dowel,
  notch, hinge, magnet, snap, edge, corner, surface — kind 'connector', `createsConnector`,
  `tooltipAnimation:'tab-slot'|'cut-hole'` etc, `supportedModes:['2d']`, shortcut for
  connector generic = none; params size/depth/diameter).
- `src/tools/joinery.tools.ts` → `joineryTools` (fingerJoint, boxJoint, dovetail, mortise,
  tenon, rabbet, lapJoint — kind 'command' that adds an appropriate connector or modifier to
  the active part; keep effects simple but real).
- `src/tools/transform.tools.ts` → `transformTools` (move [shortcut V], rotate [shortcut T]
  90°, scale, mirrorX 'Flip Left/Right', mirrorY, align-left/center/right/top/middle/bottom,
  distribute-h/v, bringForward/sendBackward — 'move'/'rotate'/'scale'/'mirrorX'/'mirrorY' use
  kind 'transform' with transformMode where it drives the canvas; align/distribute/rotate90
  are kind 'command' operating on `ctx.selection` via `updatePartTransform`/`updatePart`).
- `src/tools/measure.tools.ts` → `measureTools` (dimension-horizontal, -vertical, radial,
  diameter, angle, distance, area — kind 'command' that adds a Dimension across the active
  part bounds via `addDimension`, or reports area/distance to the status bar).
- `src/tools/layout.tools.ts` → `layoutTools` (toggleGrid, toggleSnap, gridSize presets
  1/2/5/10/20mm, toggleConnectorLabels, toggleDimensions, zoomIn/out/fit, resetView — kind
  'command' toggling `store.setUI`).
- `src/tools/material.tools.ts` → `materialTools` (setPlywood, setMDF, setCardboard,
  setAcrylic, setSolidWood, setFoam — kind 'command' setting the active/selected parts'
  material by finding/creating the material of that kind; icon 🪵 etc).
- `src/tools/assembly.tools.ts` → `assemblyTools` (connect, disconnect, validate, autoAssemble
  'Assemble House', preview — kind 'command'; validate runs `validateAssembly` and posts a
  status summary; autoAssemble uses `houseAssemblyTargets` + `placePart`; supportedModes
  include '3d').
- `src/tools/edit.tools.ts` → `editTools` (undo, redo, duplicate [⌘D], delete, group, ungroup,
  selectAll, deselect, isolate — kind 'command' calling store/actions).

Every ToolDefinition MUST have: `id` (`category.name`), `name`, `category`, `icon`,
`description`, `supportedModes`, `kind`. Prefer adding `hint`, `shortcut`, `tooltipAnimation`,
`keywords`, `parameters`, `undoable:true`.

## tsconfig
`@/*` maps to `src/*`. JSX = react-jsx (no `import React` needed, but importing hooks is fine).
Target ES2020, strict. `structuredClone` is available.
