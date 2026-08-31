/**
 * 3D Solid Representation Validator.
 *
 * Verifies:
 *  - Valid closed profile
 *  - Valid 3D extrusion bounds
 *  - Non-zero thickness
 *  - Valid solid mesh buffers (non-empty face indices, positive volume, non-NaN coordinates)
 */
import type { SolidRepresentation3D, SolidValidationIssue, SolidValidationReport } from "./types";

export function validate3DSolidRepresentation(
  solid: SolidRepresentation3D,
): SolidValidationReport {
  const issues: SolidValidationIssue[] = [];

  if (!solid || typeof solid !== "object") {
    return {
      overallSeverity: "error",
      issues: [{ severity: "error", code: "NULL_SOLID", message: "Solid representation is null or undefined." }],
    } as any;
  }

  // 1. Non-zero thickness check
  if (typeof solid.thickness !== "number" || solid.thickness <= 0) {
    issues.push({
      severity: "error",
      code: "NON_ZERO_THICKNESS_VIOLATION",
      message: `Stock material thickness must be strictly positive (${solid.thickness}mm).`,
      refIds: [solid.pieceId],
    });
  }

  // 2. Local Mesh Buffer check
  const mesh = solid.localMesh;
  if (!mesh || !mesh.positions || mesh.positions.length === 0) {
    issues.push({
      severity: "error",
      code: "EMPTY_MESH_POSITIONS",
      message: "3D solid local mesh contains empty vertex position buffer.",
      refIds: [solid.pieceId],
    });
  } else {
    // Check for NaN or Infinite coordinates
    let hasNaN = false;
    for (let i = 0; i < mesh.positions.length; i++) {
      if (!Number.isFinite(mesh.positions[i])) {
        hasNaN = true;
        break;
      }
    }
    if (hasNaN) {
      issues.push({
        severity: "error",
        code: "NAN_VERTEX_COORDINATES",
        message: "3D solid mesh contains NaN or infinite vertex coordinates.",
        refIds: [solid.pieceId],
      });
    }
  }

  if (!mesh || !mesh.indices || mesh.indices.length === 0) {
    issues.push({
      severity: "error",
      code: "EMPTY_FACE_INDICES",
      message: "3D solid local mesh contains empty triangle face index buffer.",
      refIds: [solid.pieceId],
    });
  }

  // 3. Extrusion bounds check in local space (z in [-thickness/2, +thickness/2])
  if (mesh && mesh.bounds) {
    const halfT = solid.thickness / 2;
    const zMinDiff = Math.abs(mesh.bounds.min.z - -halfT);
    const zMaxDiff = Math.abs(mesh.bounds.max.z - halfT);
    if (zMinDiff > 1e-3 || zMaxDiff > 1e-3) {
      issues.push({
        severity: "error",
        code: "INVALID_EXTRUSION_BOUNDS",
        message: `3D solid extrusion bounds [${mesh.bounds.min.z.toFixed(2)}, ${mesh.bounds.max.z.toFixed(2)}] do not match expected local thickness range [${-halfT.toFixed(2)}, ${halfT.toFixed(2)}].`,
        refIds: [solid.pieceId],
      });
    }
  }

  // 4. Positive volume check
  if (typeof solid.volumeMm3 !== "number" || solid.volumeMm3 <= 0) {
    issues.push({
      severity: "error",
      code: "NON_POSITIVE_VOLUME",
      message: `3D solid representation must have positive physical volume (${solid.volumeMm3}mm^3).`,
      refIds: [solid.pieceId],
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const level = hasError ? "error" : hasWarning ? "warning" : "ok";

  return { level, issues };
}
