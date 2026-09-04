# AI Design Critic Architecture (Phase 72)

## 1. Overview & Core Invariants

The **AI Design Critic Subsystem** evaluates candidate puzzle designs and their deterministic validation results across 8 distinct engineering, manufacturing, and aesthetic domains.

### Fundamental Architectural Invariants
> [!IMPORTANT]
> 1. **Validation Non-Override Invariant**:
>    The critic **must NOT override deterministic validation results**. If the deterministic geometry, connection, or 3D assembly validation engines report a failure, the critic strictly marks it as a `HARD_FAILURE` and rejects the design. The critic cannot "forgive" physical or mathematical impossibilities.
> 2. **Read-Only / No Direct Geometry Mutation**:
>    The critic produces structured, actionable diagnostic feedback (`DesignCritique`, `CritiqueIssue`, `SuggestedParameter`) but **never directly alters CAD coordinates, vertex loops, or piece boundaries**.

```
    CanonicalPuzzle + ParametricDesignSpecification + AIValidationPasses
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DeterministicDesignCritic.critique()                                   │
│                                                                        │
│ 1. Deterministic Validation Invariant Guard                            │
│    • Schema / Hard constraints / Geometry / Connection / 3D            │
│    • Failure -> Invariant preserved as HARD_FAILURE                    │
│                                                                        │
│ 2. Domain Evaluation (8 Dimensions)                                    │
│    • Geometry Quality (aspect ratios, thin walls, stability)          │
│    • Connection Quality (clearance bounds, port proportions)           │
│    • Assembly Flexibility (joining angles, insertion feasibility)      │
│    • Difficulty Alignment (piece count vs target tier)                 │
│    • Material Utilization (nesting density on cardboard sheet)         │
│    • Manufacturability (laser kerf, min bridge width)                  │
│    • Symmetry (bilateral balance, mirrored piece pairs)                │
│    • Aesthetic Preferences (proportions, visual stability)             │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
                           DesignCritique Record
 ┌───────────────────────────────────────────────────────────────────────┐
 │ • critiqueId, designId, evaluatedAt                                   │
 │ • overallAssessment: PASS | NEEDS_REVISION | REJECTED                 │
 │ • scores: Domain scores [0.0, 100.0] & compositeQualityScore          │
 │ • issues: CritiqueIssue[]                                             │
 │     - category, severity (HARD_FAILURE | WARNING | STYLE_PREFERENCE)  │
 │     - affectedEntity: { type, id, name }                              │
 │     - reason: Detailed diagnostic explanation                         │
 │     - suggestedParameter: { parameterName, current, suggested, why }   │
 │ • deterministicValidationUnaltered: true (STRICT INVARIANT)           │
 └───────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 8 Evaluation Domains

| Domain | Evaluation Focus | Typical Issues Detected |
|---|---|---|
| **1. Geometry Quality** | Aspect ratios, thin strips, dimensional stability, non-degenerate vertices. | Thin noodle pieces ($W/H > 6.0$), non-positive dimensions ($W \le 0$). |
| **2. Connection Quality** | Joint clearance, friction fit, port proportions, engagement depth. | Tight clearance ($< 0.08\text{mm}$ - jamming risk), loose clearance ($> 0.35\text{mm}$ - wobble). |
| **3. Assembly Flexibility** | Insertion kinematics, non-standard angles, physical sequence feasibility. | Non-standard joining angles ($72.5^\circ$), complex multi-axis entrapment. |
| **4. Difficulty** | Cognitive load alignment with requested difficulty tier (Phase 69). | Excessive piece count ($N > 6$) for an `'easy'` difficulty target. |
| **5. Material Utilization** | Cardboard sheet packing efficiency ($\sum A_{\text{piece}} / A_{\text{stock}}$). | Low nesting utilization ($< 25\%$) resulting in high scrap waste. |
| **6. Manufacturability** | Laser kerf compensation, minimum bridge width ($\ge 3.0\text{mm}$), burn risk. | Laser kerf deviation ($< 0.05\text{mm}$ or $> 0.3\text{mm}$). |
| **7. Symmetry** | Axis alignment, bilateral balance, mirrored wall piece pairs. | Odd wall count ($N_{\text{walls}} = 3$) when bilateral symmetry is requested. |
| **8. Aesthetic Preferences** | Harmonious proportions, visual balance, ergonomic grip. | Extreme bounding aspect ratio ($> 3.0$ or $< 0.4$). |

---

## 3. 3-Tier Severity Taxonomy

The critic categorizes every detected issue into three explicit tiers:

```
                  ┌─────────────────────────────────────┐
                  │          Severity Tiers             │
                  └──────────────────┬──────────────────┘
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
     [HARD_FAILURE]              [WARNING]           [STYLE_PREFERENCE]
  • Violates physical laws   • Risky condition    • Aesthetic preference
  • Deterministic failure    • Manufacturable     • Non-critical balance
  • Prevents assembly        • Suboptimal waste   • Ergonomic recommendation
            │                        │                        │
            ▼                        ▼                        ▼
  Assessment: REJECTED     Assessment: REVISION      Assessment: PASS (notes)
