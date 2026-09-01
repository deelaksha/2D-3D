/**
 * Dataset Quality Validator & Assembly Validation Subsystem Types (Step 38).
 */
import type { ID } from "@/core/model/types";

export interface PuzzleValidationIssue {
  level: "warning" | "error";
  code: string;
  message: string;
  refs?: ID[];
}

export interface PuzzleValidationReport {
  valid?: boolean;
  level?: "ok" | "warning" | "error";
  issues: PuzzleValidationIssue[];
}

export type DatasetAcceptanceStatus = "PASS" | "FAIL" | "REVIEW_REQUIRED";

export interface DatasetQualityCheckResult {
  checkName: string;
  passed: boolean;
  severity: "error" | "warning";
  details: string;
}

export interface DatasetAcceptanceReport {
  itemId: string;
  status: DatasetAcceptanceStatus;
  overallScore: number; // 0.0 to 1.0
  checks: DatasetQualityCheckResult[];
  failureReasons: string[];
  reviewReasons: string[];
  durationMs: number;
}
