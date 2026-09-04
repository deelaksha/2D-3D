/**
 * AI Puzzle-Design System Benchmark Types (Phase 77).
 *
 * Formal benchmarking framework evaluating:
 *  - 12 System Domains
 *  - 3 Primary Metrics (VALID DESIGN RATE, PHYSICALLY ASSEMBLABLE RATE, REPAIR SUCCESS RATE)
 *  - Secondary Telemetry (latency, retries, invalid candidates, parameter error, collision rate, constraint violation rate)
 *  - Comparison across 3 System Configurations (Deterministic Baseline, AI-Assisted, AI + Optimization)
 *  - Reproducible Benchmark Reports and Failure Taxonomy
 */

import type { ID } from "@/core/model/types";

/**
 * System configurations evaluated in comparative benchmarking.
 */
export type SystemConfiguration =
  | "DETERMINISTIC_BASELINE"
  | "AI_ASSISTED"
  | "AI_OPTIMIZATION";

/**
 * The 12 required benchmarking domains.
 */
export interface BenchmarkDomainScores {
  requirementParsing: number;       // [0.0, 100.0]
  designPlanning: number;           // [0.0, 100.0]
  pieceGeneration: number;          // [0.0, 100.0]
  interfacePrediction: number;      // [0.0, 100.0]
  connectionPrediction: number;     // [0.0, 100.0]
  parametricCorrectness: number;    // [0.0, 100.0]
  reconstruction3D: number;         // [0.0, 100.0]
  assemblyFeasibility: number;      // [0.0, 100.0]
  repairSuccess: number;            // [0.0, 100.0]
  candidateDiversity: number;       // [0.0, 100.0]
  designQuality: number;            // [0.0, 100.0]
  manufacturability: number;        // [0.0, 100.0]
}

/**
 * Standardized test case specification for the benchmark suite.
 */
export interface BenchmarkTestCase {
  id: string;
  name: string;
  category:
    | "standard_desk"
    | "minimalist_stand"
    | "complex_interlock"
    | "tight_tolerance"
    | "multi_angle"
    | "sheet_utilization_stress"
    | "high_piece_count"
    | "symmetrical_modular";
  prompt: string;
  userPreferences?: {
    targetPieceCount?: number;
    targetDimensions?: {
      widthMm?: number;
      heightMm?: number;
      depthMm?: number;
    };
    preferredMaterialId?: ID;
    defaultJoiningAngleDeg?: number;
    preferredJointType?: string;
    targetDifficulty?: "easy" | "medium" | "hard" | "expert";
    layers?: number;
  };
  stressFactor?: "none" | "clearance_stress" | "aspect_ratio_stress" | "high_density_stress" | "angle_stress";
  tags: string[];
}

/**
 * Standard failure record documenting root-cause and diagnostics.
 */
export interface BenchmarkFailure {
  testCaseId: string;
  systemConfig: SystemConfiguration;
  stage: string;
  failureCategory:
    | "SCHEMA_VIOLATION"
    | "HARD_CONSTRAINT_VIOLATION"
    | "2D_GEOMETRY_DEFECT"
    | "INTERFACE_MISMATCH"
    | "PHYSICAL_PENETRATION"
    | "ASSEMBLY_ENTRAPMENT"
    | "REPAIR_EXHAUSTED"
    | "TIMEOUT_EXCEEDED";
  reason: string;
  diagnosticDetails?: Record<string, any>;
}

/**
 * Comprehensive performance metrics collected for a single system configuration.
 */
export interface SystemBenchmarkMetrics {
  /** PRIMARY METRIC 1: Percentage of generated designs passing all 5 validation gates [0.0, 1.0] */
  validDesignRate: number;

  /** PRIMARY METRIC 2: Percentage of designs with a collision-free physical assembly sequence [0.0, 1.0] */
  physicallyAssemblableRate: number;

  /** PRIMARY METRIC 3: Percentage of flawed/invalid designs successfully repaired [0.0, 1.0] */
  repairSuccessRate: number;

  /** Average end-to-end latency per test case in milliseconds */
  averageLatencyMs: number;

  /** Stage-by-stage latencies in milliseconds */
  stageLatenciesMs: Record<string, number>;

  /** Total number of retries or repair iterations performed */
  totalRetriesCount: number;

  /** Total number of invalid candidate designs generated */
  totalInvalidCandidatesCount: number;

  /** Total candidate designs evaluated */
  totalCandidatesEvaluated: number;

  /** Average percentage parameter deviation from user targets */
  averageParameterErrorPct: number;

  /** Percentage of designs exhibiting 3D physical collision / penetration [0.0, 1.0] */
  collisionRate: number;

  /** Percentage of designs violating declarative hard constraints [0.0, 1.0] */
  constraintViolationRate: number;

  /** Overall composite benchmark score [0.0, 100.0] */
  overallBenchmarkScore: number;

  /** Detailed score breakdown across all 12 domains */
  domainScores: BenchmarkDomainScores;
}

/**
 * Execution report for a single system configuration.
 */
export interface SystemRunReport {
  systemConfig: SystemConfiguration;
  systemName: string;
  testCaseCount: number;
  metrics: SystemBenchmarkMetrics;
  failures: BenchmarkFailure[];
  completedAt: string;
}

/**
 * Complete reproducible comparative benchmark report across all 3 systems.
 */
export interface ComparativeBenchmarkReport {
  reportId: string;
  timestamp: string;
  testSuiteSize: number;
  systems: Record<SystemConfiguration, SystemRunReport>;
  comparativeSummary: {
    validDesignRateComparison: Record<SystemConfiguration, number>;
    assemblableRateComparison: Record<SystemConfiguration, number>;
    repairSuccessRateComparison: Record<SystemConfiguration, number>;
    latencyComparisonMs: Record<SystemConfiguration, number>;
    overallScoreComparison: Record<SystemConfiguration, number>;
  };
  failureTaxonomy: Record<string, number>;
  allFailures: BenchmarkFailure[];
  markdownReport: string;
}