```

1. **`HARD_FAILURE`**:
   - Condition: Physical impossibility, deterministic validation failure, self-intersection, zero/negative piece dimensions, or cardboard sheet overflow.
   - Consequence: Design is marked `overallAssessment: "REJECTED"`, composite score is capped at $< 40$, and CAD export is blocked.
2. **`WARNING`**:
   - Condition: Manufacturable but suboptimal engineering condition (e.g. clearance $< 0.08\text{mm}$, low sheet utilization $< 25\%$, narrow bridge width, high aspect ratio).
   - Consequence: Design is marked `overallAssessment: "NEEDS_REVISION"` with actionable parameter modification targets.
3. **`STYLE_PREFERENCE`**:
   - Condition: Subjective or non-critical design preference (e.g. non-standard joining angle, asymmetric piece layout when symmetry requested, non-golden-ratio proportions).
   - Consequence: Advisory notes; does not block passing assessment if no warnings or hard failures are present.

---

## 4. Structured Output Format: Issues & Suggested Parameters

Rather than mutating geometry, the critic outputs typed `SuggestedParameter` objects that downstream parametric repair loops can execute cleanly:

```typescript
interface CritiqueIssue {
  id: string;
  category: CritiqueCategory;
  severity: "HARD_FAILURE" | "WARNING" | "STYLE_PREFERENCE";
  affectedEntity: {
    type: "piece" | "interface" | "connection" | "material" | "specification" | "assembly";
    id: string;
    name?: string;
  };
  reason: string;
  suggestedParameter?: {
    parameterName: string;
    currentValue: number | string | boolean;
    suggestedValue: number | string | boolean;
    rationale: string;
  };
}
```

### Example Suggested Parameter:
```json
{
  "parameterName": "clearance",
  "currentValue": 0.04,
  "suggestedValue": 0.15,
  "rationale": "Increase clearance to 0.15mm for reliable slip-fit assembly in corrugated cardboard."
}
```

---

## 5. Verification & Testing

The AI Design Critic is verified in `src/__smoke__/aiDesignCriticPhase72.test.ts`, covering:
1. Pristine design evaluation resulting in `overallAssessment: "PASS"` with scores $\ge 85.0$ and zero hard failures.
2. `HARD_FAILURE` detection preserving deterministic validation failures and non-positive piece dimensions.
3. `WARNING` detection identifying overly tight clearance ($0.04\text{mm}$) and low sheet utilization with structured parameter suggestions.
4. `STYLE_PREFERENCE` detection identifying asymmetric wall layouts when bilateral symmetry is requested.
5. Simultaneous classification of all 3 severity levels in a composite critique.
6. Byte-for-byte immutability confirming the critic never mutates puzzle boundaries, coordinates, or specifications.
