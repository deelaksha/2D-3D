# High-Level Autonomous Puzzle Generator API (Phase 92)

## Overview

The High-Level Autonomous Puzzle Generator provides a single, zero-friction entrypoint:

```typescript
const result: PuzzleGenerationResult = await generatePuzzle(
  "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
);
```

The caller does not need to manually construct pieces, connection graphs, connector geometries, transforms, or validation loops.

---

## 15-Stage Pipeline

```
Requirement (string or object)
   ↓ 1. Requirement Parsing (piece count, material, thickness, non-planar/planar intent)
   ↓ 2. Design Specification Synthesis (global bounds, grid configuration, tolerances)
   ↓ 3. Global 2D Boundary Generation (contour generation & validation)
   ↓ 4. Piece Partitioning (cell decomposition, boundary clipping, interface extraction)
   ↓ 5. Connection Graph Generation (topology mapping, adjacency, clearance constraints)
   ↓ 6. Connector Generation (gender, keying, parametric connector parameters)
   ↓ 7. Connector Placement (boundary positioning, interface binding)
   ↓ 8. 2D Validation Pass (watertight profiles, dimensions, interface pairing)
   ↓ 9. 3D Piece Generation (extrusion, solid boundary evaluation, local frames)
   ↓ 10. Joining Angle Generation (candidate evaluation, non-planar / 3D folding angles)
   ↓ 11. Automatic 3D Assembly (root selection, constraint solving, transform graph propagation)
   ↓ 12. Assembly Collision Validation (AABB, exact mesh intersection, clearance checking)
   ↓ 13. Assembly Feasibility Analysis (disconnection checks, insertion trajectory validation)
   ↓ 14. Autonomous Local Repair (closed-loop repair cycle if any failure occurs)
   ↓ 15. Final Comprehensive Assembly Validation (Phase 90 compliance check)
Validated PuzzleGenerationResult
```

---

## Output Contract (`PuzzleGenerationResult`)

Every execution returns a unified `PuzzleGenerationResult`:

| Field | Type | Description |
|---|---|---|
| `designSpecification` | `DesignSpecification` | Resolved puzzle design specifications |
| `pieces2D` | `GeneratedPiece2D[]` | Extracted 2D boundary pieces with interfaces |
| `connectors` | `GeneratedConnection2D[]` | 2D connector instances with tolerances |
| `connectionGraph` | `ConnectionGraph` | Adjacency topology of all puzzle components |
| `pieces3D` | `Piece3D[]` | Extruded solid 3D pieces with local coordinate frames |
| `assembly` | `SuccessfulAssembly` | Final 3D assembly with world transforms & states |
| `validationReport` | `AssemblyValidationReport` | Comprehensive multi-pass validation report |
| `repairHistory` | `RepairHistory` | Trace of any repair attempts applied during synthesis |
| `generationStatistics` | `GenerationStatistics` | Stage-by-stage runtime profiling and metric counters |

---

## Example Usage

### Natural Language Requirement
```typescript
import { generatePuzzle } from './highlevelapi';

const result = await generatePuzzle(
  "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
);

console.log(`Assembled ${result.pieces3D.length} 3D pieces in ${result.generationStatistics.totalDurationMs}ms.`);
console.log(`Validation status: ${result.validationReport.isValid ? 'PASSED' : 'FAILED'}`);
```

### Structured Object Requirement
```typescript
import { HighLevelPuzzleGenerator } from './highlevelapi';

const generator = new HighLevelPuzzleGenerator();
const result = await generator.generatePuzzle({
  pieceCount: 16,
  material: 'cardboard',
  thickness: 3,
  nonPlanar: true,
  overallSize: { width: 160, height: 160 }
});
```
