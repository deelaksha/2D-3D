/**
 * Unified Puzzle Validation Engine.
 *
 * Consolidates 5 validation domains into a single orchestrator:
 *  1. STRUCTURAL (schema, graph connectivity, piece count)
 *  2. GEOMETRIC (2D boundaries, 3D solids, spatial collisions, clearances)
 *  3. CONNECTION (types, profiles, joining angles, insertion vectors, DOFs)
 *  4. MANUFACTURING (stock dimensions, thickness match, margins, feature sizes)
 *  5. ASSEMBLY (3D transforms, physical assembly sequence feasibility)
 *
 * Produces a machine-readable UnifiedValidationReport equipped with AIRepairDirectives.
 */
import type {
  AIRepairDirective,
  DomainValidationSummary,
  PuzzleValidationInput,
  UnifiedValidationReport,
  ValidationDomain,
} from "./types";
import type { CanonicalInterface } from "../canonical/types";
import { validateCanonicalPuzzle } from "../canonical/validate";
import { validate3DAssemblyGeometry } from "../geometricvalidation3d/validator";
import { ConnectionCompatibilityEngine } from "../compatibilityengine/engine";
import { MaterialConstraintEngine } from "../cardboardsubsystem/engine";
import { AssemblySequenceSolver } from "../sequencesolver/solver";
import { PuzzleAssemblyGraph } from "../graph/graph";
import { uid } from "@/core/model/ids";

