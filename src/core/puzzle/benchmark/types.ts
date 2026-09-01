/**
 * Ground-Truth Evaluation and Benchmark Types (Steps 35–40).
 */
import type { Vec3 } from "@/core/model/types";

export interface GroundTruthAssemblyManifest {
  assemblyId: string;
  name: string;
  sourceCadFile?: string;
  piecesCount: number;
  expectedJoiningAnglesDeg: number[];
  groundTruthPlacements: Map<string, { position: Vec3; rotationQuaternion: [number, number, number, number] }>;
  annotations?: Record<string, unknown>;
}

export interface GeometricComparisonMetrics {
  hausdorffDistanceMm: number;
  chamferDistanceMm: number;
  boundingVolumeIoU: number;
  centroidOffsetMm: number;
  pieceCountDelta: number;
  topologicalPrecision: number; // 0.0 to 1.0
  topologicalRecall: number;    // 0.0 to 1.0
  overallF1Score: number;
}

export interface QualityValidationReport {
  datasetItemId: string;
  isValid: boolean;
  watertightGeometry: boolean;
  zeroCollisions: boolean;
  physicalPlausibilityScore: number;
  issues: string[];
}

export interface PilotDatasetItem {
  id: string;
  name: string;
  category: "house" | "furniture" | "box" | "vehicle" | "mechanical";
  rawDrawingFilename: string;
  rawContent: string;
  format: "svg" | "dxf" | "json";
  groundTruthManifest: GroundTruthAssemblyManifest;
}

export interface BenchmarkItemResult {
  itemId: string;
  name: string;
  category: string;
  success: boolean;
  ingestionTimeMs: number;
  reconstructionTimeMs: number;
  metrics: GeometricComparisonMetrics;
}

export interface RealDataBenchmarkResult {
  timestamp: string;
  totalItemsEvaluated: number;
  successfulReconstructions: number;
  averageHausdorffDistanceMm: number;
  averageChamferDistanceMm: number;
  averageIoU: number;
  averageF1Score: number;
  itemResults: BenchmarkItemResult[];
}
