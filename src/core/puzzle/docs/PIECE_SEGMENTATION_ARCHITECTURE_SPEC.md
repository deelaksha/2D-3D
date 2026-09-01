# Piece-Segmentation Inference Architecture & Evaluation Specification (Phase 44)

This document specifies the **Piece-Segmentation Inference Architecture & Ground-Truth Evaluation Subsystem** for segmenting 2D CAD drawings or raster image blueprints into discrete piece detections mapped to canonical `CanonicalPiece` objects.

---

## 1. Architectural Mandate & Replaceable Model Interface

> [!IMPORTANT]
> **MODEL PLUGGABILITY & MANUAL OVERRIDE PROTOCOL**:
> - **Replaceable Model Interface**: Defines `PieceSegmentationModel` interface allowing seamless swapping between deterministic vector graph segmentation (`DeterministicVectorSegmentationModel`), vision ML models (`MockVisionMLSegmentationModel` / SAM 2 / YOLOv8-Seg), and human review overrides.
> - **Manual Review Overrides**: Human annotations (`VersionedPuzzleAnnotation`) can correct piece IDs, boundaries, or confidence scores without re-running model inference.
> - **Zero Model Training**: Implements the inference architecture and evaluation metrics engine; zero model training is performed in this phase.

---

## 2. Subsystem Data Schemas

```typescript
export interface PieceDetection {
  detectionId: string;
  pieceId: string;
  boundaryPolygon: Vec2[];
  boundingBox: { x: number; y: number; width: number; height: number };
  confidenceScore: number; // 0.0 to 1.0
  segmentationSource: "vector_graph" | "image_ml_model" | "manual_review";
  canonicalPiece?: CanonicalPiece;
}

export interface PieceSegmentationResult {
  segmentationId: string;
  sourceDrawing: string;
  detections: PieceDetection[];
  detectedPieceCount: number;
  overallConfidence: number;
  processingDurationMs: number;
}
```

---

## 3. Evaluation Metrics (`PieceSegmentationEvaluator`)

Evaluates model predictions against ground truth using 4 metrics:

$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

$$\text{IoU} = \frac{\text{Area}(\text{Polygon}_{\text{pred}} \cap \text{Polygon}_{\text{gt}})}{\text{Area}(\text{Polygon}_{\text{pred}} \cup \text{Polygon}_{\text{gt}})}$$

$$\text{Piece-Count Accuracy} = \max\left(0, 1.0 - \frac{|N_{\text{gt}} - N_{\text{pred}}|}{\max(1, N_{\text{gt}})}\right)$$

---

## 4. Future ML Training Input / Output Format Specifications

For future vision model fine-tuning (YOLOv8-Seg / SAM 2 / Mask R-CNN):

### Input Format (COCO / Instance Segmentation JSON)
- **Raster Image**: 1024x1024 RGB image (or converted vector rendering).
- **Bounding Boxes**: `[x_min, y_min, width, height]`
- **Polygons**: Normalized 2D contour points `[[x1, y1], [x2, y2], ...]`.

### Output Target Format
- **Segmentation Masks**: Class 0 ("cardboard_piece").
- **Canonical Mapping**: Bounding box $\rightarrow$ `CanonicalPiece` dimension fitting ($W, H, T$).

---

## 5. Programmatic API Usage

```typescript
import { DeterministicVectorSegmentationModel, PieceSegmentationEvaluator } from "@/core/puzzle/segmentation";

// 1. Instantiating vector segmentation model
const model = new DeterministicVectorSegmentationModel();
const result = await model.segmentPieces(geometryResult);

// 2. Evaluating against ground truth pieces
const report = PieceSegmentationEvaluator.evaluate(result, groundTruthPieces);

console.log(`Precision: ${(report.precision * 100).toFixed(1)}%, Recall: ${(report.recall * 100).toFixed(1)}%`);
console.log(`IoU: ${report.iou.toFixed(3)}, Piece-Count Accuracy: ${(report.pieceCountAccuracy * 100).toFixed(1)}%`);
```
