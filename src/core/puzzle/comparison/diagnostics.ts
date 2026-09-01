/**
 * Ground-Truth Comparison Diagnostics.
 */
import type { Vec3 } from "@/core/model/types";

export type ComparisonDiagnosticLevel = "info" | "warning" | "error";

export interface ComparisonDiagnosticItem {
  code: string;
  message: string;
  level: ComparisonDiagnosticLevel;
  timestamp: string;
  location?: Vec3;
  details?: Record<string, unknown>;
}

export class ComparisonDiagnostics {
  public items: ComparisonDiagnosticItem[] = [];

  add(code: string, message: string, level: ComparisonDiagnosticLevel = "info", location?: Vec3, details?: Record<string, unknown>): void {
    this.items.push({
      code,
      message,
      level,
      timestamp: new Date().toISOString(),
      location,
      details,
    });
  }

  info(code: string, message: string, location?: Vec3, details?: Record<string, unknown>): void {
    this.add(code, message, "info", location, details);
  }

  warning(code: string, message: string, location?: Vec3, details?: Record<string, unknown>): void {
    this.add(code, message, "warning", location, details);
  }

  error(code: string, message: string, location?: Vec3, details?: Record<string, unknown>): void {
    this.add(code, message, "error", location, details);
  }

  hasErrors(): boolean {
    return this.items.some((item) => item.level === "error");
  }

  hasWarnings(): boolean {
    return this.items.some((item) => item.level === "warning");
  }
}
