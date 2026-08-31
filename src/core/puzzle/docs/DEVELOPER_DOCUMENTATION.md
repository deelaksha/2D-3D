# Parametric 2D-to-3D Cardboard Puzzle System — Developer Manual

> **System Version**: `1.0.0`  
> **Status**: Production Architecture  
> **Authoritative Engine**: Deterministic Geometric & Validation Pipeline  

---

## Executive Summary & Core Architectural Mandates

The **Parametric 2D-to-3D Cardboard Puzzle System** is a deterministic, CAD-grade geometry generation, 3D assembly transformation, constraint evaluation, and validation platform for physical interlocking cardboard puzzles.

### Critical Architectural Mandates (Must Never Be Violated)

1. **Piece Geometry is Independent from Assembly Orientation**:
   A piece's 2D boundary contour and extruded 3D solid model are defined strictly in its **local coordinate system** ($z \in [-T/2, +T/2]$). Customer assembly placement angles (e.g. 0°, 45°, 90°) are applied later by `AssemblyConfiguration`. The 2D piece geometry is NEVER altered by assembly placement transforms.
2. **Connections are Between Interfaces, Not Merely Horizontal/Vertical Sides**:
   Connections join discrete `CanonicalInterface` ports (anchored by local 3D coordinate frames $\mathbf{F} = (\mathbf{O}, \mathbf{t}, \mathbf{n}, \mathbf{b})$), not merely arbitrary horizontal or vertical side directions.
3. **Assembly Angle Belongs to Assembly Configuration**:
   The joining angle (e.g. 45.0°, 90.0°) is a parameter of an assembly placement/configuration transform between mated interfaces, NOT fixed into the 2D piece geometry.
4. **Fixed Cardboard Dimensions are Manufacturing Constraints**:
   Sheet stock dimensions (e.g. 600mm × 400mm), laser kerf (0.1mm), grain direction (0°), and minimum bend radius are manufacturing constraints evaluated during manufacturing validation.
5. **AI Must NOT Be Treated as the Authority for Geometric Correctness**:
   AI interpreters (`MockAIProvider`) generate structured `ParametricDesignSpecification` JSON payloads. The deterministic geometry and validation engines remain the sole authority for physical correctness.
6. **No Real Training at This Stage**:
   Schemas, dataset exporters, and multi-format adapters (PNG, SVG, DXF, STEP, STL, JSON) are established for future ML training, but zero model training has occurred.

---

## 1. System Architecture

```
                                  SYSTEM ARCHITECTURE OVERVIEW

┌─────────────────────────┐
│ User Requirement Prompt │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   AI Integration Layer  │  ◄── Generates Structured Parametric Specification JSON
│    (MockAIProvider)     │      (Not Authoritative)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Canonical Data Representation  (CanonicalPuzzle Schema)
└────────────┬────────────┘
             │
             ├─────────────────────────┬─────────────────────────┐
             ▼                         ▼                         ▼
┌─────────────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
│ 2D Geometry Pipeline    │ │ 3D Solid Extrusion │ │  Assembly Graph      │
│ (Boundary & Contours)   │ │ (Local Space -T/2) │ │  G = (V, E)          │
└────────────┬────────────┘ └─────────┬──────────┘ └──────────┬───────────┘
             │                         │                      │
             └─────────────────────────┼──────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ 3D Assembly Transform    │  ◄── Mates Interfaces at
                         │        System            │      Angles (0°, 45°, 90°)
                         └─────────────┬────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ Connection Compatibility │  ◄── 7-Check Criterion
                         │         Engine           │      Evaluation
                         └─────────────┬────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ 3D Spatial Collision &   │  ◄── Distinguishes Expected
                         │ Clearance Validator      │      Contact vs Collision
                         └─────────────┬────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ Assembly Sequence Solver │  ◄── Step-by-Step Trajectory
                         └─────────────┬────────────┘      Verification
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ Unified Validation Engine│  ◄── 5-Domain Multi-Level
                         └─────────────┬────────────┘      ValidationReport
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ Dataset Generation Exporter  ──► CompleteDatasetItem (v1.0.0)
                         └──────────────────────────┘
```

---

## 2. Domain Model

The canonical model (`CanonicalPuzzle`) isolates **Design Parameters** (intrinsic 2D shape, thickness, interface profiles) from **Assembly Parameters** (3D placement rigid transforms, joining angles).

```
                      CANONICAL PUZZLE DOMAIN MODEL

                      ┌────────────────────────┐
                      │    CanonicalPuzzle     │
                      └───────────┬────────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      │ 1..*                      │ 0..*                      │ 0..*
      ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌────────────────────┐
│  Canonical   │          │  Canonical   │          │     Canonical      │
│    Piece     │          │  Interface   │          │     Connection     │
└──────────────┘          └──────────────┘          └────────────────────┘
```

---

## 3. Piece Representation

