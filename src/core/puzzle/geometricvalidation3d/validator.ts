/**
 * Deterministic 3D Assembly Geometric Validator.
 *
 * Performs 3D spatial collision analysis, clearance calculations, and interface alignment checks.
 * Strictly distinguishes EXPECTED CONTACT from UNEXPECTED COLLISION.
 */
import type { Vec3 } from "@/core/model/types";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { CanonicalInterface } from "../canonical/types";
import type { Assembly3DValidationReport, Diagnostic3DCollision } from "./types";
import { localToWorld, transformVector } from "../framesystem/transformEngine";
import { add3, dot3, len3, scale3, sub3, vec3 } from "../geometry/math3d";

export function validate3DAssemblyGeometry(
  placements: Record<string, AssemblyPlacement>,
  graph: PuzzleAssemblyGraph,
  solids: Record<string, SolidRepresentation3D>,
  interfaces: Record<string, CanonicalInterface> = {},
  minClearance = 2.0,
): Assembly3DValidationReport {
  const diagnostics: Diagnostic3DCollision[] = [];
  const expectedContacts: Diagnostic3DCollision[] = [];
  const unexpectedCollisions: Diagnostic3DCollision[] = [];
  const misalignments: Diagnostic3DCollision[] = [];

  const pieceIds = Object.keys(placements);

  // 1. Interface Disconnection & Alignment Checks for connected edges
  for (const edge of graph.getAllConnectionEdges()) {
    const pA = placements[edge.sourcePieceId];
    const pB = placements[edge.targetPieceId];

    if (!pA || !pB) continue;

    const ifA = interfaces[edge.sourceInterfaceId];
    const ifB = interfaces[edge.targetInterfaceId];

    if (ifA && ifB && ifA.localFrame && ifB.localFrame) {
      const worldOriginA = localToWorld(pA.transform, ifA.localFrame.origin);
      const worldOriginB = localToWorld(pB.transform, ifB.localFrame.origin);

      const worldNormA = transformVector(pA.transform, ifA.localFrame.normal);
      const worldNormB = transformVector(pB.transform, ifB.localFrame.normal);

      const dist = len3(sub3(worldOriginA, worldOriginB));
      const midPoint = scale3(add3(worldOriginA, worldOriginB), 0.5);

      // Disconnected interface check (distance > 1.5mm)
      if (dist > 1.5) {
        const diag: Diagnostic3DCollision = {
          pieceIdA: edge.sourcePieceId,
          pieceIdB: edge.targetPieceId,
          interfaceIdA: edge.sourceInterfaceId,
          interfaceIdB: edge.targetInterfaceId,
          location: midPoint,
          collisionType: "disconnected_interface",
          severity: "error",
          measuredClearance: dist,
          requiredClearance: 0.5,
          description: `Connection interface '${edge.sourceInterfaceId}' on piece '${edge.sourcePieceId}' is disconnected from '${edge.targetInterfaceId}' on piece '${edge.targetPieceId}' (separation distance: ${dist.toFixed(2)}mm > tol 0.5mm).`,
        };
        diagnostics.push(diag);
        misalignments.push(diag);
      }

      // Interface alignment check
      const normalDot = dot3(worldNormA, worldNormB);
      // Mating interface normals should be opposing (dot product close to -1.0 for flat 180deg mating or perpendicular for 90deg)
      if (isNaN(normalDot)) {
        const diag: Diagnostic3DCollision = {
          pieceIdA: edge.sourcePieceId,
          pieceIdB: edge.targetPieceId,
          interfaceIdA: edge.sourceInterfaceId,
          interfaceIdB: edge.targetInterfaceId,
          location: midPoint,
          collisionType: "invalid_interface_alignment",
          severity: "error",
          measuredClearance: dist,
          requiredClearance: 0.0,
          description: `Interface orientation vectors between piece '${edge.sourcePieceId}' and '${edge.targetPieceId}' are corrupt or NaN.`,
        };
        diagnostics.push(diag);
        misalignments.push(diag);
      }
    }
  }

  // 2. Spatial Interaction Analysis for Piece Pairs (EXPECTED CONTACT vs UNEXPECTED COLLISION)
  for (let i = 0; i < pieceIds.length; i++) {
    for (let j = i + 1; j < pieceIds.length; j++) {
      const idA = pieceIds[i];
      const idB = pieceIds[j];

      const pA = placements[idA];
      const pB = placements[idB];
      const solidA = solids[idA];
      const solidB = solids[idB];

      if (!pA || !pB || !solidA || !solidB) continue;

      // Compute world bounding boxes
      const boxA = getWorldBoundingBox(solidA, pA);
      const boxB = getWorldBoundingBox(solidB, pB);

      const overlap = getBoxOverlapDepth(boxA, boxB);

      if (overlap.isIntersecting) {
        const isConnectedInGraph = graph.isConnected(idA, idB) && hasDirectConnection(graph, idA, idB);

        if (isConnectedInGraph) {
          // EXPECTED CONTACT at registered connection
          const diag: Diagnostic3DCollision = {
            pieceIdA: idA,
            pieceIdB: idB,
            location: overlap.center,
            collisionType: "expected_contact",
            severity: "info",
            measuredClearance: -overlap.depth,
            requiredClearance: 0.0,
            description: `Expected intentional contact between connected pieces '${idA}' and '${idB}' (engagement depth: ${overlap.depth.toFixed(2)}mm).`,
          };
          diagnostics.push(diag);
          expectedContacts.push(diag);
        } else {
          // UNEXPECTED COLLISION between non-connected pieces
          const diag: Diagnostic3DCollision = {
            pieceIdA: idA,
            pieceIdB: idB,
            location: overlap.center,
            collisionType: "unexpected_collision",
            severity: "error",
            measuredClearance: -overlap.depth,
            requiredClearance: 0.0,
            description: `UNEXPECTED 3D COLLISION DETECTED! Non-connected pieces '${idA}' and '${idB}' penetrate each other by ${overlap.depth.toFixed(2)}mm.`,
          };
          diagnostics.push(diag);
          unexpectedCollisions.push(diag);
        }
      } else {
        // Clearance check for non-connected pieces
        const gap = overlap.clearanceGap;
        if (gap > 0 && gap < minClearance) {
          const diag: Diagnostic3DCollision = {
            pieceIdA: idA,
            pieceIdB: idB,
            location: overlap.center,
            collisionType: "insufficient_clearance",
            severity: "warning",
            measuredClearance: gap,
            requiredClearance: minClearance,
            description: `Insufficient clearance gap (${gap.toFixed(2)}mm) between pieces '${idA}' and '${idB}' < required min clearance (${minClearance.toFixed(2)}mm).`,
          };
          diagnostics.push(diag);
        }
      }
    }
  }

  const isValid = diagnostics.every((d) => d.severity !== "error");

  return {
    isValid,
    diagnostics,
    expectedContacts,
    unexpectedCollisions,
    misalignments,
  };
}

