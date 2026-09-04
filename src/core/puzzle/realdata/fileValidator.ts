/**
 * File Integrity & Format Validator (Phase 61).
 *
 * Implements Stage 2: FILE VALIDATION.
 * Validates raw payload integrity for all 8 supported formats:
 * PNG, JPG, SVG, DXF, STEP, STL, OBJ, and JSON.
 * Computes deterministic cryptographic content hashes and generates immutable raw data references.
 */
import type { RawFilePayload } from "../ingestion/types";
import type {
  FileValidationResult,
  RawDataReference,
  SupportedRealDataFormat,
} from "./types";

/**
 * Fast, deterministic SHA-256 implementation in pure TypeScript.
 * Guarantees zero external native dependencies and works identically in Node/Vite/Browser.
 */
function sha256Hex(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;

  // Constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (len % 64 < 56) ? (56 - (len % 64)) : (120 - (len % 64));
  const totalLen = len + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  // Big-endian 64-bit length
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < totalLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[j] + w[j]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hex = [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
  return hex;
}

export class FileIntegrityValidator {
  /**
   * Validates raw file payload integrity across all 8 supported formats.
   */
  static validate(payload: RawFilePayload): FileValidationResult {
    const syntaxErrors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic payload checks
    if (!payload.filename || typeof payload.filename !== "string") {
      syntaxErrors.push("INVALID_FILENAME: Missing or non-string filename.");
    }

    const byteLen =
      payload.content instanceof Uint8Array
        ? payload.content.length
        : new TextEncoder().encode(payload.content || "").length;

    if (byteLen === 0) {
      syntaxErrors.push("EMPTY_PAYLOAD: File content is completely empty (0 bytes).");
    }

    const sha256 = sha256Hex(payload.content || "");
    const ext = this.extractExtension(payload.filename);

    const textContent =
      typeof payload.content === "string"
        ? payload.content
        : new TextDecoder().decode(payload.content || new Uint8Array());

    // 2. Format detection
    const detectedFormat = this.detectFormat(ext, payload.content, textContent);

    // 3. Format-specific deep integrity checks
    if (detectedFormat === "UNKNOWN") {
      syntaxErrors.push(`UNSUPPORTED_FORMAT: File '${payload.filename}' format could not be identified.`);
    } else {
      this.validateFormatContent(detectedFormat, payload.content, textContent, syntaxErrors, warnings);
    }

    const mimeType = this.resolveMimeType(detectedFormat);
    const rawId = `raw_${detectedFormat.toLowerCase()}_${sha256.slice(0, 12)}`;

    const rawReference: RawDataReference = {
      rawId,
      sourceFile: payload.filename,
      sha256,
      sizeBytes: byteLen,
      detectedFormat,
      createdAt: new Date().toISOString(),
      mimeType,
      contentSnippet: textContent.slice(0, 120).replace(/\s+/g, " "),
    };

    return {
      isValid: syntaxErrors.length === 0,
      detectedFormat,
      rawReference,
      syntaxErrors,
      warnings,
    };
  }

  private static extractExtension(filename: string): string {
    if (!filename) return "";
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  }

  private static detectFormat(
    ext: string,
    content: string | Uint8Array,
    text: string
  ): SupportedRealDataFormat | "UNKNOWN" {
    // Check binary headers
    if (content instanceof Uint8Array && content.length >= 4) {
      if (content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4e && content[3] === 0x47) {
        return "PNG";
      }
      if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
        return "JPG";
      }
    }

    switch (ext) {
      case "png":
        return "PNG";
      case "jpg":
      case "jpeg":
        return "JPG";
      case "svg":
        return "SVG";
      case "dxf":
        return "DXF";
      case "step":
      case "stp":
        return "STEP";
      case "stl":
        return "STL";
      case "obj":
        return "OBJ";
      case "json":
        return "JSON";
      default:
        // Content heuristics
        if (text.includes("<svg")) return "SVG";
        if (text.includes("SECTION") && (text.includes("ENTITIES") || text.includes("HEADER"))) return "DXF";
        if (text.includes("ISO-10303-21")) return "STEP";
        if (text.trim().toLowerCase().startsWith("solid")) return "STL";
        if (text.includes("v ") && (text.includes("f ") || text.includes("vn "))) return "OBJ";
        if (text.trim().startsWith("{") || text.trim().startsWith("[")) return "JSON";
        return "UNKNOWN";
    }
  }

  private static validateFormatContent(
    format: SupportedRealDataFormat,
    content: string | Uint8Array,
    text: string,
    errors: string[],
    warnings: string[]
  ): void {
    switch (format) {
      case "PNG":
        if (typeof content === "string") {
          // Fake string content or raster without DPI
          warnings.push("PNG_RASTER_UNSCALED: Raster PNG requires pixel-to-mm scaling reference.");
        } else if (content.length < 8 || content[0] !== 0x89 || content[1] !== 0x50) {
          warnings.push("PNG_NONSTANDARD_HEADER: PNG binary header does not match canonical magic bytes.");
        }
        break;

      case "JPG":
        warnings.push("JPG_RASTER_UNSCALED: Raster JPG requires pixel-to-mm scaling calibration.");
        break;

      case "SVG":
        if (!text.includes("<svg")) {
          errors.push("SVG_MISSING_ROOT: SVG content missing '<svg' root element tag.");
        }
        if (!text.includes("</svg>") && !text.includes("/>")) {
          warnings.push("SVG_UNCLOSED_TAG: SVG file may contain unclosed tag elements.");
        }
        break;

      case "DXF":
        if (!text.includes("SECTION") && !text.includes("ENTITIES")) {
          errors.push("DXF_CORRUPTED_STRUCTURE: DXF file missing mandatory SECTION/ENTITIES keywords.");
        }
        if (!text.includes("EOF")) {
          warnings.push("DXF_MISSING_EOF: DXF does not terminate with canonical EOF marker.");
        }
        break;

      case "STEP":
        if (!text.includes("ISO-10303-21") && !text.includes("HEADER;")) {
          errors.push("STEP_INVALID_HEADER: STEP file missing ISO-10303-21 standard declaration.");
        }
        break;

      case "STL":
        if (typeof content === "string" && !text.trim().toLowerCase().startsWith("solid")) {
          errors.push("STL_INVALID_ASCII: ASCII STL file must begin with 'solid <name>' declaration.");
        } else if (content instanceof Uint8Array && content.length < 84) {
          errors.push("STL_TRUNCATED_BINARY: Binary STL file is smaller than minimum 84-byte header.");
        }
        break;

      case "OBJ":
        if (!text.includes("v ")) {
          errors.push("OBJ_NO_VERTICES: Wavefront OBJ file contains no vertex ('v ') definitions.");
        }
        break;

      case "JSON":
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed !== "object" || parsed === null) {
            errors.push("JSON_ROOT_NOT_OBJECT: JSON root element must be an object or array.");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`JSON_SYNTAX_ERROR: Malformed JSON syntax: ${msg}`);
        }
        break;
    }
  }

  private static resolveMimeType(format: SupportedRealDataFormat | "UNKNOWN"): string {
    switch (format) {
      case "PNG":
        return "image/png";
      case "JPG":
        return "image/jpeg";
      case "SVG":
        return "image/svg+xml";
      case "DXF":
        return "application/dxf";
      case "STEP":
        return "application/step";
      case "STL":
        return "model/stl";
      case "OBJ":
        return "model/obj";
      case "JSON":
        return "application/json";
      default:
        return "application/octet-stream";
    }
  }
}
