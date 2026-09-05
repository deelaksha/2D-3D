# Comprehensive Puzzle Export Subsystem (Phase 99)

## 1. Overview

Phase 99 implements a multi-format CAD and digital fabrication **export engine** for the 3D puzzle design system.

The subsystem packages:
- **2D Fabrication Formats**: Vector SVG (laser cut & engrave), AutoCAD ASCII DXF (R12/2000), Dimensioned Technical Engineering Drawings, Individual Piece Files, and Combined Sheet Layouts.
- **3D Solid / Mesh Formats**: Stereolithography (.stl), Wavefront (.obj), glTF 2.0 (.gltf), and ISO 10303-21 STEP (.step) for both local piece solids and fully assembled 3D configurations.
- **Metadata Package**: Complete JSON schema definitions (`puzzle.json`, `pieces.json`, `connections.json`, `assembly_configuration.json`, `assembly_sequence.json`, and `validation_report.json`).
- **File Manifest**: A self-contained manifest detailing every file path, format, category, size in bytes, and description.

---

## 2. Mandatory Validation Gating

```
                         PuzzleGenerationResult
                                   ↓
                   PuzzleExportEngine.assertValidForExport()
                                   ↓
              ┌────────────────────┴────────────────────┐
              │ Is validationReport.isValid === true ?   │
              └────────────────────┬────────────────────┘
                       NO          │          YES
                       ↓           │           ↓
        Throws PuzzleExportValidationError   Proceed to Export:
      (Refuses to emit invalid artifacts)    • 2D Vector Generation
                                             • 3D Solid / Surface Generation
                                             • Metadata Package Assembly
```

### Strict Quality Contract:
- The exporter **refuses** to emit any artifacts if `validationReport.isValid !== true` or if mandatory validation has not been run.
- Attempting to export an unvalidated or failing design throws `PuzzleExportValidationError` with detailed diagnostics and issue codes.
- 100% of 2D pieces must have matching 3D pieces, 3D assembly transforms, and verified connections.

---

## 3. Supported 2D Formats

| Format | Artifact Type | Layer Separation | Content & Details |
| :--- | :--- | :--- | :--- |
| **SVG** | Individual Piece | `cut_layer` (red), `engrave_layer` (blue) | Exact physical boundary with cutouts and tabs; engraved piece ID text at centroid. |
| **SVG** | Combined Cut Sheet | `cut_layer`, `engrave_layer`, border | Nested arrangement of all pieces with configurable spacing ($8\text{mm}$) and sheet boundaries. |
| **DXF** | Individual Piece | `CUT` (color 1), `ENGRAVE` (color 5) | AutoCAD R12 standard ASCII DXF with closed `POLYLINE` loops and centered `TEXT`. |
| **DXF** | Combined Cut Sheet | `CUT`, `ENGRAVE`, `BORDER` | Complete multi-piece nested cut layout in DXF for CNC and laser router controllers. |
| **Drawing** | Engineering Drawing | Extension lines, title block | Dimensioned vector SVG with overall width and height, material thickness, interface callouts, and ANSI title block. |

---

## 4. Supported 3D Formats

| Format | Standard | Coordination Space | Key Features |
| :--- | :--- | :--- | :--- |
| **STL** | Stereolithography | Piece-Local & World Assembled | ASCII STL with facet surface normals, valid triangle loops; suitable for 3D printing and CAM. |
| **OBJ** | Wavefront OBJ | Piece-Local & World Assembled | Named object groups (`o Piece_<pieceId>`), preserving 100% piece identity in Blender, Maya, and CAD. |
| **glTF** | glTF 2.0 JSON | World Assembled Scene | Standard scene hierarchy with node translations, rotations (quaternions), and metadata `extras`. Embedded Base64 binary buffer. |
| **STEP** | ISO 10303-21 | Piece-Local & World Assembled | `MANIFOLD_SOLID_BREP` / `FACETED_BREP` geometry with `PRODUCT` definitions preserving piece IDs. Compatible with SolidWorks, Fusion 360, and FreeCAD. |

---

## 5. Metadata Package

The metadata package provides machine-readable representations of the complete validated puzzle:

1. `puzzle.json`: High-level specification, overall dimensions ($W \times H \times T$), target piece count, material properties, and generator version.
2. `pieces.json`: Array of all piece geometries, dimensions, stock thickness, 2D local bounds, centroids, and attached canonical interfaces.
3. `connections.json`: Array of all physical connectors with participating pieces, interface IDs, connector types, clearances, and applied joining angles.
4. `assembly_configuration.json`: Solved 3D spatial transforms (`position`, `rotation`, `scale`) per piece, root piece ID, and placement order.
5. `assembly_sequence.json`: Explicit step-by-step physical assembly progression with added pieces, active joints, and step descriptions.
6. `validation_report.json`: Phase 90 validation audit confirming zero collisions, valid clearances, and 100% geometric feasibility.

---

## 6. Identifier Preservation & Geometric Fidelity

- **Piece ID Preservation**: Every exported 2D file, 3D file, and metadata JSON preserves the exact authoritative `pieceId` (e.g. `P_001` or `piece_0`).
- **Connection ID Preservation**: Every connector retains its exact `connectionId` (e.g. `c01` or `conn_12`).
- **Geometric Fidelity**: The exported 2D loops and 3D mesh vertices correspond bit-for-bit with the validated generative design models.
