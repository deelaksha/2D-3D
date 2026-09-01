/**
 * Detection Diagnostics.
 * Tracks warnings, errors, and uncertainty notes during 2D interface detection.
 */
import type { Vec2 } from "@/core/model/types";

export type DetectionDiagnosticLevel = "info" | "warning" | "error";

export interface DetectionDiagnosticItem {
  code: string;
  message: string;
  level: DetectionDiagnosticLevel;
  timestamp: string;
  location?: Vec2;
  details?: Record<string, unknown>;
}

export class DetectionDiagnostics {
  public items: DetectionDiagnosticItem[] = [];

  add(code: string, message: string, level: DetectionDiagnosticLevel = "info", location?: Vec2, details?: Record<string, unknown>): void {
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

  getErrors(): DetectionDiagnosticItem[] {
    return this.items.filter((item) => item.level === "error");
  }

  getWarnings(): DetectionDiagnosticItem[] {
    return this.items.filter((item) => item.level === "warning");
  }
}
