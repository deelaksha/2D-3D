# Automatic Design Repair Subsystem Specification (Phase 20)

This document specifies the **Automatic Design Repair Subsystem** for the Parametric 2D-to-3D Cardboard Puzzle System.

---

## 1. Architectural Principles & Mandates

> [!IMPORTANT]
> **NO DIRECT ARBITRARY MESH EDITING**:
> The repair subsystem is **strictly forbidden** from directly manipulating 3D vertex points or raw CAD meshes.
> All repair proposals target **explicit parametric variables** (e.g. `slot_width = 10.35`, `stock_width = 800`, `joining_angle = 90.0`).

> [!IMPORTANT]
> **MANDATORY RE-VALIDATION FEEDBACK LOOP**:
> After parameter adjustments are applied to the parametric puzzle model, the piece geometry is regenerated deterministically (`regenerateParametricPieceGeometry`) and re-validated by `PuzzleValidationEngine.validatePuzzle`. A repair is accepted as successful **only if the re-validated report returns `isValid: true`**.

---

## 2. Parameter Adjustment Structure

A repair proposal consists of explicit `ParameterAdjustment` records detailing affected parameter, old value, proposed value, reason, and expected effect:

```json
{
  "proposalId": "prop_101",
  "strategyName": "Mock_AI_Parametric_Repair_Strategy",
  "confidenceScore": 0.95,
  "adjustments": [
    {
      "parameterId": "p_adj_01",
      "targetEntityId": "if_slot_1",
      "parameterName": "slot_width",
      "oldValue": 9.8,
      "proposedValue": 10.35,
      "reason": "Slot width 9.8mm causes interference fit with 10.2mm mating tab width.",
      "expectedEffect": "Adjusts slot width to 10.35mm, restoring positive 0.15mm mechanical clearance."
    }
  ]
}
```

---

## 3. Repair Execution Pipeline

```
                       ┌─────────────────────────┐
                       │   Invalid Puzzle Model  │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │ UnifiedValidationReport │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │     RepairStrategy      │
                       │ (Proposes Adjustments)  │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │  DesignRepairEngine     │
                       │  (Applies Parameters &  │
                       │    Regenerates 2D/3D)   │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │ Deterministic Validation│
                       │ (Re-evaluates Report)   │
                       └─────────────────────────┘
```
