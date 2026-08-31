/**
 * Constraint Framework Engine.
 *
 * Manages declarative constraints and enforces the critical distinction:
 *  - HARD Constraints: Must NEVER be silently violated.
 *  - SOFT Constraints: Guidance for optimization penalties.
 */
import type {
  ConstraintEvaluationResult,
  ConstraintFrameworkReport,
  DeclarativeConstraint,
} from "./types";
import { evaluateDeclarativeConstraint } from "./evaluator";

export class ConstraintFrameworkEngine {
  private constraints: Map<string, DeclarativeConstraint> = new Map();

  constructor(constraints: DeclarativeConstraint[] = []) {
    for (const c of constraints) this.addConstraint(c);
  }

  addConstraint(constraint: DeclarativeConstraint): DeclarativeConstraint {
    this.constraints.set(constraint.id, { ...constraint });
    return constraint;
  }

  removeConstraint(id: string): boolean {
    return this.constraints.delete(id);
  }

  getConstraint(id: string): DeclarativeConstraint | undefined {
    return this.constraints.get(id);
  }

  getAllConstraints(): DeclarativeConstraint[] {
    return Array.from(this.constraints.values());
  }

  evaluateConstraint(
    constraintId: string,
    context: any = {},
  ): ConstraintEvaluationResult | undefined {
    const c = this.constraints.get(constraintId);
    if (!c) return undefined;
    return evaluateDeclarativeConstraint(c, context);
  }

  evaluateAllConstraints(
    contexts: Record<string, any> = {},
  ): ConstraintFrameworkReport {
    const results: ConstraintEvaluationResult[] = [];
    const hardViolations: ConstraintEvaluationResult[] = [];
    const softViolations: ConstraintEvaluationResult[] = [];

    for (const c of this.constraints.values()) {
      const ctx = contexts[c.id] || contexts[c.type] || contexts;
      const res = evaluateDeclarativeConstraint(c, ctx);
      results.push(res);

      if (!res.satisfied) {
        if (c.severity === "HARD") {
          hardViolations.push(res);
        } else {
          softViolations.push(res);
        }
      }
    }

    const overallSatisfied = hardViolations.length === 0;

    return {
      overallSatisfied,
      hardViolations,
      softViolations,
      results,
    };
  }
}