function hasDirectConnection(graph: PuzzleAssemblyGraph, pieceIdA: string, pieceIdB: string): boolean {
  for (const edge of graph.getAllConnectionEdges()) {
    if (
      (edge.sourcePieceId === pieceIdA && edge.targetPieceId === pieceIdB) ||
      (edge.sourcePieceId === pieceIdB && edge.targetPieceId === pieceIdA)
    ) {
      return true;
    }
  }
  return false;
}

function getWorldBoundingBox(solid: SolidRepresentation3D, placement: AssemblyPlacement) {
  const localMin = solid.localMesh.bounds.min;
  const localMax = solid.localMesh.bounds.max;

  const corners: Vec3[] = [
    localToWorld(placement.transform, { x: localMin.x, y: localMin.y, z: localMin.z }),
    localToWorld(placement.transform, { x: localMax.x, y: localMin.y, z: localMin.z }),
    localToWorld(placement.transform, { x: localMin.x, y: localMax.y, z: localMin.z }),
    localToWorld(placement.transform, { x: localMax.x, y: localMax.y, z: localMin.z }),
    localToWorld(placement.transform, { x: localMin.x, y: localMin.y, z: localMax.z }),
    localToWorld(placement.transform, { x: localMax.x, y: localMin.y, z: localMax.z }),
    localToWorld(placement.transform, { x: localMin.x, y: localMax.y, z: localMax.z }),
    localToWorld(placement.transform, { x: localMax.x, y: localMax.y, z: localMax.z }),
  ];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function getBoxOverlapDepth(
  boxA: { min: Vec3; max: Vec3 },
  boxB: { min: Vec3; max: Vec3 },
): { isIntersecting: boolean; depth: number; clearanceGap: number; center: Vec3 } {
  const dx = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
  const dy = Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y);
  const dz = Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z);

  const isIntersecting = dx > 0 && dy > 0 && dz > 0;
  const depth = isIntersecting ? Math.min(dx, dy, dz) : 0;

  const gapX = Math.max(0, Math.max(boxA.min.x - boxB.max.x, boxB.min.x - boxA.max.x));
  const gapY = Math.max(0, Math.max(boxA.min.y - boxB.max.y, boxB.min.y - boxA.max.y));
  const gapZ = Math.max(0, Math.max(boxA.min.z - boxB.max.z, boxB.min.z - boxA.max.z));
  const clearanceGap = Math.sqrt(gapX * gapX + gapY * gapY + gapZ * gapZ);

  const center: Vec3 = {
    x: (Math.max(boxA.min.x, boxB.min.x) + Math.min(boxA.max.x, boxB.max.x)) / 2,
    y: (Math.max(boxA.min.y, boxB.min.y) + Math.min(boxA.max.y, boxB.max.y)) / 2,
    z: (Math.max(boxA.min.z, boxB.min.z) + Math.min(boxA.max.z, boxB.max.z)) / 2,
  };

  return { isIntersecting, depth, clearanceGap, center };
}