export class PuzzleValidationEngine {
  static validatePuzzle(input: PuzzleValidationInput): UnifiedValidationReport {
    const aiRepairDirectives: AIRepairDirective[] = [];

    // Build interfaces dictionary map
    const interfacesMap: Record<string, CanonicalInterface> = {};
    if (input.puzzle?.interfaces) {
      const ifList = Array.isArray(input.puzzle.interfaces)
        ? input.puzzle.interfaces
        : Object.values(input.puzzle.interfaces);
      for (const item of ifList) {
        if (item && (item as CanonicalInterface).id) {
          const ci = item as CanonicalInterface;
          interfacesMap[ci.id] = ci;
        }
      }
    }

    // Initialize domain summaries
    const domainReports: Record<ValidationDomain, DomainValidationSummary> = {
      structural: { domain: "structural", isValid: true, errorCount: 0, warningCount: 0, messages: [] },
      geometric: { domain: "geometric", isValid: true, errorCount: 0, warningCount: 0, messages: [] },
      connection: { domain: "connection", isValid: true, errorCount: 0, warningCount: 0, messages: [] },
      manufacturing: { domain: "manufacturing", isValid: true, errorCount: 0, warningCount: 0, messages: [] },
      assembly: { domain: "assembly", isValid: true, errorCount: 0, warningCount: 0, messages: [] },
    };

    // ------------------------------------------------------------------
    // 1. STRUCTURAL DOMAIN VALIDATION
    // ------------------------------------------------------------------
    const structSummary = domainReports.structural;
    if (input.puzzle) {
      const canonicalReport = validateCanonicalPuzzle(input.puzzle);
      if (canonicalReport.overallSeverity === "error") {
        structSummary.isValid = false;

        for (const issue of canonicalReport.issues) {
          if (issue.severity === "error") structSummary.errorCount++;
          else structSummary.warningCount++;

          structSummary.messages.push(issue.message);

          aiRepairDirectives.push({
            issueId: uid("dir_struct_"),
            domain: "structural",
            severity: issue.severity === "error" ? "error" : "warning",
            targetEntityId: input.puzzle.metadata?.id || "puzzle",
            defectCode: issue.code,
            description: issue.message,
            suggestedRemediation: "Repair canonical puzzle model data structure.",
          });
        }
      }
    }

    const graph = input.graph || new PuzzleAssemblyGraph();
    const isolated = graph.getIsolatedPieces();
    if (isolated.length > 0) {
      structSummary.warningCount += isolated.length;
      structSummary.messages.push(`Detected ${isolated.length} isolated orphan pieces: [${isolated.join(", ")}].`);

      for (const pieceId of isolated) {
        aiRepairDirectives.push({
          issueId: uid("dir_iso_"),
          domain: "structural",
          severity: "warning",
          targetEntityId: pieceId,
          defectCode: "ISOLATED_PIECE",
          description: `Piece '${pieceId}' is isolated in assembly graph with 0 connections.`,
          suggestedRemediation: `Add connection interface to connect piece '${pieceId}' to puzzle.`,
          remediationParams: { targetPieceId: pieceId },
        });
      }
    }

    // ------------------------------------------------------------------
    // 2. GEOMETRIC DOMAIN VALIDATION
    // ------------------------------------------------------------------
    const geoSummary = domainReports.geometric;
    if (input.placements && input.solids) {
      const geoReport = validate3DAssemblyGeometry(
        input.placements,
        graph,
        input.solids,
        interfacesMap,
      );

      if (!geoReport.isValid) {
        geoSummary.isValid = false;
        geoSummary.errorCount += geoReport.unexpectedCollisions.length + geoReport.misalignments.length;

        for (const coll of geoReport.unexpectedCollisions) {
          geoSummary.messages.push(coll.description);
          aiRepairDirectives.push({
            issueId: uid("dir_coll_"),
            domain: "geometric",
            severity: "error",
            targetEntityId: coll.pieceIdA,
            defectCode: "UNEXPECTED_COLLISION",
            description: coll.description,
            suggestedRemediation: `Adjust 3D position of piece '${coll.pieceIdA}' to eliminate ${Math.abs(coll.measuredClearance).toFixed(2)}mm penetration with '${coll.pieceIdB}'.`,
            remediationParams: {
              pieceIdA: coll.pieceIdA,
              pieceIdB: coll.pieceIdB,
              overlapDepthMm: Math.abs(coll.measuredClearance),
            },
          });
        }
      }

      for (const exp of geoReport.expectedContacts) {
        geoSummary.messages.push(exp.description);
      }
    }

    // ------------------------------------------------------------------
    // 3. CONNECTION DOMAIN VALIDATION
    // ------------------------------------------------------------------
    const connSummary = domainReports.connection;
    const compatEngine = new ConnectionCompatibilityEngine();

    if (input.puzzle?.connections) {
      const connList = (Array.isArray(input.puzzle.connections)
        ? input.puzzle.connections
        : Object.values(input.puzzle.connections)) as any[];

      for (const conn of connList) {
        const ifA = interfacesMap[conn.interfaceAId];
        const ifB = interfacesMap[conn.interfaceBId];
        const joiningAngle = conn.allowedAngleRange?.targetAngleDeg ?? 90.0;

        if (ifA && ifB) {
          const compatReport = compatEngine.evaluateCompatibility({
            interfaceA: ifA,
            interfaceB: ifB,
            joiningAngleDeg: joiningAngle,
          });

          if (!compatReport.isCompatible) {
            connSummary.isValid = false;
            connSummary.errorCount++;
            connSummary.messages.push(...compatReport.diagnostics);

            aiRepairDirectives.push({
              issueId: uid("dir_conn_"),
              domain: "connection",
              severity: "error",
              targetEntityId: conn.id,
              defectCode: "INTERFACE_INCOMPATIBLE",
              description: `Connection '${conn.id}' between '${ifA.id}' and '${ifB.id}' failed compatibility checks.`,
              suggestedRemediation: `Update joining angle or interface profile to restore compatibility.`,
              remediationParams: {
                connectionId: conn.id,
                sourceInterfaceId: ifA.id,
                targetInterfaceId: ifB.id,
                joiningAngleDeg: joiningAngle,
              },
            });
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. MANUFACTURING DOMAIN VALIDATION
    // ------------------------------------------------------------------
    const mfgSummary = domainReports.manufacturing;
    const mfgEngine = new MaterialConstraintEngine(
      input.globalMaterialParams || {},
      input.designParams || {},
    );

    if (input.puzzle?.pieces) {
      const pieceList = (Array.isArray(input.puzzle.pieces)
        ? input.puzzle.pieces
        : Object.values(input.puzzle.pieces)) as any[];

      const pieceParams = pieceList.map((p) => ({
        pieceId: p.id,
        name: p.name,
        width: p.dimensions.width,
        height: p.dimensions.height,
        thickness: p.thickness,
        materialId: p.materialId,
      }));

      const mfgReport = mfgEngine.validateAll(pieceParams);
      if (mfgReport.level === "error") {
        mfgSummary.isValid = false;
      }

      for (const res of mfgReport.results) {
        if (!res.satisfied) {
          if (res.level === "error") mfgSummary.errorCount++;
          else mfgSummary.warningCount++;

          mfgSummary.messages.push(res.message);

          if (res.refIds) {
            for (const refId of res.refIds) {
              aiRepairDirectives.push({
                issueId: uid("dir_mfg_"),
                domain: "manufacturing",
                severity: res.level === "error" ? "error" : "warning",
                targetEntityId: refId,
                defectCode: res.code,
                description: res.message,
                suggestedRemediation: `Adjust piece dimensions or select larger stock cardboard sheet.`,
                remediationParams: { refId, code: res.code },
              });
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. ASSEMBLY DOMAIN VALIDATION
    // ------------------------------------------------------------------
    const asmSummary = domainReports.assembly;
    if (input.placements && input.solids) {
      const seqResult = AssemblySequenceSolver.planAssemblySequence({
        graph,
        placements: input.placements,
        solids: input.solids,
        interfaces: interfacesMap,
      });

      if (!seqResult.success) {
        asmSummary.isValid = false;
        asmSummary.errorCount += seqResult.invalidationReasons.length;
        asmSummary.messages.push(...seqResult.invalidationReasons);

        for (const reason of seqResult.invalidationReasons) {
          aiRepairDirectives.push({
            issueId: uid("dir_asm_"),
            domain: "assembly",
            severity: "error",
            targetEntityId: "assembly",
            defectCode: "UNASSEMBLABLE_SEQUENCE",
            description: reason,
            suggestedRemediation: `Re-order assembly insertion sequence or remove blocking geometric obstacles.`,
          });
        }
      } else {
        asmSummary.messages.push(
          `Physical assembly sequence successfully verified (${seqResult.bestSequence?.totalSteps} steps).`,
        );
      }
    }

    // Calculate Overall System Validation Metrics
    const totalErrors =
      structSummary.errorCount +
      geoSummary.errorCount +
      connSummary.errorCount +
      mfgSummary.errorCount +
      asmSummary.errorCount;

    const totalWarnings =
      structSummary.warningCount +
      geoSummary.warningCount +
      connSummary.warningCount +
      mfgSummary.warningCount +
      asmSummary.warningCount;

    const isValid = totalErrors === 0;
    const overallLevel = totalErrors > 0 ? "error" : totalWarnings > 0 ? "warning" : "ok";
    const overallScore = Math.max(0.0, 1.0 - totalErrors * 0.2 - totalWarnings * 0.05);

    return {
      isValid,
      overallLevel,
      overallScore,
      domainReports,
      aiRepairDirectives,
    };
  }
}
