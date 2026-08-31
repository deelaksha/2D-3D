/**
 * Deterministic Baseline Assembly-Sequence Solver.
 *
 * Transforms assembly graph, piece solids, connection interfaces, and constraints
 * into explicit, step-by-step physical assembly sequences (e.g. "P01", "P01 + P02", "P01 + P02 + P03").
 * Crucially proves that graph connectivity != physical assemblability by enforcing 3D spatial collision
 * and insertion constraints at every step.
 */
import type {
  AssemblySequenceSolverInput,
  AssemblySequenceSolverResult,
  ExplicitAssemblySequence,
  ExplicitAssemblyStep,
} from "./types";
import { validate3DAssemblyGeometry } from "../geometricvalidation3d/validator";
import { PuzzleAssemblyGraph } from "../graph/graph";
import { uid } from "@/core/model/ids";

export class AssemblySequenceSolver {
  static planAssemblySequence(input: AssemblySequenceSolverInput): AssemblySequenceSolverResult {
    const { graph, placements, solids, interfaces = {}, basePieceId } = input;
    const allPieceNodes = graph.getAllPieceNodes();

    if (allPieceNodes.length === 0) {
      return {
        success: false,
        validSequences: [],
        totalEvaluatedSequences: 0,
        invalidationReasons: ["Assembly graph contains zero piece nodes."],
      };
    }

    const startId = basePieceId ?? allPieceNodes[0].pieceId;
    const visitedOrder = graph.traverseGraph(startId);

    // Append any isolated or disconnected piece nodes not visited in primary BFS component
    const visitedSet = new Set(visitedOrder);
    const remainingNodes = allPieceNodes.filter((n) => !visitedSet.has(n.pieceId)).map((n) => n.pieceId);
    const candidateOrder = [...visitedOrder, ...remainingNodes];

    const steps: ExplicitAssemblyStep[] = [];
    const invalidationReasons: string[] = [];

    const currentSubAssemblyPieces: string[] = [];
    const currentPlacements: Record<string, any> = {};
    const subGraph = new PuzzleAssemblyGraph();

    let stepNum = 1;

    for (const pieceId of candidateOrder) {
      const p = placements[pieceId];
      if (!p) {
        invalidationReasons.push(`Missing 3D placement transform for piece '${pieceId}'.`);
        break;
      }

      currentSubAssemblyPieces.push(pieceId);
      currentPlacements[pieceId] = p;
      subGraph.addPieceNode(pieceId);

      // Find active connection edges in subassembly
      const activeConns: string[] = [];
      let stepJoiningAngle: number | undefined = undefined;

      for (const edge of graph.getAllConnectionEdges()) {
        if (
          currentSubAssemblyPieces.includes(edge.sourcePieceId) &&
          currentSubAssemblyPieces.includes(edge.targetPieceId)
        ) {
          subGraph.addConnectionEdge(edge);
          activeConns.push(edge.connectionId);
          stepJoiningAngle = edge.joiningAngleDeg;
        }
      }

      // Step 1 (Base Piece)
      if (stepNum === 1) {
        steps.push({
          stepNumber: 1,
          addedPieceId: pieceId,
          activeConnectionIds: [],
          subAssemblyPieces: [...currentSubAssemblyPieces],
          subAssemblyStateLabel: pieceId,
          stepDescription: `Step 1: Place base piece '${pieceId}'.`,
        });
        stepNum++;
        continue;
      }

      // Step k: Validate 3D physical assemblability of subassembly
      const validation = validate3DAssemblyGeometry(
        currentPlacements,
        subGraph,
        solids,
        interfaces,
      );

      if (!validation.isValid) {
        for (const coll of validation.unexpectedCollisions) {
          invalidationReasons.push(
            `Physical insertion collision at Step ${stepNum} adding piece '${pieceId}': UNEXPECTED COLLISION with '${coll.pieceIdB === pieceId ? coll.pieceIdA : coll.pieceIdB}' (penetration: ${Math.abs(coll.measuredClearance).toFixed(2)}mm).`,
          );
        }
        for (const mis of validation.misalignments) {
          invalidationReasons.push(`Interface misalignment at Step ${stepNum}: ${mis.description}`);
        }
      }

      const stateLabel = currentSubAssemblyPieces.join(" + ");
      steps.push({
        stepNumber: stepNum,
        addedPieceId: pieceId,
        activeConnectionIds: activeConns,
        subAssemblyPieces: [...currentSubAssemblyPieces],
        subAssemblyStateLabel: stateLabel,
        joiningAngleDeg: stepJoiningAngle,
        stepDescription: `Step ${stepNum}: Attach '${pieceId}' to subassembly [${stateLabel}] via connections [${activeConns.join(", ")}].`,
      });

      stepNum++;
    }

    const isPhysicallyAssemblable =
      invalidationReasons.length === 0 && steps.length === candidateOrder.length;

    const sequence: ExplicitAssemblySequence = {
      sequenceId: uid("seq"),
      steps,
      isPhysicallyAssemblable,
      totalSteps: steps.length,
      invalidationReasons,
    };

    return {
      success: isPhysicallyAssemblable,
      validSequences: isPhysicallyAssemblable ? [sequence] : [],
      bestSequence: isPhysicallyAssemblable ? sequence : undefined,
      totalEvaluatedSequences: 1,
      invalidationReasons,
    };
  }
}
