# Synthetic Puzzle Data Generator Specification (Phase 42)

This document specifies the **Synthetic Puzzle Data Generator** for generating controlled, deterministic synthetic puzzle examples (both valid and invalid assemblies) for future AI model training and evaluation.

---

## 1. Architectural Mandate & Generator Invariants

> [!IMPORTANT]
> **SEEDED DETERMINISM & CONTROLLED INVALIDITY**:
> - **Seeded PRNG Determinism**: Given a specific integer seed (e.g. `seed = 42`), the generator produces **100% identical** synthetic puzzle instances, geometry primitives, connection graphs, and validation reports across executions.
> - **Explicit Invalidity Injection**: Generates controlled invalid examples with explicit failure reasons (`incompatible_interfaces`, `collision`, `insufficient_clearance`, `disconnected_assembly`, `invalid_dimensions`, `invalid_cardboard_size`, `impossible_angle`, `self_intersection`).
> - **Zero Model Training**: Produces dataset examples; zero model training is performed in this phase.

---

## 2. Generated Example Output Schema (`SyntheticGeneratedExample`)

Every generated synthetic example contains 6 complete domain representations:

```typescript
export interface SyntheticGeneratedExample {
  exampleId: string;
  seed: number;
  inputParameters: SyntheticGenerationConfig;  // Input configuration
  canonicalPuzzle: CanonicalPuzzle;            // Canonical Puzzle IR
  geometry: Extracted2DGeometryResult;         // 2D primitives & loops
  connectionGraph: PuzzleAssemblyGraph;       // Topology graph G = (V, E)
  assemblyPlacements: Map<string, AssemblyPlacement>; // 3D placements & quaternions
  validationResult: DatasetAcceptanceReport;   // Quality gate report (PASS/FAIL)
  isValid: boolean;
  invalidityReason?: SyntheticInvalidityReason;
}
```

---

## 3. Controlled Variations & Invalidity Injections

The generator creates variations across:
- Piece count ($N \in [2, 20]$)
- Piece dimensions ($W, H \in [30\text{mm}, 500\text{mm}]$)
- Cardboard thickness ($T \in [1.5\text{mm}, 10.0\text{mm}]$)
- Tab size & slot size ($\text{width} \in [10\text{mm}, 40\text{mm}]$)
- Connection type (`tab_slot`, `interlock`, `edge_contact`)
- Assembly angles ($\theta \in [0^\circ, 180^\circ]$)
- Symmetry modes (`none`, `bilateral`, `radial`)

### Invalidity Flaw Injection Matrix:
| Flaw Code | Injection Mechanism | Quality Gate Result |
| :--- | :--- | :--- |
| `incompatible_interfaces` | Connects male tab to male tab (`insert` + `insert`). | `FAIL` |
| `insufficient_clearance` | Tab width exceeds slot width by $> 2.0\text{mm}$. | `FAIL` |
| `disconnected_assembly` | Omits connection edges between pieces in graph. | `FAIL` |
| `invalid_dimensions` | Assigns negative or zero piece dimensions ($W \le 0$). | `FAIL` |
| `collision` | Sets overlapping 3D world placement positions. | `FAIL` |

---

## 4. Scaling Guidelines for Future ML Training

When scaling dataset generation for deep learning:
1. **Balanced Dataset Splits**: Generate a 70% Valid / 30% Invalid split across 10,000 synthetic examples.
2. **Deterministic Seed Mapping**: Map seeds `1..7000` to Training, `7001..8500` to Validation, and `8501..10000` to Test.
3. **Graph Export**: Export canonical puzzle IR objects to PyTorch Geometric `Data` format for GNN connection inference training.

---

## 5. Programmatic API Usage

```typescript
import { SyntheticPuzzleGenerator } from "@/core/puzzle/generator";

// Generate a valid synthetic example using seed 42
const validExample = SyntheticPuzzleGenerator.generateExample({
  seed: 42,
  pieceCountRange: [3, 6],
  thicknessMmRange: [3.0, 3.0],
  dimensionMmRange: [50, 100],
  tabWidthMmRange: [15, 20],
  slotWidthMmRange: [15, 20],
  clearanceMmRange: [0.1, 0.2],
  connectionTypes: ["tab_slot"],
  joiningAnglesDeg: [90],
  symmetryMode: "none",
  layers: 1,
  targetValidity: "valid",
});

console.log(`Generated ${validExample.exampleId}: status = ${validExample.validationResult.status}`);
```
