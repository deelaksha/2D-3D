# Canonical Internal Representation Specification (Phase 2)

This document specifies the **Canonical Internal Representation** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Design Philosophy

### Orientation Neutrality
The puzzle model **never** encodes directional assumptions such as:
- `horizontal piece`
- `vertical piece`
- `right piece`
- `left piece`

All spatial orientations, piece placements, and connections are defined strictly through:
1. **Piece Local Coordinate Frames** \(F_{\text{local}} = \{\vec{o}, \vec{t}, \vec{n}, \vec{b}\}\)
2. **Interface Coordinate Frames** \(F_{\text{interface}}\)
3. **Rigid 3D Transformations** (3D Position \(\vec{r}\) & Quaternion \(Q\))
4. **Geometric Constraints & Allowed Degrees of Freedom (DOF)**

---

## 2. Canonical Hierarchy (`CanonicalPuzzle`)

```
CanonicalPuzzle
 ├── metadata: CanonicalPuzzleMetadata (id, name, schemaVersion: 2, displayUnit)
 ├── materialSpecification: CardboardSpecification[] (thickness, density, slotTolerance)
 ├── globalParameters: Record<string, GlobalParameter> (global dimensions, variables)
 ├── pieces: CanonicalPiece[]
 ├── interfaces: CanonicalInterface[]
 ├── connections: CanonicalConnection[]
 ├── constraints: CanonicalConstraint[]
 ├── assemblyConfigurations: CanonicalAssemblyConfiguration[]
 └── validationResults: CanonicalValidationReport
```

---

## 3. Entity Specifications

### 3.1 Piece (`CanonicalPiece`)
Orientation-independent physical component template.
- `id`: Unique string identifier
- `name`: Human-readable label
- `geometryRef`: Reference to 2D local contour shape and optional cutout modifiers
- `dimensions`: Footprint dimensions `{ width, height, depth }` in mm
- `thickness`: Stock material thickness in mm
- `materialId`: Reference ID in `materialSpecification`
- `interfaceIds`: Array of `CanonicalInterface` IDs attached to this piece
- `localFrame`: Piece-local coordinate frame `CanonicalLocalFrame3D`
- `manufacturingParameters`: Fabrication settings (`kerf`, `grainAngleDeg`, `cutterRadius`)

### 3.2 Interface (`CanonicalInterface`)
Physical mating port along a piece edge.
- `id`: Unique interface ID
- `owningPieceId`: Parent piece template ID
- `edgeGeometry`: Edge index, parametric range `[start, end]`, arc length
- `interfaceType`: Feature joint kind (`slot`, `tab`, `finger`, `dovetail`, `miter`, `butt`, `custom`)
- `profile`: Feature cross-section `{ profileKind, width, depth, clearance }`
- `compatibility`: Allowed types, gender role (`insert`, `receiver`, `neutral`), complementary patterns
- `localFrame`: 3D coordinate frame anchored at port center
- `tolerance`: Mechanical fit tolerance in mm
- `allowedDOF`: Permitted translational & rotational freedoms (`translation`, `rotation`)

### 3.3 Connection (`CanonicalConnection`)
Mating relationship between two interfaces.
- `id`: Connection ID
- `interfaceAId`: Interface A (source port ID)
- `interfaceBId`: Interface B (target port ID)
- `connectionType`: Mechanical joint classification (`rigid`, `revolute_hinge`, `prismatic_sliding`, `miter_corner`)
- `compatibilityRules`: Matching rules (`requireMatchingProfileWidth`, `maxToleranceDiff`)
- `allowedRelativeTransform`: Target position offset & rotation quaternion
- `allowedAngleRange`: 3D joining angle limits `{ minAngleDeg, maxAngleDeg, targetAngleDeg }`
- `clearance`: Fit clearance along normal vector (mm)
- `constraintIds`: Target constraint references

### 3.4 Assembly Configuration (`CanonicalAssemblyConfiguration`)
3D spatial realization of a puzzle configuration.
- `id`: Configuration ID
- `pieceTransforms`: Map of `pieceId -> Transform3D` storing 3D translation & rotation quaternion
- `position`: Global assembly root position
- `rotation`: Global assembly root rotation
- `connectionStates`: Map of `connectionId -> CanonicalConnectionState`
- `assemblySequence`: Step-by-step ordered installation steps `AssemblyStep[]`
- `validationState`: Assembly validation status report

---

## 4. Validation Engine (`validateCanonicalPuzzle`)

The validation engine detects malformed data and structural defects:
1. **Dangling References**: Detects interfaces referencing nonexistent pieces, connections referencing missing interfaces, or assembly transforms targeting unregistered pieces.
2. **Physical Bounds**: Rejects negative physical dimensions (`width <= 0`, `height <= 0`, `thickness <= 0`, `tolerance < 0`).
3. **Angle Range Validation**: Enforces `minAngleDeg <= maxAngleDeg` and bounds checking.
4. **Duplicate IDs**: Guarantees unique entity IDs across all domain collections.

---

## 5. Serialization (`serializeCanonicalPuzzle` / `deserializeCanonicalPuzzle`)

Canonical models support lossless JSON serialization with explicit schema versioning (`schemaVersion: 2`). Deserialization automatically invokes strict validation to prevent malformed data from entering runtime state.
