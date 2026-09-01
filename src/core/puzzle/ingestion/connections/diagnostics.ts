/**
 * Connection Inference Diagnostics.
 * Tracks warnings, rejection reasons, and score logs during pairwise connection inference.
 */
import type { Vec2 } from "@/core/model/types";

export type InferenceDiagnosticLevel = "info" | "warning" | "error";

export interface InferenceDiagnosticItem {
  code: string;
  message: string;
  level: InferenceDiagnosticLevel;
  timestamp: string;
  location?: Vec2;
  details?: Record<string, unknown>;
}

export class InferenceDiagnostics {
  public items: InferenceDiagnosticItem[] = [];

  add(code: string, message: string, level: InferenceDiagnosticLevel = "info", location?: Vec2, details?: Record<string, unknown>): void {
    this.items.push({
      code,
      message,
      level,
      timestamp: new Date().toISOString(),
      location,
      details,
    });
  }

  info(code: string, message: string, location?: Vec2, details?: Record<string, unknown>): void {
    this.add(code, message, "info", location, details);
  }

  warning(code: string, message: string, location?: Vec2, details?: Record<string, unknown>): void {
    this.add(code, message, "warning", location, details);
  }

  error(code: string, message: string, location?: Vec2, details?: Record<string, unknown>): void {
    this.add(code, message, "error", location, details);
  }

  hasErrors(): boolean {
    return this.items.some((item) => item.level === "error");
  }

  hasWarnings(): boolean {
    return this.items.some((item) => item.level === "warning");
  }
}
