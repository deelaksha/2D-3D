/**
 * Strict Data Validation Engine for Canonical Puzzle Representations.
 *
 * Scans canonical puzzle models for structural integrity, dangling ID references,
 * negative physical dimensions, invalid angle ranges, and malformed fields.
 */
import type {
  CanonicalAssemblyConfiguration,
  CanonicalConnection,
  CanonicalInterface,
  CanonicalPiece,
  CanonicalPuzzle,
  CanonicalValidationIssue,
  CanonicalValidationReport,
} from "./types";

export function validateCanonicalPuzzle(puzzle: any): CanonicalValidationReport {
  const issues: CanonicalValidationIssue[] = [];

  if (!puzzle || typeof puzzle !== "object") {
    return {
      overallSeverity: "error",
      issues: [
        {
          severity: "error",
          code: "MALFORMED_DOCUMENT",
          message: "Puzzle document is null, undefined, or non-object.",
        },
      ],
    };
  }

  // 1. Metadata check
  if (!puzzle.metadata || typeof puzzle.metadata.id !== "string") {
    issues.push({
      severity: "error",
      code: "INVALID_METADATA",
      message: "Puzzle metadata is missing a valid string 'id'.",
    });
  }

  // Set of registered entity IDs for referential integrity checks
  const pieceIdSet = new Set<string>();
  const interfaceIdSet = new Set<string>();
  const connectionIdSet = new Set<string>();

  // 2. Pieces validation
  const pieces: CanonicalPiece[] = Array.isArray(puzzle.pieces) ? puzzle.pieces : [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p || typeof p.id !== "string") {
      issues.push({
        severity: "error",
        code: "MALFORMED_PIECE",
        message: `Piece at index ${i} is missing a valid string 'id'.`,
      });
      continue;
    }

    if (pieceIdSet.has(p.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_PIECE_ID",
        message: `Duplicate piece ID detected: '${p.id}'.`,
        refIds: [p.id],
      });
    }
    pieceIdSet.add(p.id);

    // Dimension bounds check
    if (!p.dimensions || p.dimensions.width <= 0 || p.dimensions.height <= 0) {
      issues.push({
        severity: "error",
        code: "INVALID_PIECE_DIMENSIONS",
        message: `Piece '${p.name || p.id}' has non-positive width or height (${p.dimensions?.width}x${p.dimensions?.height}).`,
        refIds: [p.id],
      });
    }

    if (typeof p.thickness !== "number" || p.thickness <= 0) {
      issues.push({
        severity: "error",
        code: "INVALID_PIECE_THICKNESS",
        message: `Piece '${p.name || p.id}' has non-positive thickness (${p.thickness}).`,
        refIds: [p.id],
      });
    }
  }

  // 3. Interfaces validation
  const interfaces: CanonicalInterface[] = Array.isArray(puzzle.interfaces) ? puzzle.interfaces : [];
  for (let i = 0; i < interfaces.length; i++) {
    const iface = interfaces[i];
    if (!iface || typeof iface.id !== "string") {
      issues.push({
        severity: "error",
        code: "MALFORMED_INTERFACE",
        message: `Interface at index ${i} is missing a valid string 'id'.`,
      });
      continue;
    }

    if (interfaceIdSet.has(iface.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_INTERFACE_ID",
        message: `Duplicate interface ID detected: '${iface.id}'.`,
        refIds: [iface.id],
      });
    }
    interfaceIdSet.add(iface.id);

    // Owning piece dangling reference check
    if (!iface.owningPieceId || !pieceIdSet.has(iface.owningPieceId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_OWNING_PIECE_REF",
        message: `Interface '${iface.id}' references nonexistent owning piece ID '${iface.owningPieceId}'.`,
        refIds: [iface.id, iface.owningPieceId],
      });
    }

    // Profile & tolerance check
    if (iface.tolerance < 0) {
      issues.push({
        severity: "error",
        code: "NEGATIVE_TOLERANCE",
        message: `Interface '${iface.id}' has negative tolerance (${iface.tolerance}).`,
        refIds: [iface.id],
      });
    }
  }

  // Verify piece -> interfaceId references
  for (const p of pieces) {
    if (Array.isArray(p.interfaceIds)) {
      for (const ifId of p.interfaceIds) {
        if (!interfaceIdSet.has(ifId)) {
          issues.push({
            severity: "error",
            code: "DANGLING_PIECE_INTERFACE_REF",
            message: `Piece '${p.id}' references nonexistent interface ID '${ifId}'.`,
            refIds: [p.id, ifId],
          });
        }
      }
    }
  }

  // 4. Connections validation
  const connections: CanonicalConnection[] = Array.isArray(puzzle.connections) ? puzzle.connections : [];
  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    if (!conn || typeof conn.id !== "string") {
      issues.push({
        severity: "error",
        code: "MALFORMED_CONNECTION",
        message: `Connection at index ${i} is missing a valid string 'id'.`,
      });
      continue;
    }

    if (connectionIdSet.has(conn.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_CONNECTION_ID",
        message: `Duplicate connection ID detected: '${conn.id}'.`,
        refIds: [conn.id],
      });
    }
    connectionIdSet.add(conn.id);

    // Interface A & B dangling reference checks
    if (!conn.interfaceAId || !interfaceIdSet.has(conn.interfaceAId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_INTERFACE_A_REF",
        message: `Connection '${conn.id}' references nonexistent interfaceAId '${conn.interfaceAId}'.`,
        refIds: [conn.id, conn.interfaceAId],
      });
    }

    if (!conn.interfaceBId || !interfaceIdSet.has(conn.interfaceBId)) {
      issues.push({
        severity: "error",
        code: "DANGLING_INTERFACE_B_REF",
        message: `Connection '${conn.id}' references nonexistent interfaceBId '${conn.interfaceBId}'.`,
        refIds: [conn.id, conn.interfaceBId],
      });
    }

    // Angle range validation
    if (conn.allowedAngleRange) {
      const { minAngleDeg, maxAngleDeg, targetAngleDeg } = conn.allowedAngleRange;
      if (minAngleDeg > maxAngleDeg) {
        issues.push({
          severity: "error",
          code: "INVALID_ANGLE_RANGE",
          message: `Connection '${conn.id}' has minAngleDeg (${minAngleDeg}°) > maxAngleDeg (${maxAngleDeg}°).`,
          refIds: [conn.id],
        });
      }
      if (targetAngleDeg < minAngleDeg || targetAngleDeg > maxAngleDeg) {
        issues.push({
          severity: "warning",
          code: "TARGET_ANGLE_OUT_OF_RANGE",
          message: `Connection '${conn.id}' targetAngleDeg (${targetAngleDeg}°) is outside allowed range [${minAngleDeg}°, ${maxAngleDeg}°].`,
          refIds: [conn.id],
        });
      }
    }
  }

  // 5. Assembly Configurations validation
  const configs: CanonicalAssemblyConfiguration[] = Array.isArray(puzzle.assemblyConfigurations)
    ? puzzle.assemblyConfigurations
    : [];
  for (const cfg of configs) {
    if (cfg && cfg.pieceTransforms) {
      for (const pieceId of Object.keys(cfg.pieceTransforms)) {
        if (!pieceIdSet.has(pieceId)) {
          issues.push({
            severity: "warning",
            code: "UNKNOWN_PIECE_IN_TRANSFORMS",
            message: `Assembly configuration '${cfg.id}' contains placement transform for unregistered piece ID '${pieceId}'.`,
            refIds: [cfg.id, pieceId],
          });
        }
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const overallSeverity = hasError ? "error" : hasWarning ? "warning" : "ok";

  return { overallSeverity, issues, validatedAt: new Date().toISOString() };
}
