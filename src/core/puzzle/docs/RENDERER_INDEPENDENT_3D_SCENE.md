# Renderer-Independent 3D Scene Representation (Phase 93)

## Overview

The 3D Scene subsystem provides a universal, renderer-agnostic representation for puzzles. It bridges the gap between the parametric CAD kernel and any downstream viewer (Three.js, WebGL, Babylon.js, WebGPU, glTF/USDZ exporters, headless raytracers) without coupling the core engine to any specific rendering dependency.

---

## Strict CAD Separation Guarantee

```
  Authoritative CAD Model (SolidRepresentation3D)
                      │
           (Deep-Cloned Isolation)
                      │
                      ▼
    Renderer-Independent 3D Scene (Scene)
        ├── RenderGeometry (Float32Array / Uint32Array)
        ├── SceneObject (Transforms, DisplayProperties)
        └── SceneConnection (Pairing Vectors, Indicators)
                      │
                      ▼
          Downstream WebGL / Three.js
   (Interactive Shaders, Animations, Hover)
```

- **Zero Coupling**: The core engine contains no WebGL, Three.js, or DOM dependencies.
- **Zero Corruption**: Mutating a `SceneObject`, vertex buffer, or material property in the renderer never modifies or corrupts the authoritative CAD solid mesh.

---

## Scene Structure

```
Scene
 ├── Pieces (SceneObject[])
 ├── Connectors (SceneObject[])
 ├── Assembly transforms (Record<string, RigidTransform3D>)
 ├── Materials (Record<string, SceneMaterial>)
 ├── Connection visualization (SceneConnection[])
 ├── Coordinate axes (SceneCoordinateAxes)
 └── Metadata (SceneMetadata)
```

Each `SceneObject` contains:
- `id`: Unique identifier
- `name`: Human-readable label
- `kind`: `"piece" | "connector" | "axis" | "connection_marker" | "annotation"`
- `geometry`: Independent `RenderGeometry` with `positions`, `normals`, `indices`, `uvs`, `wireframeIndices`, and `bounds`
- `transform`: Local rigid transform
- `worldTransform`: Assembly world-space transform
- `materialId`: Reference into `materials` dictionary
- `displayProperties`: PBR rendering attributes (color, opacity, roughness, metalness, wireframe, shadows)
- `pieceId`: Associated puzzle piece ID
- `connectionIds`: Associated connection IDs
- `cadGeometryRef`: Source CAD entity reference
- `isImmutableCadCopy`: Strict flag indicating an independent clone

---

## Usage Example

```typescript
import { generatePuzzle } from './highlevelapi';
import { SceneBuilder } from './scene';

// 1. Generate complete 3D puzzle
const puzzleResult = await generatePuzzle(
  "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
);

// 2. Build renderer-independent 3D scene
const scene = SceneBuilder.buildFromPuzzle(puzzleResult, {
  colorScheme: "distinct_pieces",
  includeCoordinateAxes: true,
  includeConnectionVisualizations: true,
});

console.log(`Built scene with ${scene.pieces.length} pieces, ${scene.connections.length} connections.`);
console.log(`Global bounding box:`, scene.metadata.boundingBox);
```
