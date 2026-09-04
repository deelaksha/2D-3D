# AI-Assisted Puzzle Design Generation Architecture (Phase 71)

## 1. Overview & Architectural Boundaries

Phase 71 establishes the first real **AI-assisted parametric puzzle design generation workflow**.

### Fundamental Architectural Invariant
> [!CRITICAL]
> **The AI layer NEVER directly generates STL, STEP, raw mesh vertices, or arbitrary CAD geometry.**
>
> Generative neural networks and LLMs are strictly bounded to semantic reasoning and structured parametric synthesis (`ParametricDesignSpecification`). The **deterministic geometry engine** remains the sole authority for physical coordinates, 2D boundaries, 3D solid extrusions, and mechanical validation.

```
  Natural-Language Requirement
               +
    Optional Reference Image
               +
   Optional Retrieved Designs
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ AIDesignGenerator (Reasoning across 11 Domains)        │
│   • Piece count & geometry decomposition               │
│   • Interfaces, connections, & topology                │
│   • Material stock & cardboard nesting bounds          │
│   • Difficulty & assembly kinematics                   │
│   • Allowed joining angles & manufacturing kerf        │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼ Output: Strictly Structured JSON Payload
          ParametricDesignSpecification
                       │
                       ▼ Input to Deterministic Core
┌────────────────────────────────────────────────────────┐
│ DesignSpecificationCompiler                            │
│   • Deterministic 2D boundary loop generator           │
│   • Complementary interface port synthesizers          │
│   • 3D spatial coordinate frame assignment             │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│ DesignValidationPipeline (5 Deterministic Gates)       │
│   Gate 1: Schema Validation                            │
│   Gate 2: Hard Constraint Validation                   │
│   Gate 3: 2D Geometry Validation                       │
│   Gate 4: Connection Validation                        │
│   Gate 5: 3D Assembly Validation                       │
└──────────────────────┬─────────────────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      [ALL 5 PASS]         [ANY 1 FAILS]
            │                    │
            ▼                    ▼
     Status: ACCEPTED     Status: REJECTED
            │                    │
            ▼                    ▼
   CanonicalPuzzle      Error Diagnostics
   Ready for CAD        (No CAD Export)
```

---

## 2. The 11 AI Reasoning Domains

The AI layer reasons over 11 distinct physical and manufacturing domains before outputting a specification:

| Domain | Description & Reasoning Focus | Output Specification Field |
|---|---|---|
| **1. Piece Count** | Decomposes user functional requirements into a minimum viable or target assembly piece count ($N \ge 2$). | `piece_count` |
| **2. Geometry** | Determines overall 3D bounding envelope ($W \times H \times D$) and aspect ratios. | `overall_size` |
| **3. Interfaces** | Sizes contact tabs, slots, and mortise/tenon joints with laser clearance allowances (e.g. 0.15mm). | `connection_preferences.genderStyle`, interface profiles |
| **4. Connections** | Selects connection joint mechanisms (`tab_slot`, `sliding`, `interlock`, `hinge`) and spanning tree graphs. | `connection_preferences.defaultType` |
| **5. Material** | Selects stock cardboard thickness (e.g. 2.0mm, 3.0mm corrugated/greyboard) and density properties. | `material.materialId`, `material.stockThicknessMm` |
| **6. Cardboard Dimensions** | Verifies that all disassembled pieces nest within maximum laser cutter stock dimensions (e.g. 600x400mm). | `material.stockWidthMm`, `material.stockHeightMm` |
| **7. Difficulty** | Target difficulty rating (`easy`, `medium`, `hard`, `expert`) aligned with Phase 69 formal scoring. | `difficulty.level`, `difficulty.maxUniquePieces` |
| **8. Assembly Flexibility** | Enforces single-axis linear insertion paths to guarantee physical assemblability without entrapment. | Constraints and kinematics |
| **9. Allowed Angles** | Sets discrete or continuous joining angles (e.g. 45° miter, 90° orthogonal, 60° easel). | `connection_preferences.preferredJoiningAngleDeg` |
| **10. Layers** | Stacking and depth layers for multi-layer cardboard puzzle construction. | `layers` |
| **11. Manufacturing Constraints** | Enforces laser kerf compensation (0.1mm), minimum structural bridge width ($\ge 5.0\text{mm}$), and grain alignment. | `manufacturingParameters.kerf` |

---

## 3. The 5-Gate Validation Pipeline

Every proposed design is passed through the 5 deterministic validation gates:

### Gate 1: Schema Validation
- Validates the `ParametricDesignSpecification` JSON schema against structural invariants.
- Rejects malformed JSON, missing required fields, or non-numeric dimension values.

### Gate 2: Hard Constraint Validation
- **Piece Count**: Must satisfy $2 \le N \le 100$.
- **Layers**: Must satisfy $\ge 1$.
- **Cardboard Sheet Bounds**: Overall assembly width and height must not exceed the specified sheet stock envelope (`overall_size.widthMm <= stockWidthMm`).
- **Declarative Constraints**: Verifies that any user-specified hard constraints are satisfied.

### Gate 3: 2D Geometry Validation
- Confirms compiled canonical pieces have valid, non-empty, non-self-intersecting 2D boundary loops.
- Rejects any piece with non-positive dimensions ($W \le 0$, $H \le 0$, $T \le 0$).

### Gate 4: Connection Validation
- Verifies that all connection edges link existing interfaces with complementary gender roles (`insert` vs `receiver`).
- Rejects identical gender collisions (e.g. tab-to-tab) and out-of-bounds clearance tolerances.

### Gate 5: 3D Assembly Validation
- Verifies that 3D joining angles lie within valid physical bounds $[0^\circ, 180^\circ]$.
- Confirms orthogonal unit coordinate frames for all parts.
- Ensures absence of unphysical interpenetration.

---

## 4. Anti-Cloning Invariant for Retrieved Design References

When optional retrieved designs from Phase 70 are provided:
1. **Reference Exemplar Only**: The retrieved design is treated strictly as a structural guide.
2. **Parametric Adaptation**: The AI generator adapts the reference's topological patterns and joint styling while scaling dimensions to the user prompt and updating piece counts.
3. **Automated Non-Cloning Audit**: `ReferenceDesignProtector.assertNotCloned(reference, generatedPuzzle)` verifies that:
   - Metadata IDs are completely distinct.
   - Piece IDs are not copied.
   - 1:1 identical geometry replicas are rejected.

---

## 5. Verification & Testing

The generation workflow is covered by end-to-end tests in `src/__smoke__/aiAssistedDesignGenerationPhase71.test.ts`, verifying:
1. Natural language prompts generating accepted specifications through all 5 validation gates.
2. Anti-cloning compliance when adapting retrieved design templates.
3. Dimension inference from optional reference image inputs.
4. Non-90-degree (45.0°) miter joining angle reasoning and compilation.
5. Strict rejection of specifications violating hard constraints ($N < 2$) or exceeding sheet stock boundaries.