A piece is represented intrinsically in 2D parametric space (`ParametricPiece2D`) with thickness $T$:

- **Dimensions**: $\{ \text{width}, \text{height}, \text{depth} \}$ (mm)
- **Thickness**: $T$ (mm)
- **Local Coordinate Frame**: Origin $\mathbf{O} = (0,0,0)$, Tangent $\mathbf{t} = (1,0,0)$, Normal $\mathbf{n} = (0,-1,0)$, Binormal $\mathbf{b} = (0,0,-1)$
- **Extruded Z-Envelope**: $z \in [-T/2, +T/2]$ in piece-local space

---

## 4. Edge & Interface Representation

Interfaces (`CanonicalInterface`) define physical connection ports along 2D piece edges:

```
                   INTERFACE PORT ALONGSIDE 2D PIECE EDGE

        Edge 0 (Bottom)             Edge 1 (Right)            Edge 2 (Top)
 ┌──────────────────────────┬───────────────────────────┬──────────────────────┐
 │                          │     Interface Port        │                      │
 │                          │   Width: 20mm, Depth: 5mm │                      │
 └──────────────────────────┴─────────────┬─────────────┴──────────────────────┘
                                          │
                                          ▼
                               Local 3D Coordinate Frame
                              Origin: O = (50, 0, 0)
                              Tangent: t = (1, 0, 0)
                              Normal: n = (0, -1, 0)
                              Binormal: b = (0, 0, -1)
```

Supported profiles: **`tab`**, **`slot`**, **`finger`**, **`dovetail`**, **`notch`**, **`curve`**, **`custom`**.

---

## 5. Connection Model

Connections join two specific interfaces across an assembly graph $G = (V, E)$:

- **Source**: $\text{Piece}_A, \text{Interface}_A$
- **Target**: $\text{Piece}_B, \text{Interface}_B$
- **Joining Angle**: $\theta \in [0^\circ, 180^\circ]$ (e.g. 0°, 30°, 45°, 60°, 90°, 135°)
- **Relative Transform**: $\mathbf{T}_{A \to B} \in SE(3)$

---

## 6. Coordinate Systems

```
                       COORDINATE FRAME HIERARCHY

     ┌────────────────────────────────────────────────────────┐
     │                World Coordinate Frame                  │
     │                   (0, 0, 0)_world                      │
     └───────────────────────────┬────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ Rigid Placement Transform T   │
                 ▼                               ▼
     ┌───────────────────────┐       ┌───────────────────────┐
     │ Piece-Local Frame P1  │       │ Piece-Local Frame P2  │
     │   z in [-T/2, +T/2]   │       │   z in [-T/2, +T/2]   │
     └───────────┬───────────┘       └───────────┬───────────┘
                 │                               │
                 ▼                               ▼
     ┌───────────────────────┐       ┌───────────────────────┐
     │  Interface Frame A    │       │  Interface Frame B    │
     │ (O_A, t_A, n_A, b_A)  │       │ (O_B, t_B, n_B, b_B)  │
     └───────────────────────┘       └───────────────────────┘
```

---

## 7. Assembly Transforms

Given Interface $A$, Interface $B$, and desired joining angle $\theta$, `AssemblyTransformationSystem.calculateInterfaceMatingTransform` calculates the exact rigid transformation $\mathbf{T}_B \in SE(3)$ mating Interface $B$ to Interface $A$:

$$\mathbf{T}_B = \mathbf{T}_A \cdot \mathbf{T}_{\text{frame}_A} \cdot \mathbf{R}_x(\theta) \cdot \mathbf{R}_z(180^\circ) \cdot \mathbf{T}_{\text{frame}_B}^{-1}$$

Supports **non-90-degree compound angles** (30°, 45°, 60°, 135°) without altering 2D piece geometry.

---

## 8. Constraint System

Generic declarative constraints (`DeclarativeConstraint`):

- **Angle Constraint**: Enforces $\theta_{\text{min}} \le \theta \le \theta_{\text{max}}$.
- **Clearance Constraint**: Enforces $c_{\text{min}} \le c \le c_{\text{max}}$.
- **Material Constraint**: Enforces sheet bounds $W_{\text{piece}} \le W_{\text{stock}} - 2 \cdot m$.

---

## 9. Geometry Pipeline

`runParametricGeometryPipeline` evaluates 2D boundary polygons deterministically:

1. Evaluates 4 outer edge segments (straight, tab, slot, arc, custom profile).
2. Generates closed vertex loops `BoundaryLoop`.
3. Validates topology (`validateGeneratedGeometry` checks closed loops, zero self-intersections, min feature size $\ge 1.5\text{mm}$).

---

## 10. 2D → 3D Pipeline

`convert2DTo3DSolid` extrudes 2D profiles into 3D solid representations:

