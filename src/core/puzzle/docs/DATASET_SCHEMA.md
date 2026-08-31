# 2D-to-3D Puzzle Assembly Dataset Schema & Architecture

This document defines the schema and feature representations for ground-truth training datasets used to train machine learning models for 2D-to-3D puzzle assembly prediction.

---

## 1. Overview

The pipeline target for 2D-to-3D puzzle assembly is:
```
2D Piece Geometries + Connection Interfaces
    └─> Edge Tokenization & Feature Extraction
          └─> 3D Pose Prediction & Joining Angle Classification (θ ∈ [0°, 360°])
                └─> Deterministic Assembly Kinematic Solving & Mesh Rendering
```

---

## 2. Training Sample Format (`TrainingSample`)

Each dataset sample is saved as a JSON object in `.json` / `.jsonl` files:

```json
{
  "sampleId": "sample_00001",
  "category": "architectural_box",
  "pieces": [
    {
      "id": "piece_01",
      "name": "Base Board",
      "width": 100.0,
      "height": 100.0,
      "thickness": 2.0,
      "materialId": "cardboard-2mm",
      "interfaces": [
        {
          "id": "iface_01",
          "edgeIndex": 0,
          "position": { "x": 50.0, "y": 0.0 },
          "normal": { "x": 0.0, "y": -1.0 },
          "tangent": { "x": 1.0, "y": 0.0 },
          "role": "receiver",
          "pattern": "tab_slot"
        }
      ]
    }
  ],
  "groundTruthAssembly": {
    "placements": [
      {
        "pieceId": "piece_01",
        "position": { "x": 0.0, "y": 0.0, "z": 0.0 },
        "rotation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 }
      }
    ],
    "connections": [
      {
        "id": "conn_01",
        "sourcePieceId": "piece_01",
        "sourceInterfaceId": "iface_01",
        "targetPieceId": "piece_02",
        "targetInterfaceId": "iface_02",
        "joiningAngleDeg": 90.0
      }
    ]
  }
}
```

---

## 3. Key ML Features & Representations

1. **2D Contours**: Closed 2D polygon vertex coordinates normalized in piece-local space \((x, y) \in [-1, 1]\).
2. **Edge Interfaces**: Local origin point, unit normal \(\vec{n}\), unit tangent \(\vec{t}\), slot width \(w\), and pattern type encoding.
3. **Target 3D Joining Angle \(\theta\)**: Continuous value in degrees \([0^\circ, 360^\circ]\) or classification logits for common angles (45°, 90°, 135°, 180°).

---

## 4. Separation of ML Logic & Deterministic Geometry

- **AI Model Role**: Predict edge pairings, candidate connection graphs, and target joining angles \(\theta\).
- **Deterministic Solver Role**: Compute rigid 3D transformation matrices, perform collision checks, evaluate cardboard tolerances, and generate 3D solid meshes.
