/**
 * Kinematic Tree & Transform Propagation Solver (Phase 95).
 *
 * Implements rigid-body forward kinematics on the assembly graph:
 *  - Distinguishes parent vs child pieces relative to assembly root
 *  - Recalculates child piece transform when joining angle changes
 *  - Recursively propagates rigid delta transforms ΔT to all downstream subtree pieces
 *  - Strictly maintains unchanged local CAD geometry
 */

import type { RigidTransform3D } from "../framesystem/types";
import {
  alignInterfaces,
  composeTransforms,
  inverseTransform,
} from "../framesystem/transformEngine";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";

export interface KinematicUpdateResult {
  newTransforms: Record<string, RigidTransform3D>;
  affectedPieceIds: string[];
  parentPieceId: string;
  childPieceId: string;
}

export class KinematicTreeSolver {
  /**
   * Convenience solver returning full dictionary of updated world transforms.
   */
  public static solveAngleChange(
    puzzle: ConvertedPuzzle3D,
    connectionId: string,
    newAngleDeg: number,
    currentTransforms: Record<string, RigidTransform3D>,
    appliedAngles?: Record<string, number>,
    rootPieceId?: string
  ): Record<string, RigidTransform3D> {
    return this.propagateAngleChange(puzzle, connectionId, newAngleDeg, currentTransforms, rootPieceId).newTransforms;
  }

  /**
   * Recalculates world transforms for the child piece and all downstream pieces
   * when a connection's joining angle is adjusted.
   */
  public static propagateAngleChange(
    puzzle: ConvertedPuzzle3D,
    connectionId: string,
    newAngleDeg: number,
    currentTransforms: Record<string, RigidTransform3D>,
    rootPieceId?: string
  ): KinematicUpdateResult {
    const connection = puzzle.connections.find((c) => c.connectionId === connectionId);
    if (!connection) {
      throw new Error(`Connection '${connectionId}' not found in puzzle.`);
    }

    const effectiveRootId = rootPieceId || puzzle.pieces[0]?.pieceId;

    // 1. Determine Parent vs Child piece via BFS depth from root
    const { parentPieceId, childPieceId } = this.determineParentChild(
      puzzle,
      connection,
      effectiveRootId
    );

    const parentPiece = puzzle.pieces.find((p) => p.pieceId === parentPieceId);
    const childPiece = puzzle.pieces.find((p) => p.pieceId === childPieceId);

    if (!parentPiece || !childPiece) {
      throw new Error(`Missing pieces '${parentPieceId}' or '${childPieceId}' for connection.`);
    }

    const parentTransform = currentTransforms[parentPieceId] || this.createIdentityTransform();
    const oldChildTransform = currentTransforms[childPieceId] || this.createIdentityTransform();

    // 2. Identify corresponding interface frames
    const isParentPieceA = connection.pieceAId === parentPieceId;
    const parentIfaceId = isParentPieceA ? connection.interfaceAId : connection.interfaceBId;
    const childIfaceId = isParentPieceA ? connection.interfaceBId : connection.interfaceAId;

    const parentIface = parentPiece.interfaces.find((i) => i.id === parentIfaceId);
    const childIface = childPiece.interfaces.find((i) => i.id === childIfaceId);

    if (!parentIface || !childIface) {
      throw new Error(
        `Failed to locate interface ports for connection '${connectionId}' between '${parentPieceId}' and '${childPieceId}'.`
      );
    }

    // 3. Compute new world transform for child piece at new angle
    const newChildTransform = alignInterfaces(
      parentIface.localFrame,
      parentTransform,
      childIface.localFrame,
      newAngleDeg
    );

    // 4. Compute delta transform: ΔT = T_child_new ∘ T_child_old^-1
    const invOldChild = inverseTransform(oldChildTransform);
    const deltaTransform = composeTransforms(newChildTransform, invOldChild);

    // 5. Discover all downstream descendants in the subtree starting from childPiece
    const descendants = this.findDownstreamPieces(
      puzzle,
      childPieceId,
      parentPieceId
    );

    const affectedPieceIds = [childPieceId, ...descendants];
    const newTransforms: Record<string, RigidTransform3D> = { ...currentTransforms };

    // Update child transform
    newTransforms[childPieceId] = newChildTransform;

    // Propagate delta transform to all downstream descendants
    for (const descendantId of descendants) {
      const oldDescendantTransform = currentTransforms[descendantId] || this.createIdentityTransform();
      newTransforms[descendantId] = composeTransforms(deltaTransform, oldDescendantTransform);
    }

    return {
      newTransforms,
      affectedPieceIds,
      parentPieceId,
      childPieceId,
    };
  }

  /**
   * Identifies which piece is parent (closer to root) and which is child.
   */
  private static determineParentChild(
    puzzle: ConvertedPuzzle3D,
    connection: RetainedConnection3D,
    rootPieceId: string
  ): { parentPieceId: string; childPieceId: string } {
    const depths = this.computePieceDepths(puzzle, rootPieceId);
    const depthA = depths.get(connection.pieceAId) ?? Infinity;
    const depthB = depths.get(connection.pieceBId) ?? Infinity;

    if (depthA <= depthB) {
      return { parentPieceId: connection.pieceAId, childPieceId: connection.pieceBId };
    } else {
      return { parentPieceId: connection.pieceBId, childPieceId: connection.pieceAId };
    }
  }

  /**
   * Computes BFS depths from rootPieceId.
   */
  private static computePieceDepths(
    puzzle: ConvertedPuzzle3D,
    rootPieceId: string
  ): Map<string, number> {
    const depths = new Map<string, number>();
    depths.set(rootPieceId, 0);

    const adj = new Map<string, string[]>();
    for (const conn of puzzle.connections) {
      if (!adj.has(conn.pieceAId)) adj.set(conn.pieceAId, []);
      if (!adj.has(conn.pieceBId)) adj.set(conn.pieceBId, []);
      adj.get(conn.pieceAId)!.push(conn.pieceBId);
      adj.get(conn.pieceBId)!.push(conn.pieceAId);
    }

    const queue: string[] = [rootPieceId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currDepth = depths.get(curr)!;
      const neighbors = adj.get(curr) || [];

      for (const n of neighbors) {
        if (!depths.has(n)) {
          depths.set(n, currDepth + 1);
          queue.push(n);
        }
      }
    }

    return depths;
  }

  /**
   * Finds all pieces in the assembly subtree reachable from startPieceId
   * without traversing back through forbiddenParentId.
   */
  private static findDownstreamPieces(
    puzzle: ConvertedPuzzle3D,
    startPieceId: string,
    forbiddenParentId: string
  ): string[] {
    const visited = new Set<string>([startPieceId, forbiddenParentId]);
    const downstream: string[] = [];

    const adj = new Map<string, string[]>();
    for (const conn of puzzle.connections) {
      if (!adj.has(conn.pieceAId)) adj.set(conn.pieceAId, []);
      if (!adj.has(conn.pieceBId)) adj.set(conn.pieceBId, []);
      adj.get(conn.pieceAId)!.push(conn.pieceBId);
      adj.get(conn.pieceBId)!.push(conn.pieceAId);
    }

    const queue: string[] = [startPieceId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adj.get(curr) || [];

      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          downstream.push(n);
          queue.push(n);
        }
      }
    }

    return downstream;
  }

  private static createIdentityTransform(): RigidTransform3D {
    return {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
  }
}
