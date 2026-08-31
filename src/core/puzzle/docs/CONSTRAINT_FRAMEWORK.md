# Generic Constraint Framework Specification (Phase 7)

This document specifies the **Generic Constraint Framework** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Principles

### Declarative Constraint Specification
Constraints are specified declaratively with explicit ID, constraint type, severity level, involved entity IDs, parameter bounds, and diagnostic feedback.

### HARD vs SOFT Severity Distinction
- **`HARD` Constraint**: Critical geometric, physical, or mechanical rule (e.g. non-overlap collision avoidance, valid 3D joining angle, cardboard slot width vs thickness). Must **never** be silently violated. If a HARD constraint fails, `ConstraintFrameworkReport.overallSatisfied` evaluates to `false` and flags a critical error.
- **`SOFT` Constraint**: Desirable layout goal or aesthetic preference (e.g. preferred clearance gap, symmetry preference). Violations generate non-zero residual penalties (`residual > 0`) without failing hard assembly validation.

---

## 2. 12 Core Supported Constraint Types

1. **`distance`**: Point/interface distance bounds (`targetValue`, `tolerance`).
2. **`alignment`**: Vector parallel/antiparallel alignment (`targetDot`).
3. **`angle`**: Target 3D joining angle or range (`minAngleDeg`, `maxAngleDeg`).
4. **`contact`**: Surface zero-clearance contact.
5. **`clearance`**: Minimum clearance distance along insertion axis (`minClearanceMm`).
6. **`non_overlap`**: Collision & interpenetration avoidance between 3D bounding volumes.
7. **`interface_compatibility`**: Mating rules (gender role, profile width match).
8. **`dimension`**: Piece footprint width, height, thickness bounds.
9. **`position`**: Fixed 3D position vector constraint (`targetPosition`).
10. **`rotation`**: Fixed 3D rotation quaternion constraint (`toleranceDeg`).
11. **`symmetry`**: Symmetrical piece placement constraint (`symmetryErrorMm`).
12. **`material_constraints`**: Cardboard stock thickness vs slot width and bend radius limits.

---

## 3. Constraint Engine API (`ConstraintFrameworkEngine`)

```typescript
const engine = new ConstraintFrameworkEngine();

// Register a HARD non-overlap constraint
engine.addConstraint({
  id: "c_non_overlap_1",
  type: "non_overlap",
  severity: "HARD",
  involvedEntityIds: ["piece_wall_1", "piece_wall_2"],
  parameters: {},
});

// Evaluate all constraints against assembly context
const report = engine.evaluateAllConstraints({
  c_non_overlap_1: { isColliding: false, overlapDepth: 0.0 }
});

console.log(report.overallSatisfied); // true
```
