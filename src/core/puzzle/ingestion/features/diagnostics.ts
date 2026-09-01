/**
 * Feature Extraction Diagnostics.
 * Tracks warnings, errors, and raw geometry preservation logs during parametric feature extraction.
 */
import type { Vec2 } from "@/core/model/types";

export type FeatureDiagnosticLevel = "info" | "warning" | "error";

export interface FeatureDiagnosticItem {
  code: string;
  message: string;
  level: FeatureDiagnosticLevel;
  timestamp: string;
  location?: Vec2;
  details?: Record<string, unknown>;
}

export class FeatureDiagnostics {
  public items: FeatureDiagnosticItem[] = [];

  add(code: string, message: string, level: FeatureDiagnosticLevel = "info", location?: Vec2, details?: Record<string, unknown>): void {
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
