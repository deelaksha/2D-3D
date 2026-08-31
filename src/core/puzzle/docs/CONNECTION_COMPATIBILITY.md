# Connection Compatibility Engine Specification (Phase 13)

This document specifies the **Connection Compatibility Engine** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Principles

The engine evaluates whether two connection interfaces and an assembly spatial transform form a physically, geometrically, and kinematically valid connection across 7 distinct criteria.

### No Directional Assumptions
Compatibility checks rely purely on 3D coordinate frames, quaternions, vector dot products, and explicit profile dimensions. They contain **zero hard-coded horizontal/vertical or right/left assumptions**.

---

## 2. The 7 Core Compatibility Check Criteria

1. **`type`**: Interface type and gender role complementarity (`male` + `female` \(\to\) compatible; `male` + `male` \(\to\) incompatible unless overridden).
2. **`profile`**: Feature profile matching (`tab` + `slot`) and width tolerance check.
3. **`angle`**: Requested 3D joining angle \(\theta\) checked against `allowedAngleRange`.
4. **`insertion`**: 3D world alignment between tab insertion vector and slot insertion axis (\(\text{dot} \le -0.5\)).
5. **`clearance`**: Physical clearance gap vs tolerance offset bounds (\(\text{minClearance} \le \text{gap} \le \text{maxClearance}\)).
6. **`dof`**: Kinematic degrees of freedom satisfaction (`translationDOF`, `rotationDOF`).
7. **`physical`**: Spatial frame distance \(\Delta r\) and penetration check in 3D world space.

---

## 3. Extensible Custom Rule Registry (`registerCustomRule`)

Developers can register custom rules for new connection types (e.g., magnetic snaps, sliding dovetails, snap-fit clips) without modifying core engine logic:

```typescript
const engine = new ConnectionCompatibilityEngine();

engine.registerCustomRule({
  name: "Dovetail_Angle_Rule",
  description: "Enforces dovetail 60-degree wedge angle constraint",
  evaluate: (ctx) => {
    // Custom evaluation logic
    return {
      checkKind: "angle",
      satisfied: true,
      score: 1.0,
      message: "Dovetail wedge angle verified."
    };
  }
});
```

---

## 4. Structured Diagnostic Report (`ConnectionCompatibilityReport`)

Returns comprehensive diagnostic results:
- `isCompatible`: `true` if all 7 criteria pass
- `overallScore`: Aggregate score from 0.0 to 1.0
- `checks`: Object containing individual details for each of the 7 checks
- `diagnostics`: Textual summary list for logging and UI feedback
