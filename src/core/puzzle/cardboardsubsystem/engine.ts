/**
 * Material Constraint Engine.
 *
 * Enforces physical cardboard constraints and prevents silent parameter mutations.
 */
import type {
  DesignParameters,
  GlobalMaterialParameters,
  MaterialConstraintCheckResult,
  MaterialConstraintValidationReport,
  PieceParameters,
} from "./types";
import {
  checkManufacturingMargin,
  checkMinimumFeatureSize,
  checkPieceHeight,
  checkPieceThickness,
  checkPieceWidth,
  checkUsableMaterialArea,
  preventSilentParameterMutation,
} from "./checks";

export class MaterialConstraintEngine {
  public globalParams: GlobalMaterialParameters;
  public designParams: DesignParameters;

  constructor(
    globalParams: Partial<GlobalMaterialParameters> = {},
    designParams: Partial<DesignParameters> = {},
  ) {
    this.globalParams = {
      stockWidth: globalParams.stockWidth ?? 600,
      stockHeight: globalParams.stockHeight ?? 400,
      stockThickness: globalParams.stockThickness ?? 2.0,
      stockTolerance: globalParams.stockTolerance ?? 0.15,
      density: globalParams.density ?? 0.68,
      grainDirectionDeg: globalParams.grainDirectionDeg ?? 0,
      minBendRadius: globalParams.minBendRadius ?? 4.0,
    };

    this.designParams = {
      manufacturingMargin: designParams.manufacturingMargin ?? 10.0,
      minClearance: designParams.minClearance ?? 3.0,
      minFeatureSize: designParams.minFeatureSize ?? 1.5,
      isLockedByDesign: designParams.isLockedByDesign ?? true,
    };
  }

  get usableAreaWidth(): number {
    return Math.max(0, this.globalParams.stockWidth - 2 * this.designParams.manufacturingMargin);
  }

  get usableAreaHeight(): number {
    return Math.max(0, this.globalParams.stockHeight - 2 * this.designParams.manufacturingMargin);
  }

  validatePiece(piece: PieceParameters): MaterialConstraintCheckResult[] {
    const results: MaterialConstraintCheckResult[] = [];

    // 1. Width check
    results.push(checkPieceWidth(piece, this.usableAreaWidth));

    // 2. Height check
    results.push(checkPieceHeight(piece, this.usableAreaHeight));

    // 3. Thickness match check
    results.push(checkPieceThickness(piece, this.globalParams.stockThickness));

    // 4. Usable area bounds check
    results.push(checkUsableMaterialArea(piece, this.usableAreaWidth, this.usableAreaHeight));

    // 5. Minimum feature size check
    const minFeat = piece.minFeatureSize ?? this.designParams.minFeatureSize;
    if (piece.width < minFeat) {
      results.push(checkMinimumFeatureSize(piece.width, minFeat, `Piece '${piece.name}' width`, piece.pieceId));
    }
    if (piece.height < minFeat) {
      results.push(checkMinimumFeatureSize(piece.height, minFeat, `Piece '${piece.name}' height`, piece.pieceId));
    }

    return results;
  }

  validateAll(pieces: PieceParameters[]): MaterialConstraintValidationReport {
    const results: MaterialConstraintCheckResult[] = [];

    // Manufacturing margin check
    results.push(
      checkManufacturingMargin(
        this.designParams.manufacturingMargin,
        this.globalParams.stockWidth,
        this.globalParams.stockHeight,
      ),
    );

    // Validate individual pieces
    for (const piece of pieces) {
      results.push(...this.validatePiece(piece));
    }

    const hasError = results.some((r) => r.level === "error");
    const hasWarning = results.some((r) => r.level === "warning");
    const level = hasError ? "error" : hasWarning ? "warning" : "ok";

    return {
      level,
      usableAreaWidth: this.usableAreaWidth,
      usableAreaHeight: this.usableAreaHeight,
      results,
    };
  }

  proposeParameterUpdate(
    proposed: Partial<GlobalMaterialParameters & DesignParameters>,
  ): MaterialConstraintCheckResult {
    const currentCombined = { ...this.globalParams, ...this.designParams };
    const check = preventSilentParameterMutation(currentCombined, proposed);

    if (check.satisfied && !this.designParams.isLockedByDesign) {
      // Apply updates if unlocked
      if (proposed.stockWidth !== undefined) this.globalParams.stockWidth = proposed.stockWidth;
      if (proposed.stockHeight !== undefined) this.globalParams.stockHeight = proposed.stockHeight;
      if (proposed.stockThickness !== undefined) this.globalParams.stockThickness = proposed.stockThickness;
      if (proposed.manufacturingMargin !== undefined) this.designParams.manufacturingMargin = proposed.manufacturingMargin;
    }

    return check;
  }
}
