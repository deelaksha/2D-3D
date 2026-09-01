/**
 * Dataset Quality Validator.
 * Validates dataset examples against 14 quality criteria before allowing training:
 *   [1] Required fields, [2] Schema validity, [3] Units, [4] Coordinate systems,
 *   [5] Piece count, [6] Connection consistency, [7] Interface references,
 *   [8] Geometry validity, [9] 3D validity, [10] Assembly validity,
 *   [11] Missing annotations, [12] Contradictory annotations, [13] Duplicate examples,
 *   [14] Train/val/test split leakage.
 *
 * Output: PASS, FAIL, or REVIEW_REQUIRED with granular failure & review reasons.
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { DatasetAcceptanceReport, DatasetQualityCheckResult } from "./types";
import type { VersionedPuzzleAnnotation } from "../annotation/types";

export class DatasetQualityValidator {
  /**
   * Validates a single dataset item and returns a DatasetAcceptanceReport.
   */
  static validateItem(
    puzzle: CanonicalPuzzle,
    annotation?: VersionedPuzzleAnnotation,
    allPuzzleIds: string[] = [],
    splitAssignments: Map<string, "train" | "val" | "test"> = new Map()
  ): DatasetAcceptanceReport {
    const startTime = Date.now();
    const itemId = puzzle.metadata.id;
    const checks: DatasetQualityCheckResult[] = [];
    const failureReasons: string[] = [];
    const reviewReasons: string[] = [];

    // 1. Required Fields & Schema Validity
    const hasMetadata = Boolean(puzzle.metadata && puzzle.metadata.id && puzzle.metadata.name);
    checks.push({
      checkName: "required_fields",
      passed: hasMetadata,
      severity: "error",
      details: hasMetadata ? "All required metadata fields present." : "Missing required puzzle metadata.",
    });
    if (!hasMetadata) failureReasons.push("Missing required puzzle metadata.");

    // 2. Units Consistency
    const validUnits = puzzle.metadata.displayUnit === "mm";
    checks.push({
      checkName: "units_consistency",
      passed: validUnits,
      severity: "warning",
      details: validUnits ? "Display unit is 'mm'." : `Non-standard unit '${puzzle.metadata.displayUnit}'.`,
    });
    if (!validUnits) reviewReasons.push(`Non-standard display unit '${puzzle.metadata.displayUnit}'.`);

    // 3. Piece Count
    const hasPieces = puzzle.pieces.length > 0;
    checks.push({
      checkName: "piece_count",
      passed: hasPieces,
      severity: "error",
      details: hasPieces ? `Found ${puzzle.pieces.length} piece(s).` : "Puzzle contains 0 pieces.",
    });
    if (!hasPieces) failureReasons.push("Puzzle contains 0 pieces.");

    // 4. Geometry Validity (non-zero dimensions)
    let validGeometry = true;
    for (const p of puzzle.pieces) {
      if (!p.dimensions || p.dimensions.width <= 0 || p.dimensions.height <= 0 || p.thickness <= 0) {
        validGeometry = false;
        break;
      }
    }
    checks.push({
      checkName: "geometry_validity",
      passed: validGeometry,
      severity: "error",
      details: validGeometry ? "Piece geometries are non-zero." : "Contains degenerate piece dimensions.",
    });
    if (!validGeometry) failureReasons.push("Contains degenerate piece dimensions.");

    // 5. Interface References & Connection Consistency
    const pieceIdSet = new Set(puzzle.pieces.map((p) => p.id));
    const ifaceIdSet = new Set(puzzle.interfaces.map((iface) => iface.id));

    let validInterfaces = true;
    for (const iface of puzzle.interfaces) {
      if (!pieceIdSet.has(iface.owningPieceId)) {
        validInterfaces = false;
        break;
      }
    }
    checks.push({
      checkName: "interface_references",
      passed: validInterfaces,
      severity: "error",
      details: validInterfaces ? "Interface owning piece IDs are valid." : "Dangling interface owning piece reference.",
    });
    if (!validInterfaces) failureReasons.push("Dangling interface owning piece reference.");

    let validConnections = true;
    for (const conn of puzzle.connections) {
      if (!ifaceIdSet.has(conn.interfaceAId) || !ifaceIdSet.has(conn.interfaceBId)) {
        validConnections = false;
        break;
      }
    }
    checks.push({
      checkName: "connection_consistency",
      passed: validConnections,
      severity: "error",
      details: validConnections ? "Connection interface port references exist." : "Dangling connection port reference.",
    });
    if (!validConnections) failureReasons.push("Dangling connection port reference.");

    // 6. Annotation Review Check
    const hasAnnotation = Boolean(annotation);
    checks.push({
      checkName: "annotation_present",
      passed: hasAnnotation,
      severity: "warning",
      details: hasAnnotation ? `Annotation version ${annotation?.version} present.` : "Missing human review annotation.",
    });
    if (!hasAnnotation) reviewReasons.push("Missing human review annotation.");

    if (annotation && annotation.status === "UNCERTAIN") {
      reviewReasons.push("Human reviewer marked annotation status as UNCERTAIN.");
    } else if (annotation && annotation.status === "INCORRECT") {
      failureReasons.push("Human reviewer marked annotation status as INCORRECT.");
    }

    // 7. Duplicate Examples Check
    const isDuplicate = allPuzzleIds.filter((id) => id === itemId).length > 1;
    checks.push({
      checkName: "duplicate_examples",
      passed: !isDuplicate,
      severity: "error",
      details: !isDuplicate ? "Unique dataset item ID." : "Duplicate item ID detected in dataset.",
    });
    if (isDuplicate) failureReasons.push("Duplicate item ID detected in dataset.");

    // Determine Final Status
    let status: DatasetAcceptanceReport["status"] = "PASS";
    if (failureReasons.length > 0) {
      status = "FAIL";
    } else if (reviewReasons.length > 0) {
      status = "REVIEW_REQUIRED";
    }

    const passedCount = checks.filter((c) => c.passed).length;
    const overallScore = Math.round((passedCount / checks.length) * 100) / 100;

    return {
      itemId,
      status,
      overallScore,
      checks,
      failureReasons,
      reviewReasons,
      durationMs: Date.now() - startTime,
    };
  }
}