- Extrudes vertices along $z$ axis from $-T/2$ to $+T/2$.
- Generates 3D boundary meshes (`SolidRepresentation3D`).
- Computes volume $V$ ($\text{mm}^3$), surface area $A$ ($\text{mm}^2$), and mass $m = V \cdot \rho$ ($\text{g}$).

---

## 11. Collision & Clearance Validation

`validate3DAssemblyGeometry` evaluates spatial relationships in 3D:

- **EXPECTED CONTACT**: Intended mating overlap at registered interface ports (allowed, severity `info`).
- **UNEXPECTED COLLISION**: Unintended solid interpenetration between non-connected pieces (rejected, severity `error`).

---

## 12. Assembly Solver

`AssemblySequenceSolver` plans step-by-step physical assembly sequences:

$$\text{Step 1: } P_{01} \longrightarrow \text{Step 2: } P_{01} + P_{02} \longrightarrow \text{Step 3: } P_{01} + P_{02} + P_{03}$$

Verifies linear translation insertion trajectories to prove physical assemblability (proving graph connectivity $\ne$ physical assemblability).

---

## 13. Material & Cardboard Constraints

`CardboardSpecification` enforces physical manufacturing limits:

- Stock dimensions: $600\text{mm} \times 400\text{mm}$
- Laser kerf offset: $0.1\text{mm}$
- Flute / grain direction angle: $0^\circ$
- Minimum bend radius: $4.0\text{mm}$

---

## 14. AI Interface

`MockAIProvider` implements `AIProviderInterface`:

- Input: `AIDesignRequest` (natural language prompt, preferences)
- Output: `ParametricDesignSpecification` JSON structure
- Validation: `validateParametricDesignSpecification` schema validator

---

## 15. Training-Data Specification

`CompleteDatasetItem` schema represents the complete 17-step lifecycle:

1. User Requirement
2. Source Drawing
3. Piece Segmentation
4. Piece Geometry
5. Interface Definitions
6. Connection Graph
7. Parametric Dimensions
8. Material Specification
9. 3D Piece Representation
10. Assembly Transforms
11. Joining Angles
12. Assembly Sequence
13. Constraints
14. Validation Results
15. Valid/Invalid Status
16. Failure Reasons
17. Repaired Design

---

## 16. Dataset Directory Structure

```
training_data/
├── README.md
├── schema/
│   └── dataset_schema.json
├── examples/
│   └── minimal_synthetic_example.json
├── raw/
├── processed/
├── validation/
└── splits/
    ├── train/
    ├── validation/
    └── test/
```

---

## 17. Future ML Training Architecture

Pluggable multi-format adapters (`FormatAdapterRegistry`) convert external CAD/graphics formats without altering the canonical model:

- **PNG**: 2D sketch raster image adapter
- **SVG**: 2D vector path adapter
- **DXF**: 2D CAD polyline adapter
- **STEP**: 3D solid STEP B-Rep adapter
- **STL**: 3D triangulated mesh export adapter
- **JSON**: Canonical JSON adapter

---

## 18. RAG / Design Knowledge Retrieval

`MockDesignRetrievalSystem` implements `RetrievalInterface`:

- Multi-attribute query matching (piece count, connection type, difficulty, geometry style, material, dimensions, topology).
- **NON-BLIND-COPY MANDATE**: All search results include `referenceAdaptationGuidelines` warning that retrieved designs must serve strictly as structural inspiration and never be blindly copied.

---

## 19. AI Repair Loop

`DesignRepairEngine` consumes diagnostic `UnifiedValidationReport` objects:

- Proposes changes **STRICTLY TO PARAMETRIC VARIABLES** (`slot_width = 10.35`, `stock_width = 800`).
- **NO ARBITRARY MESH EDITING**.
- Applies parameters, regenerates geometry deterministically, and re-validates (`isValid === true`).

---

## 20. Optimization

`DeterministicGridOptimizer` separates **HARD CONSTRAINTS** from **OPTIMIZATION OBJECTIVES**:

- **HARD CONSTRAINTS**: Violation immediately marks candidate infeasible (`isFeasible: false`, totalScore = 0.0).
- **OPTIMIZATION OBJECTIVES**: Scores feasible designs across 9 metrics (material utilization, piece count, assembly difficulty, connection quality, manufacturing complexity, clearance, symmetry, aesthetics, assembly time).

---

## 21. Testing

- **Master System Test Pass**: `src/__smoke__/comprehensiveSystemPass.test.ts`
- **Total Test Suites**: **33 passed**
- **Total Unit Tests**: **161 passed**
- **Pass Rate**: **100.0%**
- **TypeScript Errors**: **0 errors**

---

## 22. Extension Points

- **Custom Connection Types**: Register new joint profile handlers in `ConnectionCompatibilityEngine`.
- **Custom Format Adapters**: Implement `FormatAdapter` and register in `FormatAdapterRegistry`.
- **Custom Optimizers**: Implement `Optimizer` interface for ML/RL algorithms.
