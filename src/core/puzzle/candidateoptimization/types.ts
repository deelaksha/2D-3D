/**
 * Candidate Optimization & Multi-Objective Scoring Types (Phase 54).
 */
import type { DesignCandidate } from "../multicandidate/types";

export interface OptimizationObjectiveWeights {
  materialUtilization: number;     // Weight for sheet area nesting efficiency
  connectionQuality: number;       // Weight for joint friction & alignment
  assemblyDifficulty: number;      // Weight for joining structural stability
  pieceCountEfficiency: number;   // Weight for target piece count compliance
  geometricComplexity: number;    // Weight for boundary contour intricacy
  manufacturability: number;       // Weight for laser/CNC cutting speed
  clearanceQuality: number;        // Weight for kerf & clearance tolerances
  symmetry: number;                // Weight for structural balance & symmetry
  assemblyQuality: number;         // Weight for overall kinematic assembly
}

export interface CandidateScoreBreakdown {
  materialUtilization: number;
  connectionQuality: number;
  assemblyDifficulty: number;
  pieceCountEfficiency: number;
  geometricComplexity: number;
  manufacturability: number;
  clearanceQuality: number;
  symmetry: number;
  assemblyQuality: number;
  totalWeightedScore: number;
}

export interface OptimizedCandidateResult {
  candidateId: string;
  candidateLabel: string;
  candidate: DesignCandidate;
  scoreBreakdown: CandidateScoreBreakdown;
  rank: number;
  isValidCandidate: boolean;
}

export interface CandidateOptimizationReport {
  optimizationId: string;
  bestCandidate?: OptimizedCandidateResult;
  ranking: OptimizedCandidateResult[];
  objectiveWeights: OptimizationObjectiveWeights;
  totalCandidatesEvaluated: number;
  validCandidatesCount: number;
  rejectedCandidatesCount: number;
  processingDurationMs: number;
}
