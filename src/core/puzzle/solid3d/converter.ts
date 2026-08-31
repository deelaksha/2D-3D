/**
 * Main 2D-to-3D Solid Conversion Layer Entrypoint.
 *
 * Input: Validated 2D piece geometry + thickness + material parameters
 * Output: 3D solid representation strictly in piece LOCAL coordinate space.
 */
import type { ParametricPiece2D } from "../parametric/types";
import type { CardboardSpecification } from "../domain/types";
import type { SolidRepresentation3D, SolidValidationReport } from "./types";
import { extrude2DPieceTo3DSolidMesh } from "./extruder";
import { validate3DSolidRepresentation } from "./validator";

export interface ConversionResult {
  solid: SolidRepresentation3D;
  validationReport: SolidValidationReport;
}

export function convert2DTo3DSolid(
  piece2D: ParametricPiece2D,
  materialSpec?: CardboardSpecification,
): ConversionResult {
  const thickness = piece2D.thickness;
  const density = materialSpec?.density ?? 0.68; // default cardboard density g/cm^3
  const materialId = piece2D.materialId || materialSpec?.id || "cardboard-2mm";

  // 1. Extrude 2D sampled outlines to piece-LOCAL 3D mesh
  const solid = extrude2DPieceTo3DSolidMesh(
    piece2D.id,
    piece2D.sampledOutlines,
    thickness,
    density,
    materialId,
  );

  // 2. Validate 3D solid representation
  const validationReport = validate3DSolidRepresentation(solid);

  return {
    solid,
    validationReport,
  };
}
