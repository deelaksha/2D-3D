# 3D Geometric Validation Engine Specification (Phase 12)

This document specifies the **3D Geometric Validation Engine** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Mandate

### EXPECTED CONTACT vs. UNEXPECTED COLLISION

In a 3D puzzle assembly, physical tab-and-slot engagement requires material contact and local bounding volume overlap.

- **`expected_contact`**: Overlap or engagement occurring directly at a registered connection interface port between physically connected pieces (e.g. male tab inserted inside female slot). Flagged as `info` or `warning` and **allowed** (`isValid: true`).
- **`unexpected_collision`**: Interpenetration or 3D bounding box overlap occurring between non-connected pieces, or outside the registered connection interface zone. Flagged as `error` and **invalidates assembly** (`isValid: false`).

---

## 2. Structured Diagnostic Output (`Diagnostic3DCollision`)

Every detected spatial interaction returns detailed structured diagnostics:

```json
{
  "pieceIdA": "piece_wall_1",
  "pieceIdB": "piece_wall_2",
  "interfaceIdA": "if_tab_1",
  "interfaceIdB": "if_slot_1",
  "location": { "x": 100.0, "y": 50.0, "z": 1.0 },
  "collisionType": "unexpected_collision",
  "severity": "error",
  "measuredClearance": -4.5,
  "requiredClearance": 0.0,
  "description": "UNEXPECTED 3D COLLISION DETECTED! Non-connected pieces penetrate each other by 4.50mm."
}
```

---

## 3. Detected Defect Types

1. **`expected_contact`**: Allowed engagement at registered connection interfaces.
2. **`unexpected_collision`**: Illegal overlap between non-connected pieces.
3. **`insufficient_clearance`**: Measured gap \(\text{measured} < \text{required}\).
4. **`invalid_penetration`**: Penetration depth exceeding allowable tab/slot depth.
5. **`disconnected_interface`**: Connection edge references interfaces whose 3D world origins are separated (\(\Delta r > 1.5\text{mm}\)).
6. **`invalid_interface_alignment`**: Interface orientation vectors misaligned or corrupt.
