/**
 * Segmentation Diagnostics.
 * Tracks warnings, errors, and explicit ambiguity flags during piece segmentation.
 */
import type { Vec2 } from "@/core/model/types";

export type SegmentationDiagnosticLevel = "info" | "warning" | "error";

export interface SegmentationDiagnosticItem {
  code: string;
  message: string;
  level: SegmentationDiagnosticLevel;
  timestamp: string;
  location?: Vec2;
  details?: Record<string, unknown>;
}

export class SegmentationDiagnostics {
  public items: SegmentationDiagnosticItem[] = [];

  add(code: string, message: string, level: SegmentationDiagnosticLevel = "info", location?: Vec2, details?: Record<string, unknown>): void {
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

  getErrors(): SegmentationDiagnosticItem[] {
    return this.items.filter((item) => item.level === "error");
  }

  getWarnings(): SegmentationDiagnosticItem[] {
    return this.items.filter((item) => item.level === "warning");
  }
}
