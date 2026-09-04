/**
 * Human Review Session Manager & State Machine (Phase 62).
 *
 * Coordinates the complete human review workflow:
 *   - Creates isolated sessions with deep-cloned working copies.
 *   - Enforces 5-state lifecycle: UNREVIEWED, IN_REVIEW, APPROVED, REJECTED, NEEDS_CORRECTION.
 *   - Strictly forbids transitioning to APPROVED if reviewer-independent validation fails.
 *   - Preserves original machine-extracted data immutability.
 */
import type { RealDatasetExample } from "../realdata/types";
import type {
  AnnotationState,
  InspectionSnapshot,
  ReviewSessionFilter,
  ReviewSessionRecord,
  ReviewWorkflowSummary,
} from "./types";
import { ReviewerIndependentValidator } from "./reviewerIndependentValidator";
import { InspectionInspector } from "./inspectionInspector";

export class ApprovalBlockedError extends Error {
  constructor(message: string) {
    super(`HUMAN REVIEW APPROVAL BLOCKED: ${message}`);
    this.name = "ApprovalBlockedError";
  }
}

export class ReviewSessionManager {
  private sessions = new Map<string, ReviewSessionRecord>();

  /**
   * Initializes a review session for a RealDatasetExample.
   */
  createSession(example: RealDatasetExample, reviewerId?: string): ReviewSessionRecord {
    const sessionId = `sess_${example.itemId}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // Deep clone working draft; original remains pristine
    const originalExample = JSON.parse(JSON.stringify(example)) as RealDatasetExample;
    const currentExample = JSON.parse(JSON.stringify(example)) as RealDatasetExample;

    const independentValidation = ReviewerIndependentValidator.validate(currentExample).triStageResult;

    const session: ReviewSessionRecord = {
      sessionId,
      exampleId: example.itemId,
      sourceFile: example.provenance.source_file,
      state: reviewerId ? "IN_REVIEW" : "UNREVIEWED",
      originalExample,
      currentExample,
      history: [],
      assignedReviewerId: reviewerId,
      createdIso: now,
      updatedIso: now,
      independentValidation,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Retrieves a session by ID.
   */
  getSession(sessionId: string): ReviewSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Generates a 11-domain inspection snapshot for a session.
   */
  inspectSession(sessionId: string): InspectionSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`SESSION_NOT_FOUND: Session '${sessionId}' does not exist.`);
    return InspectionInspector.inspect(session.currentExample, session.state);
  }

  /**
   * Transitions session state with mandatory reviewer-independent validation guards.
   */
  transitionState(
    sessionId: string,
    newState: AnnotationState,
    reviewerId: string,
    notes?: string
  ): ReviewSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`SESSION_NOT_FOUND: Session '${sessionId}' does not exist.`);

    const now = new Date().toISOString();

    // GUARD: Cannot approve if reviewer-independent validation detects errors
    if (newState === "APPROVED") {
      const val = ReviewerIndependentValidator.validate(session.currentExample);
      session.independentValidation = val.triStageResult;

      if (!val.isValid || val.errors.length > 0) {
        throw new ApprovalBlockedError(
          `Cannot approve example with active validation errors: ${val.errors.join("; ")}`
        );
      }

      session.approvalAudit = {
        approvedBy: reviewerId,
        approvedAt: now,
        validationScore: val.triStageResult.overallScore,
      };

      // Mark quality status in current example as PASS
      session.currentExample.qualityStatus = "PASS";
      session.currentExample.qualitySummary.status = "PASS";
      session.currentExample.qualitySummary.failureReasons = [];
    }

    if (newState === "REJECTED") {
      session.currentExample.qualityStatus = "FAIL";
      session.currentExample.qualitySummary.status = "FAIL";
    }

    session.state = newState;
    session.assignedReviewerId = reviewerId;
    session.reviewNotes = notes || session.reviewNotes;
    session.updatedIso = now;

    return session;
  }

  /**
   * Filters and lists sessions matching criteria.
   */
  filterSessions(filter: ReviewSessionFilter = {}): ReviewSessionRecord[] {
    return Array.from(this.sessions.values()).filter((s) => {
      if (filter.state && s.state !== filter.state) return false;
      if (filter.reviewerId && s.assignedReviewerId !== filter.reviewerId) return false;
      if (filter.sourceFormat && s.originalExample.provenance.raw_ref?.detectedFormat !== filter.sourceFormat) {
        return false;
      }
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        const match =
          s.sourceFile.toLowerCase().includes(q) ||
          s.exampleId.toLowerCase().includes(q) ||
          s.sessionId.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }

  /**
   * Generates a high-level summary of the review workflow queue.
   */
  getWorkflowSummary(): ReviewWorkflowSummary {
    const list = Array.from(this.sessions.values());
    let totalScore = 0;
    let totalEdits = 0;

    let unreviewed = 0;
    let inReview = 0;
    let approved = 0;
    let rejected = 0;
    let needsCorrection = 0;

    for (const s of list) {
      totalEdits += s.history.length;
      totalScore += s.independentValidation.overallScore;

      switch (s.state) {
        case "UNREVIEWED":
          unreviewed++;
          break;
        case "IN_REVIEW":
          inReview++;
          break;
        case "APPROVED":
          approved++;
          break;
        case "REJECTED":
          rejected++;
          break;
        case "NEEDS_CORRECTION":
          needsCorrection++;
          break;
      }
    }

    return {
      totalSessions: list.length,
      unreviewedCount: unreviewed,
      inReviewCount: inReview,
      approvedCount: approved,
      rejectedCount: rejected,
      needsCorrectionCount: needsCorrection,
      totalEditsApplied: totalEdits,
      averageValidationScore: list.length > 0 ? Number((totalScore / list.length).toFixed(3)) : 1.0,
    };
  }
}
