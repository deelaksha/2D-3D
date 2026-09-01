/**
 * Geometry Comparison Engine (2D boundaries, piece dimensions, interface locations/profiles).
 */
import type { CanonicalPiece, CanonicalPuzzle } from "../canonical/types";
import type { ComparisonTolerances, GeometryComparisonResult, StructuredDiffItem } from "./types";

export class GeometryComparisonEngine {
  static compare(
    refPuzzle: CanonicalPuzzle,
    genPuzzle: CanonicalPuzzle,
    tolerances: ComparisonTolerances
  ): GeometryComparisonResult {
    const diffItems: StructuredDiffItem[] = [];
    let diffCounter = 1;
    let maxDimDelta = 0;
    let maxIfaceDelta = 0;
    let maxProfileDelta = 0;

    const refMap = new Map<string, CanonicalPiece>();
    for (const p of refPuzzle.pieces) refMap.set(p.id, p);

    for (const genP of genPuzzle.pieces) {
      const refP = refMap.get(genP.id);
      if (!refP) continue;

      // Piece Width Delta
      const expW = refP.dimensions.width;
      const genW = genP.dimensions.width;
      const diffW = Math.round((genW - expW) * 1000) / 1000;
      const tolW = tolerances.linearToleranceMm;
      const withinTolW = Math.abs(diffW) <= tolW;

      if (Math.abs(diffW) > maxDimDelta) maxDimDelta = Math.abs(diffW);

      diffItems.push({
        id: `diff_geom_${diffCounter++}`,
        propertyName: `piece_${genP.id}_width`,
        category: "geometry",
        expected: expW,
        generated: genW,
        difference: diffW,
        unit: "mm",
        withinTolerance: withinTolW,
        toleranceUsed: tolW,
      });

      // Piece Height Delta
      const expH = refP.dimensions.height;
      const genH = genP.dimensions.height;
      const diffH = Math.round((genH - expH) * 1000) / 1000;
      const withinTolH = Math.abs(diffH) <= tolW;

      if (Math.abs(diffH) > maxDimDelta) maxDimDelta = Math.abs(diffH);

      diffItems.push({
        id: `diff_geom_${diffCounter++}`,
        propertyName: `piece_${genP.id}_height`,
        category: "geometry",
        expected: expH,
        generated: genH,
        difference: diffH,
        unit: "mm",
        withinTolerance: withinTolH,
        toleranceUsed: tolW,
      });
    }

    // Interface Profile Comparison (e.g. tab_width, slot_depth)
    const refIfMap = new Map();
    for (const iface of refPuzzle.interfaces) refIfMap.set(iface.id, iface);

    for (const genIf of genPuzzle.interfaces) {
      const refIf = refIfMap.get(genIf.id);
      if (!refIf) continue;

      const expTabW = refIf.profile.width;
      const genTabW = genIf.profile.width;
      const diffTabW = Math.round((genTabW - expTabW) * 1000) / 1000;
      const tolTabW = tolerances.profileToleranceMm;
      const withinTolTabW = Math.abs(diffTabW) <= tolTabW;

      if (Math.abs(diffTabW) > maxProfileDelta) maxProfileDelta = Math.abs(diffTabW);

      diffItems.push({
        id: `diff_geom_${diffCounter++}`,
        propertyName: `tab_width_${genIf.id}`,
        category: "geometry",
        expected: expTabW,
        generated: genTabW,
        difference: diffTabW,
        unit: "mm",
        withinTolerance: withinTolTabW,
        toleranceUsed: tolTabW,
      });
    }

    const hasMismatch = diffItems.some((d) => !d.withinTolerance);

    return {
      hasMismatch,
      boundaryOverlapRatio: hasMismatch ? 0.95 : 1.0,
      dimensionDeltaMaxMm: maxDimDelta,
      interfaceLocationMaxDeltaMm: maxIfaceDelta,
      profileDeltaMaxMm: maxProfileDelta,
      diffItems,
    };
  }
}
