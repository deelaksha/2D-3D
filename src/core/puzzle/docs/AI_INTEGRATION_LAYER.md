# AI Integration Layer Specification (Phase 16)

This document specifies the **AI Integration Layer** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Core Architectural Principles

1. **NO MODEL TRAINING & NO LIVE CONNECTIONS**: No ML models are trained or executed.
2. **NO DIRECT CAD GEOMETRY GENERATION**: The AI is strictly forbidden from directly outputting raw 3D vertices, meshes, or CAD curves.
3. **DETERMINISTIC ENGINE REMAINS AUTHORITATIVE**: AI output MUST pass schema validation before being processed by the deterministic geometry generator and constraint validation engine.

---

## 2. Input & Output Specification

### Input Request (`AIDesignRequest`)
- `prompt`: Natural language requirement string (e.g. `"Create a 3D cardboard castle puzzle with 20 pieces and 3 layers"`).
- `drawingImageBase64`?: Optional 2D drawing or image input.
- `referenceDesignId`?: Optional reference design ID.
- `userPreferences`?: Optional user preferences (e.g. `defaultJoiningAngleDeg`, `preferredMaterialId`).

### Output Specification (`ParametricDesignSpecification`)
```json
{
  "specificationId": "spec_mock_101",
  "overall_size": {
    "widthMm": 300,
    "heightMm": 200,
    "depthMm": 150
  },
  "piece_count": 20,
  "layers": 3,
  "material": {
    "stockThicknessMm": 2.0,
    "stockWidthMm": 600,
    "stockHeightMm": 400,
    "materialId": "cardboard-2mm"
  },
  "connection_preferences": {
    "defaultType": "tab_slot",
    "preferredJoiningAngleDeg": 90.0,
    "genderStyle": "complementary"
  },
  "difficulty": {
    "level": "medium",
    "maxUniquePieces": 8
  },
  "symmetry": {
    "isSymmetrical": true,
    "symmetryAxis": "y"
  },
  "constraints": []
}
```

---

## 3. Schema Validation & Error Handling

- **`validateParametricDesignSpecification(spec)`**: Verifies positive dimensions, valid piece counts (\(\ge 1\)), valid layer counts (\(\ge 1\)), non-empty material IDs, and valid difficulty levels.
- **`parseAISpecificationJSON(rawInput)`**: Strips markdown code blocks (` ```json ... ``` `) and safely parses raw text into validated `ParametricDesignSpecification` JSON.
- **`MockAIProvider`**: Simulates deterministic AI specification generation for testing without live LLM calls.
