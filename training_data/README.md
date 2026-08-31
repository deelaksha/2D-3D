# Parametric 2D-to-3D Puzzle Training Dataset Specification

This directory defines the **Training Data Architecture** for the Parametric 2D-to-3D Cardboard Puzzle System.

> [!IMPORTANT]
> **No AI Model Training & No Data Collection Yet**:
> This directory contains schemas, documentation, folder layout, and a minimal synthetic test example. No ML models are trained, and no real user datasets are collected or converted in this phase.

---

## 1. Directory Structure

```
training_data/
├── README.md                           # Dataset specification & guidelines
├── schema/
│   └── dataset_schema.json             # JSON Schema for dataset items
├── examples/
│   └── minimal_synthetic_example.json  # Schema-compliant synthetic test example
├── raw/                                # Raw 2D drawings & unstructured input
├── processed/                          # Vectorized & canonicalized puzzle models
├── validation/                         # Validation reports & failure logs
└── splits/
    ├── train/                          # 80% Training split
    ├── validation/                     # 10% Validation split
    └── test/                           # 10% Evaluation split
```

---

## 2. The 17-Step Complete Parametric Puzzle Lifecycle

Every dataset item explicitly records all 17 stages of the parametric lifecycle:

1. **`user_requirement`**: Natural language requirement string.
2. **`source_2d_drawing`**: Relative path to 2D image or vector drawing file.
3. **`piece_segmentation`**: Array of 2D polygon piece boundaries.
4. **`piece_geometry`**: Exact 2D parametric geometry definition.
5. **`interface_definitions`**: Connection ports, local frames, profile dimensions, gender roles.
6. **`connection_graph`**: Graph \(G = (V, E)\) nodes and connection edges.
7. **`parametric_dimensions`**: Width, height, thickness, tab/slot width & depth.
8. **`material_specification`**: Cardboard stock sheet parameters (thickness, tolerance, density).
9. **`piece_3d_representation`**: Extruded 3D solid mesh strictly in piece-local space (\(z \in [-T/2, +T/2]\)).
10. **`assembly_transforms`**: 3D spatial placement transforms (\(T(x,y,z,q_x,q_y,q_z,q_w)\)).
11. **`joining_angles`**: Explicit 3D joining angles (0°, 30°, 45°, 60°, 90°).
12. **`assembly_sequence`**: Explicit step-by-step assembly states (`P01`, `P01 + P02`, `P01 + P02 + P03`).
13. **`constraints`**: Declarative hard and soft physical constraints.
14. **`validation_results`**: 5-domain validation summary (Structural, Geometric, Connection, Manufacturing, Assembly).
15. **`valid_status`**: Boolean flag (`true` if valid, `false` if defective).
16. **`failure_reasons`**: Structured failure messages if invalid.
17. **`repaired_design`**: AI repair directives & parameter adjustments if available.

---

## 3. Critical Distinction: Design Parameters vs. Assembly Parameters

The dataset preserves a strict boundary between native piece geometry and 3D assembly orientation:

- **DESIGN PARAMETERS**:
  - Native 2D piece dimensions (width, height, thickness).
  - Edge feature profiles (tab width, slot depth, edge positions).
  - Anchored strictly in local piece coordinate space (\(x, y\)).
  - **Unchanged regardless of assembly configuration**.

- **ASSEMBLY PARAMETERS**:
  - 3D spatial position (\(x, y, z\)) and 3D orientation quaternion (\(q_x, q_y, q_z, q_w\)).
  - 3D joining angles at connection joints (e.g. 0°, 30°, 45°, 60°, 90°).
  - **Assembly angle is NOT fixed by original 2D design**. The same 2D piece can be assembled at different 3D angles in different configurations.
