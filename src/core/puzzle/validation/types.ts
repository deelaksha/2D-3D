/**
 * Validation domain models for assembly correctness and deterministic geometry verification.
 */
export type PuzzleIssueLevel = "ok" | "warning" | "error";

export interface PuzzleValidationIssue {
  level: PuzzleIssueLevel;
  code: string;
  message: string;
  refs?: string[];
}

export interface PuzzleValidationReport {
  level: PuzzleIssueLevel;
  issues: PuzzleValidationIssue[];
}
