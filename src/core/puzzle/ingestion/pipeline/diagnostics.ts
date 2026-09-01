/**
 * Pipeline Trace Diagnostics.
 * Consolidated logger accumulating step-by-step stage timings, diagnostic logs, unit scale factors,
 * coordinate flips, gap repairs, ambiguity warnings, and full provenance tracing back to source file.
 */
import type { Vec2 } from "@/core/model/types";

export type PipelineStage =
  | "ingest"
  | "normalize"
  | "extract_geometry"
  | "segment_pieces"
  | "detect_interfaces"
  | "infer_connections"
  | "extract_parameters"
  | "canonical_mapping";

export interface PipelineTraceItem {
  stage: PipelineStage;
  code: string;
  message: string;
  status: "success" | "warning" | "error";
  timestamp: string;
  durationMs?: number;
  location?: Vec2;
  details?: Record<string, unknown>;
}

export class PipelineTraceDiagnostics {
  public traces: PipelineTraceItem[] = [];

  addTrace(
    stage: PipelineStage,
    code: string,
    message: string,
    status: "success" | "warning" | "error" = "success",
    durationMs?: number,
    location?: Vec2,
    details?: Record<string, unknown>
  ): void {
    this.traces.push({
      stage,
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      durationMs,
      location,
      details,
    });
  }

  hasErrors(): boolean {
    return this.traces.some((t) => t.status === "error");
  }

  hasWarnings(): boolean {
    return this.traces.some((t) => t.status === "warning");
  }

  getErrors(): PipelineTraceItem[] {
    return this.traces.filter((t) => t.status === "error");
  }

  getWarnings(): PipelineTraceItem[] {
    return this.traces.filter((t) => t.status === "warning");
  }

  formatTraceSummary(): string {
    const errs = this.getErrors().length;
    const warns = this.getWarnings().length;
    return `Pipeline Trace: ${errs} error(s), ${warns} warning(s), ${this.traces.length} stage log(s).`;
  }
}
