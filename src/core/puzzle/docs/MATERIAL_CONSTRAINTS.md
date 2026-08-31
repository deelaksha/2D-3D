# Material & Cardboard Constraint Subsystem Specification (Phase 8)

This document specifies the **Material/Cardboard Constraint Subsystem** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles & Parameter Hierarchy

The subsystem enforces physical manufacturing constraints based on selected stock cardboard specifications across four distinct parameter levels:

### 1. GLOBAL MATERIAL PARAMETERS (`GlobalMaterialParameters`)
- `stockWidth`: Total stock sheet width in mm (e.g. 600mm)
- `stockHeight`: Total stock sheet height in mm (e.g. 400mm)
- `stockThickness`: Stock cardboard thickness in mm (e.g. 2.0mm)
- `stockTolerance`: Mechanical slot fit tolerance in mm (e.g. 0.15mm)
- `density`: Material density in g/cm^3
- `grainDirectionDeg`: Grain/flute orientation angle (degrees)
- `minBendRadius`: Minimum allowable bend radius (mm)

### 2. DESIGN PARAMETERS (`DesignParameters`)
- `manufacturingMargin`: Outer edge sheet margin required for cutter bed clamping (mm)
- `minClearance`: Minimum clearance gap between nested pieces (mm)
- `minFeatureSize`: Minimum allowable slot/tab/peg/hole dimension (mm)
- `isLockedByDesign`: Boolean flag preventing silent AI or automated parameter mutations

### 3. PIECE PARAMETERS (`PieceParameters`)
- `pieceId`: Unique piece ID
- `name`: Human-readable label
- `width`: Piece 2D footprint width (mm)
- `height`: Piece 2D footprint height (mm)
- `thickness`: Stock material thickness (mm)
- `materialId`: Reference material spec ID

### 4. ASSEMBLY PARAMETERS (`AssemblyParameters`)
- `totalMaterialAreaUsed`: Total nested footprint area (mm^2)
- `stockSheetCount`: Number of cardboard sheets required
- `maxCantileverOverhang`: Maximum unsupported overhang (mm)

---

## 2. Usable Material Area Calculation

The usable sheet dimensions after reserving laser bed clamping margins:
\[
\text{usableAreaWidth} = \text{stockWidth} - 2 \times \text{manufacturingMargin}
\]
\[
\text{usableAreaHeight} = \text{stockHeight} - 2 \times \text{manufacturingMargin}
\]

---

## 3. Physical Verification Rules (7 Core Verifications)

1. **`checkPieceWidth`**: Verifies piece `width <= usableAreaWidth`.
2. **`checkPieceHeight`**: Verifies piece `height <= usableAreaHeight`.
3. **`checkPieceThickness`**: Verifies piece `thickness == stockThickness` (must match selected stock cardboard).
4. **`checkUsableMaterialArea`**: Verifies piece footprint area does not exceed total usable sheet area.
5. **`checkManufacturingMargin`**: Enforces outer edge sheet margin (\(\text{usableWidth} > 0\)).
6. **`checkMinimumClearance`**: Enforces minimum gap between nested piece contours (\(\ge \text{minClearance}\)).
7. **`checkMinimumFeatureSize`**: Verifies no tab, slot, peg, or hole dimension is smaller than `minFeatureSize`.

---

## 4. Anti-Mutation Guardrails against Silent AI Mutations

AI models or automated constraint solvers **must never** silently mutate fixed manufacturing parameters once selected for a design (`isLockedByDesign: true`).

Any unsanctioned modification attempt to `stockWidth`, `stockHeight`, `stockThickness`, or `manufacturingMargin` triggers a `SILENT_MUTATION_PREVENTED` error check.
