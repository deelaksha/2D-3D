/**
 * Pure Material Constraint Verification Checks.
 *
 * Implements 7 physical verification rules + anti-mutation locking against silent AI changes.
 */
import type {
  DesignParameters,
  GlobalMaterialParameters,
  MaterialConstraintCheckResult,
  PieceParameters,
} from "./types";

export function checkPieceWidth(
  piece: PieceParameters,
  usableAreaWidth: number,
): MaterialConstraintCheckResult {
  const satisfied = piece.width <= usableAreaWidth;
  return {
    code: "PIECE_WIDTH_BOUNDS",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `Piece width (${piece.width}mm) fits within usable sheet width (${usableAreaWidth}mm).`
      : `Piece '${piece.name || piece.pieceId}' width (${piece.width}mm) exceeds usable stock sheet width (${usableAreaWidth}mm).`,
    refIds: [piece.pieceId],
  };
}

export function checkPieceHeight(
  piece: PieceParameters,
  usableAreaHeight: number,
): MaterialConstraintCheckResult {
  const satisfied = piece.height <= usableAreaHeight;
  return {
    code: "PIECE_HEIGHT_BOUNDS",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `Piece height (${piece.height}mm) fits within usable sheet height (${usableAreaHeight}mm).`
      : `Piece '${piece.name || piece.pieceId}' height (${piece.height}mm) exceeds usable stock sheet height (${usableAreaHeight}mm).`,
    refIds: [piece.pieceId],
  };
}

export function checkPieceThickness(
  piece: PieceParameters,
  stockThickness: number,
): MaterialConstraintCheckResult {
  const diff = Math.abs(piece.thickness - stockThickness);
  const satisfied = diff <= 1e-3; // Exact match required
  return {
    code: "PIECE_THICKNESS_MATCH",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `Piece thickness (${piece.thickness}mm) matches stock cardboard thickness (${stockThickness}mm).`
      : `Piece '${piece.name || piece.pieceId}' thickness (${piece.thickness}mm) does NOT match selected stock cardboard thickness (${stockThickness}mm).`,
    refIds: [piece.pieceId],
  };
}

export function checkUsableMaterialArea(
  piece: PieceParameters,
  usableAreaWidth: number,
  usableAreaHeight: number,
): MaterialConstraintCheckResult {
  const pieceArea = piece.width * piece.height;
  const usableArea = usableAreaWidth * usableAreaHeight;
  const satisfied = pieceArea <= usableArea;
  return {
    code: "USABLE_AREA_BOUNDS",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `Piece footprint area (${pieceArea.toFixed(0)}mm^2) fits within usable material area (${usableArea.toFixed(0)}mm^2).`
      : `Piece '${piece.name || piece.pieceId}' footprint area (${pieceArea.toFixed(0)}mm^2) exceeds total usable material sheet area (${usableArea.toFixed(0)}mm^2).`,
    refIds: [piece.pieceId],
  };
}

export function checkManufacturingMargin(
  margin: number,
  stockWidth: number,
  stockHeight: number,
): MaterialConstraintCheckResult {
  const usableWidth = stockWidth - 2 * margin;
  const usableHeight = stockHeight - 2 * margin;
  const satisfied = usableWidth > 0 && usableHeight > 0;
  return {
    code: "MANUFACTURING_MARGIN_BOUNDS",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `Manufacturing margin (${margin}mm) leaves valid usable area (${usableWidth}x${usableHeight}mm).`
      : `Manufacturing margin (${margin}mm) is too large for stock sheet dimensions (${stockWidth}x${stockHeight}mm).`,
  };
}

export function checkMinimumClearance(
  actualClearance: number,
  minClearance: number,
): MaterialConstraintCheckResult {
  const satisfied = actualClearance >= minClearance - 1e-3;
  return {
    code: "MINIMUM_CLEARANCE_CHECK",
    satisfied,
    level: satisfied ? "ok" : "warning",
    message: satisfied
      ? `Clearance gap (${actualClearance.toFixed(2)}mm) satisfies minimum clearance requirement (${minClearance.toFixed(2)}mm).`
      : `Clearance gap (${actualClearance.toFixed(2)}mm) is below recommended minimum clearance (${minClearance.toFixed(2)}mm). Risk of kerf overlap during cutting.`,
  };
}

export function checkMinimumFeatureSize(
  featureDimension: number,
  minFeatureSize: number,
  featureName = "Feature",
  refId?: string,
): MaterialConstraintCheckResult {
  const satisfied = featureDimension >= minFeatureSize - 1e-3;
  return {
    code: "MINIMUM_FEATURE_SIZE_CHECK",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? `${featureName} size (${featureDimension.toFixed(2)}mm) meets minimum feature size (${minFeatureSize.toFixed(2)}mm).`
      : `${featureName} size (${featureDimension.toFixed(2)}mm) is smaller than allowed minimum feature size (${minFeatureSize.toFixed(2)}mm). Risk of cardboard snapping or laser burn-out.`,
    refIds: refId ? [refId] : undefined,
  };
}

export function preventSilentParameterMutation(
  original: GlobalMaterialParameters & DesignParameters,
  proposed: Partial<GlobalMaterialParameters & DesignParameters>,
): MaterialConstraintCheckResult {
  if (!original.isLockedByDesign) {
    return {
      code: "PARAMETER_MUTATION_CHECK",
      satisfied: true,
      level: "ok",
      message: "Parameters are unlocked for editing.",
    };
  }

  const mutatedKeys: string[] = [];
  for (const [key, proposedVal] of Object.entries(proposed)) {
    const origVal = (original as any)[key];
    if (proposedVal !== undefined && origVal !== undefined) {
      if (typeof proposedVal === "number" && typeof origVal === "number") {
        if (Math.abs(proposedVal - origVal) > 1e-4) mutatedKeys.push(key);
      } else if (proposedVal !== origVal) {
        mutatedKeys.push(key);
      }
    }
  }

  const satisfied = mutatedKeys.length === 0;
  return {
    code: "SILENT_MUTATION_PREVENTED",
    satisfied,
    level: satisfied ? "ok" : "error",
    message: satisfied
      ? "No unsanctioned parameter mutations detected."
      : `UNSANCTIONED AI PARAMETER MUTATION PREVENTED! Locked material/design parameters [${mutatedKeys.join(", ")}] cannot be mutated once selected for a design.`,
  };
}
