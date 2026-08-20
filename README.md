# WoodKit Designer

**Photoshop for designing physical wooden construction kits.** Design each part
in a precise 2D canvas, give it named connectors, organize parts like Photoshop
layers, then assemble them in a 3D workspace by dragging parts together — with
live connector-compatibility checking.

> This is the **design-system foundation**. It implements a smaller set of tools
> *completely*, on an architecture built to scale to 1000+ tools. It is not an
> AI-generation product.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview
```

Node 18+. The app is fully client-side (persistence via localStorage + JSON
import/export). No backend required.

## The first-milestone flow

The app boots with a **House demo** (Base, Wall 1–4, Roof Left, Roof Right).

1. **Design in 2D** — draw/resize parts, cut holes, drop connectors, rename them.
2. **Organize** — Parts / Layers panels (visibility, lock, reorder, rename).
3. **Switch to 3D** — click *Assemble in 3D* (or the 3D toggle).
4. **Assemble** — drag a part into the scene, move it near another; compatible
   connectors highlight and snap, and the connection is confirmed. *Assemble
   House* folds the whole kit together.

## Architecture

The geometry/assembly **core is framework-independent TypeScript** so a
C++/WASM engine can replace it later without touching the UI.

```
src/
  core/
    model/        types.ts (single source of truth), defaults, ids
    units.ts      mm ⇄ cm ⇄ inch (storage is always mm)
    store/        observable store + snapshot undo/redo + semantic actions
    geometry/     shape → outline, world transforms, hit-testing (pure)
    connectors/   compatibility engine
    constraints/  constraint solver
    assembly/     validation + 3D snapping
    convert/      2D part → 3D panel
    persist/      JSON + localStorage
  tools/          metadata-driven registry (toolTypes, registry, runtime)
    *.tools.ts    geometry, boolean, connector, joinery, transform, measure,
                  layout, material, assembly, edit  (each = ToolDefinition[])
  ui/
    shell/        TopBar, StatusBar
    toolbox/      LeftToolbox (generated from the registry)
    canvas2d/     Canvas2D (SVG design surface)
    canvas3d/     Canvas3D (three.js assembly)
    panels/       LayersPanel, PartsPanel, Inspector, AssemblyTree
    palette/      CommandPalette (⌘K)
    tooltip/      animated tool tooltips
  data/           houseDemo.ts
```

### Why it scales to 1000+ tools

Every tool is **metadata** (`ToolDefinition`) registered into a central
`registry`. The toolbox, command palette, shortcuts and canvas are all generated
from that metadata — adding a tool is one object in one `*.tools.ts` file, no new
UI. See `CONTRACT.md` for the full module/interface reference.

### Single source of truth

2D geometry, physical metadata, connectors, assembly relationships and the 3D
representation are all views of one `Project` model. Editing a part's width in
2D updates its 3D panel; moving a connector moves it everywhere.

## Keyboard

- `⌘/Ctrl + K` — command palette
- `⌘/Ctrl + Z` / `⌘/Ctrl + Shift + Z` — undo / redo
- `Delete` — delete selection
- `R` rectangle · `C` circle · `L` line · `P` polygon · `V` move · `T` rotate

## Concepts

- **Part** — a physical wooden component: geometry + thickness + material +
  connectors + metadata. Drawn in 2D, extruded in 3D.
- **Connector** — a real attachment feature (tab, slot, hole, peg, …) with a
  position, orientation, size and tolerance.
- **Connection** — a validated assembly relationship between two connectors.

## License

Internal prototype.
