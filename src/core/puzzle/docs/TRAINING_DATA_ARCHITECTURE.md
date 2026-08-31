# Training Data Architecture Specification (Phase 17)

This document specifies the **Training Data Architecture** for the Parametric 2D-to-3D Cardboard Puzzle System.

---

## 1. Executive Summary & Strict Constraints

> [!IMPORTANT]
> **NO ML MODEL TRAINING & NO REAL DATASET COLLECTION YET**:
> This phase defines dataset schemas, directory layouts, TypeScript interfaces, validators, documentation, and a minimal synthetic test example. No ML models are trained, and no real user datasets are collected or converted in this phase.

---

## 2. Directory Layout & File Organization

```
training_data/
├── README.md                           # Dataset specification & guidelines
├── schema/
│   └── dataset_schema.json             # JSON Schema draft-07
├── examples/
│   └── minimal_synthetic_example.json  # Schema-compliant synthetic test example
├── raw/                                # Raw 2D drawings & unstructured inputs
├── processed/                          # Vectorized & canonicalized puzzle models
├── validation/                         # Validation reports & failure logs
└── splits/
    ├── train/                          # 80% Training split
    ├── validation/                     # 10% Validation split
    └── test/                           # 10% Evaluation split
```

---

## 3. The 17-Step Complete Parametric Puzzle Lifecycle

Every dataset item explicitly records all 17 stages of the parametric lifecycle:

1. **`userRequirement`**: Natural language prompt & target difficulty.
2. **`source2DDrawingPath`**: Relative path to 2D image/drawing.
3. **`segmentationContours`**: 2D polygon boundaries per piece.
4. **`pieces` (Geometry)**: Exact 2D parametric geometry primitives.
5. **`interfaces`**: Connection ports, local frames, profile dimensions, gender roles.
6. **`connections`**: Connection graph \(G = (V, E)\) edges.
7. **`parametric_dimensions`**: Width, height, thickness, tab/slot width & depth.
8. **`material_specification`**: Cardboard stock sheet parameters (thickness, tolerance, density).
9. **`piece_3d_representation`**: Extruded 3D solid mesh in piece-local space (\(z \in [-T/2, +T/2]\)).
10. **`assembly_transforms`**: 3D spatial placement transforms (\(T(x,y,z,q_x,q_y,q_z,q_w)\)).
11. **`joining_angles`**: Explicit 3D joining angles (0°, 30°, 45°, 60°, 90°).
12. **`assembly_sequence`**: Explicit step-by-step assembly states (`P01`, `P01 + P02`, `P01 + P02 + P03`).
13. **`constraints`**: Declarative hard and soft physical constraints.
14. **`validation_results`**: 5-domain validation summary (Structural, Geometric, Connection, Manufacturing, Assembly).
15. **`valid_status`**: Boolean flag (`true` if valid, `false` if defective).
16. **`failure_reasons`**: Structured failure messages if invalid.
17. **`repaired_design`**: AI repair directives & parameter adjustments if available.

---

## 4. Fundamental Boundary: Design Parameters vs. Assembly Parameters

The dataset enforces a strict boundary between native piece geometry and 3D assembly orientation:

- **DESIGN PARAMETERS**:
  - Native 2D piece dimensions (`widthMm`, `heightMm`, `thicknessMm`).
  - Edge feature profiles (`tabWidthMm`, `tabDepthMm`, edge positions).
  - Anchored strictly in local piece coordinate space (\(x, y\)).
  - **Unchanged regardless of assembly configuration**.

- **ASSEMBLY PARAMETERS**:
  - 3D spatial position (\(x, y, z\)) and 3D orientation quaternion (\(q_x, q_y, q_z, q_w\)).
  - 3D joining angles at connection joints (`joiningAngleDeg`: 0°, 30°, 45°, 60°, 90°).
  - **Assembly angle is NOT fixed by original 2D design**. The same 2D piece can be assembled at different 3D angles in different configurations.

---

## 5. Standard Conventions

- **Units**: Dimensions in millimeters (`mm`), Angles in degrees (`°`), Mass in grams (`g`).
- **Coordinate Conventions**: Right-handed 3D Cartesian system (\(+X\) right, \(+Y\) forward, \(+Z\) up).
- **File Format**: Standard JSON format for individual items; JSON Lines (JSONL) for bulk split exports.
- **Train / Validation / Test Splits**: 80% Train / 10% Validation / 10% Test.
- **Privacy & IP**: All natural-language prompts and 2D drawings must be stripped of PII (personally identifiable information) and proprietary customer CAD geometry prior to inclusion.
