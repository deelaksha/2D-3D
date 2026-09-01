# Ground-Truth Comparison Subsystem Specification (Step 36)

This document specifies the **Ground-Truth Comparison Subsystem** for evaluating generated designs against reference CAD/IR specifications.

---

## 1. Architectural Mandate & Structured Delta Format

> [!IMPORTANT]
> **STRUCTURED DELTA REPORTING & CONFIGURABLE TOLERANCE**:
> - **Structured Diff**: Returns structured diff objects for every compared property:
>   `EXPECTED: tab_width = 10.0 | GENERATED: tab_width = 10.2 | difference = +0.2mm`
> - **Tolerance Support**: Small variances within configurable engineering tolerances ($\Delta \text{linear} \le 0.5\text{mm}$, $\Delta \text{angular} \le 1.0^\circ$) are marked `withinTolerance: true` rather than automatically failing evaluation.

---

## 2. Comparison Modes

1. **`exact`**: Numerical exactness check (linear tolerance threshold = $0.0001\text{mm}$).
2. **`tolerance`**: Engineering tolerance check ($\Delta \text{linear} \le 0.5\text{mm}$, $\Delta \text{profile} \le 0.2\text{mm}$, $\Delta \text{angular} \le 1.0^\circ$).
3. **`topological`**: Graph isomorphism, node/edge adjacency, precision, recall, and F1 score.

---

## 3. Programmatic API Usage

```typescript
import { GroundTruthComparisonEngine } from "@/core/puzzle/comparison";

// Compare reference puzzle IR against generated puzzle IR
const report = GroundTruthComparisonEngine.compare(
  referencePuzzle,
  generatedPuzzle,
  "tolerance",
  { profileToleranceMm: 0.5 }
);

console.log(`Matched: ${report.isMatched} (${report.mismatchesOutsideTolerance} mismatch(es) outside tolerance).`);
for (const diff of report.diffItems) {
  console.log(`- ${diff.propertyName}: expected ${diff.expected}, generated ${diff.generated} (diff: ${diff.difference}${diff.unit}, OK: ${diff.withinTolerance})`);
}
```
