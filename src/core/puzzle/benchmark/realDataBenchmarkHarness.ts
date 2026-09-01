/**
 * End-to-End Real-Data Benchmark Harness (Step 40).
 * Orchestrates the full ingestion-to-reconstruction benchmark evaluation over the pilot dataset.
 */
import type { BenchmarkItemResult, RealDataBenchmarkResult } from "./types";
import { PilotDataset } from "./pilotDataset";
import { RealFileLoader } from "../ingestion/realFileLoader";
import { DrawingNormalizer } from "../ingestion/drawingNormalizer";
import { GeometryExtractor2D } from "../ingestion/geometryExtractor2D";
import { PieceSegmenter } from "../ingestion/pieceSegmenter";
import { InterfaceDetector } from "../reconstruction/interfaceDetector";
import { ConnectionInferencer } from "../reconstruction/connectionInferencer";
import { ParametricExtractor } from "../reconstruction/parametricExtractor";
import { CanonicalConverter2D } from "../reconstruction/canonicalConverter2D";
import { Reconstructor3D } from "../reconstruction/reconstructor3D";
import { GroundTruthComparator } from "./groundTruthComparator";
import type { DetectedInterfacePort } from "../reconstruction/types";

export class RealDataBenchmarkHarness {
  /**
   * Executes end-to-end benchmark evaluation over the pilot dataset.
   */
  static runBenchmark(): RealDataBenchmarkResult {
    const pilotItems = PilotDataset.getPilotDataset();
    const itemResults: BenchmarkItemResult[] = [];

    for (const item of pilotItems) {
      const ingStart = Date.now();
      
      // Step 26: Ingest
      const ingested = RealFileLoader.loadFile({
        filename: item.rawDrawingFilename,
        format: item.format,
        content: item.rawContent,
      });

      // Step 27: Normalize
      const normalized = DrawingNormalizer.normalize(ingested);

      // Step 28: Extract Geometry
      const contours = GeometryExtractor2D.extractContours(normalized);

      // Step 29: Segment Pieces
      const pieces = PieceSegmenter.segmentPieces(contours);
      const ingTime = Date.now() - ingStart;

      const reconStart = Date.now();
      // Step 30: Detect Interfaces
      const portsByPiece = new Map<string, DetectedInterfacePort[]>();
      for (const p of pieces) {
        portsByPiece.set(p.pieceId, InterfaceDetector.detectInterfaces(p));
      }

      // Step 31: Infer Connections
      const connections = ConnectionInferencer.inferConnections(portsByPiece);

      // Step 32: Extract Parametric Features
      const features = ParametricExtractor.extractFeatures(pieces, portsByPiece, connections);

      // Step 33: Convert to Canonical IR
      const canonicalPuzzle = CanonicalConverter2D.convertToCanonicalIR(
        item.id,
        pieces,
        portsByPiece,
        connections,
        features
      );

      // Step 34: 3D Reconstruction
      const reconstruction = Reconstructor3D.reconstruct3D(canonicalPuzzle);
      const reconTime = Date.now() - reconStart;

      // Step 36: Ground-Truth Comparison
      const metrics = GroundTruthComparator.compare(reconstruction, item.groundTruthManifest);

      itemResults.push({
        itemId: item.id,
        name: item.name,
        category: item.category,
        success: reconstruction.reconstructionSuccess,
        ingestionTimeMs: ingTime,
        reconstructionTimeMs: reconTime,
        metrics,
      });
    }

    // Aggregate statistics
    const totalCount = itemResults.length;
    const successCount = itemResults.filter((r) => r.success).length;
    const avgHausdorff = itemResults.reduce((acc, r) => acc + r.metrics.hausdorffDistanceMm, 0) / totalCount;
    const avgChamfer = itemResults.reduce((acc, r) => acc + r.metrics.chamferDistanceMm, 0) / totalCount;
    const avgIoU = itemResults.reduce((acc, r) => acc + r.metrics.boundingVolumeIoU, 0) / totalCount;
    const avgF1 = itemResults.reduce((acc, r) => acc + r.metrics.overallF1Score, 0) / totalCount;

    return {
      timestamp: new Date().toISOString(),
      totalItemsEvaluated: totalCount,
      successfulReconstructions: successCount,
      averageHausdorffDistanceMm: Math.round(avgHausdorff * 100) / 100,
      averageChamferDistanceMm: Math.round(avgChamfer * 100) / 100,
      averageIoU: Math.round(avgIoU * 100) / 100,
      averageF1Score: Math.round(avgF1 * 100) / 100,
      itemResults,
    };
  }
}
