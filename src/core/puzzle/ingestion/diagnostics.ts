/**
 * Ingestion Diagnostics Subsystem.
 * Provides structured tracking of warnings, errors, unit scaling, coordinate flips, and recovery fallbacks.
 */
export type ImportDiagnosticLevel = "info" | "warning" | "error";

export interface ImportDiagnosticItem {
  code: string;
  message: string;
  level: ImportDiagnosticLevel;
  timestamp: string;
  details?: Record<string, unknown>;
}

export class ImportDiagnostics {
  public items: ImportDiagnosticItem[] = [];

  add(code: string, message: string, level: ImportDiagnosticLevel = "info", details?: Record<string, unknown>): void {
    this.items.push({
      code,
      message,
      level,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  info(code: string, message: string, details?: Record<string, unknown>): void {
    this.add(code, message, "info", details);
  }

  warning(code: string, message: string, details?: Record<string, unknown>): void {
    this.add(code, message, "warning", details);
  }

  error(code: string, message: string, details?: Record<string, unknown>): void {
    this.add(code, message, "error", details);
  }

  hasErrors(): boolean {
    return this.items.some((item) => item.level === "error");
  }

  hasWarnings(): boolean {
    return this.items.some((item) => item.level === "warning");
  }

  getErrors(): ImportDiagnosticItem[] {
    return this.items.filter((item) => item.level === "error");
  }

  getWarnings(): ImportDiagnosticItem[] {
    return this.items.filter((item) => item.level === "warning");
  }

  formatSummary(): string {
    const errCount = this.getErrors().length;
    const warnCount = this.getWarnings().length;
    return `Import Diagnostics: ${errCount} error(s), ${warnCount} warning(s), ${this.items.length} total entries.`;
  }
}
