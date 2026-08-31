# Unified Puzzle Validation Engine Specification (Phase 15)

This document specifies the **Unified Puzzle Validation Engine** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Mandate

The `PuzzleValidationEngine` consolidates all specialized validation subsystems into a single orchestrator, covering 5 distinct domains and generating a machine-readable `UnifiedValidationReport` equipped with **AI Repair Directives**.

---

## 2. The 5 Validation Domains

1. **`structural`**: Canonical puzzle model schema validity (`validateCanonicalPuzzle`), piece count & independence, connection integrity, assembly graph connectivity (isolated piece detection, disjoint component search).
2. **`geometric`**: 2D parametric geometry validity (`validateGeneratedGeometry`), 3D solid mesh validity (`validate3DSolidRepresentation`), unwanted 3D spatial collisions (`validate3DAssemblyGeometry`), clearance gap checks.
3. **`connection`**: Interface compatibility (`ConnectionCompatibilityEngine`), joining angle validity, insertion direction alignment, kinematic degrees of freedom.
4. **`manufacturing`**: Cardboard stock sheet bounds, stock thickness match, minimum feature size enforcement, laser bed manufacturing margins (`MaterialConstraintEngine`).
5. **`assembly`**: Rigid 3D spatial transforms, step-by-step physical assembly sequence feasibility (`AssemblySequenceSolver`).

---

## 3. Machine-Readable AI Repair Directives (`AIRepairDirective`)

For every detected defect across all 5 domains, the report includes a structured directive for future AI repair engines:

```json
{
  "issueId": "dir_coll_101",
  "domain": "geometric",
  "severity": "error",
  "targetEntityId": "piece_wall_1",
  "defectCode": "UNEXPECTED_COLLISION",
  "description": "UNEXPECTED 3D COLLISION DETECTED! Non-connected pieces penetrate each other by 4.50mm.",
  "suggestedRemediation": "Adjust 3D position of piece 'piece_wall_1' to eliminate 4.50mm penetration with 'piece_wall_2'.",
  "remediationParams": {
    "pieceIdA": "piece_wall_1",
    "pieceIdB": "piece_wall_2",
    "overlapDepthMm": 4.5
  }
}
```
