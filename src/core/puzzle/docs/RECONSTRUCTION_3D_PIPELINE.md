# 3D Reconstruction & Assembly Pipeline Specification

This document specifies the 3D reconstruction and assembly pipeline for converting canonical 2D parametric representations (`CanonicalPuzzle`) into extruded 3D solid assemblies (`SolidRepresentation3D` + `AssemblyConfiguration`) with reference geometry mismatch detection.

---

## 1. Architectural Mandate & Pipeline Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        3D RECONSTRUCTION & ASSEMBLY PIPELINE                           │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [1] 2D GEOMETRY ─────────> Validates boundary polyline loops & hole cutouts.
  [2] VALIDATED PROFILE ──> Ensures non-zero positive piece dimensions (W x H x T).
  [3] EXTRUSION / THICKNESS > Extrudes 2D profiles through material thickness T along Z-axis.
  [4] LOCAL 3D PIECE ──────> Constructs local 3D solid mesh (SolidRepresentation3D).
  [5] ASSEMBLY TRANSFORMS ──> Applies 3D rotation quaternions & translations (AssemblyConfiguration).
  [6] 3D ASSEMBLY & REF ───> Computes geometric differences against reference CAD manifest.
```

---

## 2. Key Architectural Invariants

> [!IMPORTANT]
> **ORIENTATION SEPARATION & ARBITRARY 3D ROTATIONS**:
> - **Orientation Separation**: The 2D drawing defines 2D piece geometry and thickness $T$. 3D spatial poses belong exclusively to `AssemblyConfiguration`.
> - **Arbitrary 3D Rotations**: Placements support full 3D rotation quaternions $q = (x, y, z, w)$ for non-planar $90^\circ$ box corner joints and angled miter folds.
> - **Explicit Reference Differences**: When reference CAD geometry is supplied, the pipeline computes and returns explicit geometric difference metrics ($d_H$, $d_C$, IoU, position delta) rather than silently accepting mismatches.

---

## 3. Structural Output Payload (`Reconstruction3DOutput`)

```typescript
export interface GeometricDifferenceReport {
  referenceAssemblyId?: string;
  hausdorffDistanceMm: number;        // Hausdorff distance metric (mm)
  chamferDistanceMm: number;          // Chamfer distance metric (mm)
  boundingVolumeIoU: number;          // Bounding volume Intersection over Union (0.0 to 1.0)
  centroidOffsetMm: number;           // Centroid translation delta (mm)
  pieceCountDelta: number;            // Piece count disparity
  hasMismatch: boolean;               // True if geometric mismatch detected
  mismatchSummary: string;            // Detailed diagnostic summary text
}

export interface Reconstruction3DOutput {
  success: boolean;
  puzzleId: string;
  solids: Map<string, SolidRepresentation3D>;   // Local extruded 3D solid meshes
  placements: Map<string, AssemblyPlacement>;    // 3D world poses & quaternions
  graph: PuzzleAssemblyGraph;                   // Topology assembly graph
  referenceDifferences?: GeometricDifferenceReport; // Comparison report
  diagnostics: ReconstructionDiagnostics;       // Diagnostic logs
  durationMs: number;
}
```

---

## 4. Programmatic API Usage

To execute 3D reconstruction and compare against a reference CAD manifest:

```typescript
import { Pipeline3D } from "@/core/puzzle/reconstruction";

// 1. Execute 3D reconstruction pipeline
const result = Pipeline3D.reconstructAndAssemble(canonicalPuzzle, referenceManifest);

if (result.success) {
  console.log(`Reconstructed ${result.solids.size} 3D solid(s) in ${result.durationMs}ms.`);

  if (result.referenceDifferences?.hasMismatch) {
    console.warn("Reference Mismatch Detected:", result.referenceDifferences.mismatchSummary);
  } else {
    console.log("3D assembly matches reference CAD geometry!");
  }
}
```
