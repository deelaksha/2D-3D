# Connection-Interface System Specification (Phase 4)

This document specifies the **Connection-Interface System** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Principle

A connection is **NEVER** defined as a naive directional assumption (e.g. `piece A right -> piece B left`).

Instead, connections are established between explicit, mathematically rigorous 3D connection interfaces (`ConnectionInterfaceSystem`).

Each interface owns a local 3D coordinate frame:
- **origin** \(\vec{o}\): 3D point location on the piece boundary (mm)
- **tangent** \(\vec{t}\): along-edge unit vector
- **normal** \(\vec{n}\): surface/insertion outward unit vector
- **binormal** \(\vec{b}\): thickness / cross-product unit vector \(\vec{t} \times \vec{n}\)

---

## 2. Core Entities

### 2.1 `ConnectionType`
Extensible enums/types representing physical connection kinds:
- `"tab_slot"`: Male tab plugging into a female slot.
- `"interlock"`: Finger or dovetail interlocking joint.
- `"edge_contact"`: Face-to-face or edge miter contact.
- `"hinge_like"`: Revolute joint allowing angular rotation.
- `"slot"`: Female socket feature.
- `"custom"`: User-defined mechanical joint.

### 2.2 `ConnectionProfile`
Cross-section geometry parameters:
- `width`: Feature width along tangent (mm)
- `depth`: Feature depth along insertion axis (mm)
- `height`: Thickness depth along binormal (mm)
- `chamfer`: Lead-in chamfer or corner radius (mm)

### 2.3 `ConnectionCompatibility`
- `genderRole`: `"insert"` (male) | `"receiver"` (female) | `"neutral"` (flat contact) | `"custom"`
- `allowedTypes`: List of compatible `ConnectionType` kinds
- `compatibleGenderRoles`: Gender pairing rules
- `allowSameGenderOverride`: Optional override allowing male-male or female-female joints

### 2.4 `KinematicConstraints`
- `insertionDirection`: 3D unit vector in interface local space
- `translationConstraints`: Locked translation axes `{ tx, ty, tz }`
- `rotationConstraints`: Locked rotation axes `{ rx, ry, rz }`
- `allowedAngleRange`: Permitted 3D joining angle limits `{ minAngleDeg, maxAngleDeg, targetAngleDeg }`
- `allowedDOF`: Permitted degrees of freedom (`translation`, `rotation`)

---

## 3. Compatibility Engine (`checkInterfaceCompatibility`)

Evaluates compatibility between Interface A and Interface B:
1. **Gender Pairing**: TAB (`insert`) + SLOT (`receiver`) \(\to\) **Compatible**. TAB + TAB \(\to\) **Incompatible** unless `allowSameGenderOverride` is true.
2. **Profile Fit**: Compares `width`, `depth`, and `height` within `tolerance`.
3. **Type Matching**: Ensures interface types belong to allowed types.
4. **Angle Range Overlap**: Verifies overlapping joining angle bounds.

---

## 4. Support for Non-Planar Orientations

Connections support arbitrary 3D orientations (0° flat extensions, 90° box corners, 45° roof miters, compound non-planar joints) using 3D coordinate frames and 3D insertion vectors without planar assumptions.
