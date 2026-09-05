# Complete Connector & Assembly Validation Pass (Phase 90)

## Overview

The **Connector & Assembly Validation Subsystem** (Phase 90) provides an exhaustive physical, geometric, kinematic, and topological audit of fully generated 3D assemblies.

It evaluates every connection against **9 connection-level criteria** and the entire assembly against **8 global assembly-level criteria**, generating a structured `AssemblyValidationReport`.

---

## 9 Connection-Level Verification Criteria

For every connection in the puzzle graph:

| # | Criterion | Verification Principle | Failure Code / Category |
|---|---|---|---|
| 1 | **Correct Interface Pairing** | Both interface ports exist on designated pieces; validates gender/role complementarity (`insert` vs `receiver`, `male` vs `female`, not conflicting). | `interface_pairing` |
| 2 | **Correct Connector Type** | Connector type matches one of the canonical definitions (`tab_slot`, `notch`, `interlock`, `keyed`, etc.) and matches interface profiles. | `connector_type` |
| 3 | **Correct Geometry** | Compares tab dimensions with slot dimensions (`tabWidth <= slotWidth`, positive widths, depths). | `geometry` |
| 4 | **Correct Alignment** | Evaluates Euclidean distance between mated interface port origins in 3D world space ($\le 0.5$ mm tolerance). | `alignment` |
| 5 | **Valid Joining Angle** | Checks applied angle against connector kinematic limits (e.g. notch requires 90°, interlock requires 180°/90°, angle within parameter range). | `joining_angle` |
| 6 | **Valid Clearance** | Verifies physical manufacturing clearance $\ge 0.05$ mm. | `clearance` |
| 7 | **No Unintended Penetration** | Rejects fold-back conditions ($\le 5°$) where pieces fold onto each other. | `penetration` |
| 8 | **Insertion Feasibility** | Verifies unobstructed linear approach path (eliminates acute angles $< 15°$ blocked by adjacent stock). | `insertion` |
| 9 | **Final Connection State** | Resolves final state to `"MATED"` (all pass), `"FAILED"`, or `"DISENGAGED"`. | `connection_state` |

---

## 8 Assembly-Level Verification Criteria

For the complete 3D puzzle assembly:

| # | Criterion | Verification Principle | Failure Code / Category |
|---|---|---|---|
| 1 | **All Pieces Included** | Every piece defined in the puzzle specification has a placed 3D transform. | `missing_piece` |
| 2 | **No Unintended Collisions** | Pairwise 3D interference evaluation using `AssemblyCollisionDetector` ensures non-mating pieces do not penetrate. | `collision` |
| 3 | **No Disconnected Pieces** | Graph connectivity traversal (BFS) across all valid mated connections confirms a single connected component. | `connectivity` |
| 4 | **All Mandatory Connections Satisfied** | All mandatory connections in the puzzle graph must have valid `"MATED"` states. | `mandatory_connection` |
| 5 | **Valid Transforms** | Finite coordinates, valid unit quaternions ($\|q\| = 1.0 \pm 10^{-3}$), and positive scale. | `transform` |
| 6 | **Valid Material Dimensions** | Non-degenerate profile bounding box with positive widths and heights. | `material` |
| 7 | **Valid Thickness** | Stock thickness matches piece thickness and material spec. | `thickness` |
| 8 | **Valid Geometry** | Closed boundary profiles, non-zero cross-sectional areas, and valid 3D solid representations. | `geometry` |

---

## Diagnostic Failure Identification

The `AssemblyValidationReport` guarantees exact identification of:
- **`pieceId`**: Identifying the offending piece.
- **`interfaceId`**: Identifying the specific port (if applicable).
- **`connectionId`**: Identifying the specific joint (if applicable).
- **`position`**: 3D world space `Vec3` coordinate.
- **`angleDeg`**: Applied or evaluated joining angle.
- **`failureReason`**: Descriptive diagnosis of the validation violation.

Strict contract: **Never return `isValid = true` if any mandatory validation fails**.
