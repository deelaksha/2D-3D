/**
 * 3D Reconstruction Diagnostics.
 * Tracks stage execution timings, extrusion warnings, transform updates, and reference comparison events.
 */
import type { Vec3 } from "@/core/model/types";

export type Diagnostics3DLevel = "info" | "warning" | "error";

export interface Diagnostics3DItem {
  code: string;
  message: string;
  level: Diagnostics3DLevel;
  timestamp: string;
  location?: Vec3;
  details?: Record<string, unknown>;
}

export class ReconstructionDiagnostics {
  public items: Diagnostics3DItem[] = [];

  add(code: string, message: string, level: Diagnostics3DLevel = "info", location?: Vec3, details?: Record<string, unknown>): void {
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
