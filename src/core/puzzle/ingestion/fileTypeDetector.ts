/**
 * File Type Detector Engine.
 * Detects file types based on file extension, magic byte headers, and structural content analysis.
 */
import type { DetectedFileType, RawFilePayload } from "./types";

export class FileTypeDetector {
  /**
   * Detects the exact file type from a RawFilePayload.
   */
  static detect(payload: RawFilePayload): DetectedFileType {
    const ext = this.extractExtension(payload.filename);

    // 1. Magic byte inspection if content is Uint8Array
    if (payload.content instanceof Uint8Array) {
      const magicType = this.detectMagicBytes(payload.content);
      if (magicType !== "unknown") {
        return magicType;
      }
    }

    const textContent = typeof payload.content === "string"
      ? payload.content
      : new TextDecoder().decode(payload.content);

    // 2. Extension & Content Structural Inspection
    switch (ext) {
      case "svg":
        return textContent.includes("<svg") ? "svg" : "unknown";
      case "dxf":
        return textContent.includes("SECTION") || textContent.includes("HEADER") || textContent.includes("ENTITIES") ? "dxf" : "unknown";
      case "step":
      case "stp":
        return textContent.includes("ISO-10303-21") || textContent.includes("HEADER;") ? "step" : "unknown";
      case "stl":
        return textContent.trim().toLowerCase().startsWith("solid") || payload.content instanceof Uint8Array ? "stl" : "unknown";
      case "obj":
        return textContent.includes("v ") || textContent.includes("f ") ? "obj" : "unknown";
      case "png":
        return "png";
      case "jpg":
      case "jpeg":
        return "jpg";
      case "json":
        return this.detectJsonType(textContent);
      default:
        // Content fallback if extension is missing/unknown
        if (textContent.includes("<svg")) return "svg";
        if (textContent.includes("SECTION") && textContent.includes("ENTITIES")) return "dxf";
        if (textContent.includes("ISO-10303-21")) return "step";
        if (textContent.trim().startsWith("{")) return this.detectJsonType(textContent);
        return "unknown";
    }
  }

  /**
   * Extracts lowercase extension from filename.
   */
  private static extractExtension(filename: string): string {
    const parts = filename.split(".");
    if (parts.length <= 1) return "";
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Detects magic bytes for binary files (PNG, JPG, binary STL).
   */
  private static detectMagicBytes(bytes: Uint8Array): DetectedFileType {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return "png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "jpg";
    }
    return "unknown";
  }

  /**
   * Distinguishes JSON structures (WoodKit Project vs CanonicalPuzzle vs generic JSON).
   */
  private static detectJsonType(textContent: string): DetectedFileType {
    try {
      const parsed = JSON.parse(textContent);
      if (parsed.schemaVersion && Array.isArray(parsed.parts) && Array.isArray(parsed.materials)) {
        return "project_json";
      }
      if (parsed.metadata && Array.isArray(parsed.pieces) && Array.isArray(parsed.interfaces)) {
        return "canonical_json";
      }
      return "json";
    } catch {
      return "unknown";
    }
  }
}
