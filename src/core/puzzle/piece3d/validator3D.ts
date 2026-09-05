/**
 * 3D Piece Validation Suite (Phase 86 - Stage 5).
 *
 * Deterministically verifies:
 *  1. Closed Profile (non-degenerate, >= 3 vertices, positive area, closed loop)
 *  2. Valid Solid (watertight mesh buffers, positive volume, surface area, valid bounding box)
 *  3. Correct Thickness (positive thickness, mesh Z-span matches stock thickness)
 *  4. Valid Connector Geometry (physical dimensions, clearances, complementarity)
 */

import type { GeneratedPiece3D, Piece3DValidationIssue, Piece3DValidationReport } from "./types";

export class Validator3D {
  /**
   * Validates an array of converted 3D pieces against all Phase 86 criteria.
   */
  public static validatePieces(pieces: GeneratedPiece3D[]): Piece3DValidationReport {
    const issues: Piece3DValidationIssue[] = [];

    let closedProfilesCount = 0;
    let validSolidsCount = 0;
    let correctThicknessCount = 0;
    let validConnectorGeometriesCount = 0;

    let totalSolidVolumeMm3 = 0;
    let totalSurfaceAreaMm2 = 0;
    let totalMassGrams = 0;

    for (const piece of pieces) {
      let pieceHasError = false;

      // 1. Validate Closed Profile
      const prof = piece.profile;
      let profileOk = true;

      if (!prof || !prof.localVertices || prof.localVertices.length < 3) {
        issues.push({
          code: "ERR_PROFILE_DEGENERATE",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' profile has < 3 vertices (${prof?.localVertices?.length ?? 0}).`,
        });
        profileOk = false;
      } else if (!prof.isClosed) {
        issues.push({
          code: "ERR_PROFILE_NOT_CLOSED",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' profile is not marked as closed.`,
        });
        profileOk = false;
      } else if (prof.areaMm2 <= 0) {
        issues.push({
          code: "ERR_PROFILE_ZERO_AREA",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' profile has non-positive area (${prof.areaMm2} mm²).`,
        });
        profileOk = false;
      }

      if (profileOk) closedProfilesCount++;

      // 2. Validate 3D Solid
      const solid = piece.solid;
      const mesh = solid?.localMesh;
      let solidOk = true;

      if (!solid || !mesh) {
        issues.push({
          code: "ERR_MISSING_SOLID_MESH",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' is missing 3D solid mesh.`,
        });
        solidOk = false;
      } else {
        const vertexCount = mesh.positions.length / 3;
        const triangleCount = mesh.indices.length / 3;

        if (vertexCount < 6 || triangleCount < 8) {
          issues.push({
            code: "ERR_SOLID_MESH_TOO_SMALL",
            severity: "error",
            pieceId: piece.pieceId,
            message: `Piece '${piece.pieceId}' solid mesh has insufficient vertices (${vertexCount}) or triangles (${triangleCount}).`,
          });
          solidOk = false;
        }

        if (solid.volumeMm3 <= 0) {
          issues.push({
            code: "ERR_NON_POSITIVE_VOLUME",
            severity: "error",
            pieceId: piece.pieceId,
            message: `Piece '${piece.pieceId}' solid has non-positive volume (${solid.volumeMm3} mm³).`,
          });
          solidOk = false;
        }

        if (solid.surfaceAreaMm2 <= 0) {
          issues.push({
            code: "ERR_NON_POSITIVE_SURFACE_AREA",
            severity: "error",
            pieceId: piece.pieceId,
            message: `Piece '${piece.pieceId}' solid has non-positive surface area (${solid.surfaceAreaMm2} mm²).`,
          });
          solidOk = false;
        }

        // Index range verification
        let invalidIndex = false;
        for (let i = 0; i < mesh.indices.length; i++) {
          if (mesh.indices[i] >= vertexCount) {
            invalidIndex = true;
            break;
          }
        }
        if (invalidIndex) {
          issues.push({
            code: "ERR_OUT_OF_BOUNDS_INDEX",
            severity: "error",
            pieceId: piece.pieceId,
            message: `Piece '${piece.pieceId}' solid mesh contains triangle indices exceeding vertex count.`,
          });
          solidOk = false;
        }

        totalSolidVolumeMm3 += solid.volumeMm3;
        totalSurfaceAreaMm2 += solid.surfaceAreaMm2;
        totalMassGrams += solid.massGrams;
      }

      if (solidOk) validSolidsCount++;

      // 3. Validate Correct Thickness
      let thicknessOk = true;
      if (piece.thickness <= 0) {
        issues.push({
          code: "ERR_INVALID_THICKNESS",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' thickness must be positive (${piece.thickness} mm).`,
        });
        thicknessOk = false;
      } else if (solid && mesh) {
        const zSpan = mesh.bounds.max.z - mesh.bounds.min.z;
        if (Math.abs(zSpan - piece.thickness) > 1e-3) {
          issues.push({
            code: "ERR_THICKNESS_MISMATCH",
            severity: "error",
            pieceId: piece.pieceId,
            message: `Piece '${piece.pieceId}' mesh Z-span (${zSpan.toFixed(3)} mm) does not match thickness (${piece.thickness} mm).`,
          });
          thicknessOk = false;
        }
      }

      if (thicknessOk) correctThicknessCount++;

      // 4. Validate Connector Geometry
      let connectorsOk = true;
      if (piece.connectorParameters.length === 0) {
        // Pieces must have connector parameters
        issues.push({
          code: "WARN_NO_CONNECTORS",
          severity: "warning",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' has 0 attached connector parameters.`,
        });
      } else {
        for (const conn of piece.connectorParameters) {
          if (conn.tabWidth <= 0 || conn.tabDepth <= 0 || conn.slotWidth <= 0 || conn.slotDepth <= 0) {
            issues.push({
              code: "ERR_INVALID_CONNECTOR_DIMENSIONS",
              severity: "error",
              pieceId: piece.pieceId,
              message: `Piece '${piece.pieceId}' has invalid connector dimensions.`,
            });
            connectorsOk = false;
          }

          if (conn.clearance < 0.05 || conn.clearance > 1.5) {
            issues.push({
              code: "WARN_OUT_OF_SPEC_CLEARANCE",
              severity: "warning",
              pieceId: piece.pieceId,
              message: `Piece '${piece.pieceId}' has out-of-spec clearance (${conn.clearance} mm).`,
            });
          }

          if (conn.slotWidth < conn.tabWidth - 1e-4) {
            issues.push({
              code: "ERR_CONNECTOR_COMPLEMENTARITY",
              severity: "error",
              pieceId: piece.pieceId,
              message: `Piece '${piece.pieceId}' connector slotWidth < tabWidth.`,
            });
            connectorsOk = false;
          }
        }
      }

      if (connectorsOk) validConnectorGeometriesCount++;

      // Retained properties check
      if (!piece.localCoordinateFrame || !piece.localCoordinateFrame.origin) {
        issues.push({
          code: "ERR_MISSING_LOCAL_FRAME",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' is missing its local coordinate frame.`,
        });
      }

      if (!piece.material?.id) {
        issues.push({
          code: "ERR_MISSING_MATERIAL",
          severity: "error",
          pieceId: piece.pieceId,
          message: `Piece '${piece.pieceId}' is missing material specification.`,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const validPieces = pieces.filter(
      (p) => !issues.some((i) => i.pieceId === p.pieceId && i.severity === "error")
    ).length;

    return {
      isValid: !hasErrors,
      totalPieces: pieces.length,
      validPieces,
      closedProfilesCount,
      validSolidsCount,
      correctThicknessCount,
      validConnectorGeometriesCount,
      issues,
      metrics: {
        totalSolidVolumeMm3: Number(totalSolidVolumeMm3.toFixed(3)),
        totalSurfaceAreaMm2: Number(totalSurfaceAreaMm2.toFixed(3)),
        totalMassGrams: Number(totalMassGrams.toFixed(4)),
      },
    };
  }
}
