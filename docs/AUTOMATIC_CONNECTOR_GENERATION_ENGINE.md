# Automatic Connector Generation Engine (Phase 83)

## 1. Architectural Overview & Context

The **Automatic Connector Generation Engine** automatically synthesizes geometrically complementary, physical 2D connector interfaces between adjacent puzzle pieces while embedding 3D assembly kinematics, joining angles, and manufacturing clearances.

### 1.1 Non-Coplanar 3D Assembly Principle
> [!IMPORTANT]
> The pieces must **NOT** be assumed to remain coplanar in final assembly.
> While the 2D geometry defines the physical cutouts and protrusions in sheet stock, the connector definition embeds spatial frames, allowed 3D angle limits, and insertion vectors to support orthogonal ($90^\circ$), angled ($45^\circ$, $120^\circ$), or dynamic hinge ($[0^\circ, 180^\circ]$) joining.

---

## 2. Supported Connector Types

```
                        ┌────────────────────────────────────────────────────────┐
                        │              AutomaticConnectorEngine                  │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
     ┌──────────────┬──────────────┬────────────────┼──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼                ▼              ▼              ▼              ▼
 [Tab-Slot]      [Notch]      [Interlock]        [Keyed]        [Hinge]     [Rotational]      [Custom]
(Planar/90°)  (Half-Lap 90°)  (Dovetail)     (Anti-Invert)   (1-DOF Pivot)  (360° Boss)   (Parametric)
```

| Type | Kinematic Behavior | Typical Angle | Key Characteristic |
|---|---|---|---|
| **`tab_slot`** | `FIXED` | $180^\circ$ or $90^\circ$ | Male tab plugs into female slot cutout with lateral clearance |
| **`notch`** | `FIXED` (crossing) | $90^\circ$ | Half-lap slots crossing perpendicularly; insertion along Z |
| **`interlock`** | `INTERLOCK` | $180^\circ$ | Dovetail / puzzle bulb; resists in-plane tension / pull-out |
| **`keyed`** | `FIXED` (asymmetric) | $180^\circ$ or $90^\circ$ | Asymmetric key bump and keyway enforcing 1-way insertion |
| **`hinge`** | `HINGE` | $[0^\circ, 180^\circ]$ | 1 rotational degree of freedom along the edge tangent axis |
| **`rotational`** | `ROTATIONAL` | $[0^\circ, 360^\circ]$ | Cylindrical pivot boss & socket allowing continuous 360° spin |
| **`custom`** | `CUSTOM` | User-defined | Configurable dimensions, profile outline, and allowed DOFs |

---

## 3. Parametric Calculations & Clearances

### 3.1 Material-Based Manufacturing Clearance
Manufacturing clearance ($c$) is computed deterministically from stock thickness ($T$):
$$c = \begin{cases} 0.15 \text{ mm}, & T \le 3.0 \text{ mm} \\ 0.20 \text{ mm}, & 3.0 < T \le 6.0 \text{ mm} \\ 0.25 \text{ mm}, & T > 6.0 \text{ mm} \end{cases}$$

### 3.2 Complementary Sizing Formulas
For male plug (Tab) and female socket (Slot):
$$\text{slotWidth} = \text{tabWidth} + 2c$$
$$\text{slotDepth} = \text{tabDepth} + c$$

When joining orthogonally at $90^\circ$:
$$\text{tabDepth} = T_B \quad (\text{thickness of mating piece})$$

When crossing via half-lap notches:
$$\text{notchDepth}_A = \frac{T_A}{2}, \quad \text{notchDepth}_B = \frac{T_B}{2}$$
$$\text{notchWidth}_A = T_B + 2c, \quad \text{notchWidth}_B = T_A + 2c$$

---

## 4. Generated Connection Structure

For every connection, the engine produces:
1. **Interface A**: Canonical interface with local 3D coordinate frame ($\text{origin}, \vec{t}, \vec{n}, \vec{b}$), male/insert role, profile kind, and tolerances.
2. **Interface B**: Complementary canonical interface with opposing normal ($\vec{n}_B = -\vec{n}_A$), receiver role, and profile dimensions.
3. **Connector Geometry**: 2D `Shape` definitions (`plugShape`, `socketShape`) and explicit contour node loops for CAD cutouts.
4. **Connector Parameters**: Exact numerical values for `tabWidth`, `tabDepth`, `slotWidth`, `slotDepth`, `position`, `clearance`, and `joiningAngleDeg`.
5. **Compatibility Rules**: Matching interface patterns, gender roles, and material suitability.
6. **Allowed Angle Range**: 3D rotation limits ($\text{nominalAngleDeg}, \text{minAngleDeg}, \text{maxAngleDeg}$, and $\text{rotationAxis}$).
7. **Assembly Constraints**: Insertion vector, translation/rotation DOFs, and locking mechanism (`friction`, `detent`, `keyed`, `gravity`).
8. **Advanced3DConnection**: Fully integrated Phase 65 connection instance ready for 3D kinematic solvers.

---

## 5. Deterministic Validation Engine (No AI)

Every connector is validated against 5 deterministic rules:
- **Complementarity**: $\text{slotWidth} \ge \text{tabWidth}$ and $\text{slotDepth} \ge \text{tabDepth}$.
- **Clearance Integrity**: $0.01 \le c \le 1.5$ mm.
- **Physical Proportions**: $\text{tabWidth} \le \text{edgeLength} \times 0.95$.
- **Angle Range**: $\text{minAngleDeg} \le \text{nominalAngleDeg} \le \text{maxAngleDeg}$.
- **DOF Consistency**: Hinge connectors must have $\ge 1$ rotational DOF; fixed joints must have $0$ rotational DOFs.

---

## 6. Programmatic Usage

```typescript
import { AutomaticConnectorEngine } from "@/core/puzzle/connectorgeneration";

const { connectorPair, validation } = AutomaticConnectorEngine.createConnector({
  pieceA: {
    id: "wall_left",
    thicknessMm: 3.0,
    materialId: "cardboard_heavy",
    edgeLengthMm: 60.0,
  },
  pieceB: {
    id: "base_plate",
    thicknessMm: 3.0,
    materialId: "cardboard_heavy",
    edgeLengthMm: 60.0,
  },
  interface: {
    contactCenter: { x: 30.0, y: 0.0 },
    contactNormal: { x: 0.0, y: 1.0 },
    edgeLengthMm: 60.0,
    preferredType: "tab_slot",
    targetJoiningAngleDeg: 90.0, // 3D perpendicular joint
  },
});

if (validation.isValid) {
  console.log("Tab Width:", connectorPair.parameters.tabWidth);
  console.log("Slot Width (with clearance):", connectorPair.parameters.slotWidth);
  console.log("Joining Angle:", connectorPair.allowedAngleRange.nominalAngleDeg);
}
```
