/**
 * Connection Inferencer 2D Engine.
 * Infers candidate physical connections between Interface A ↔ Interface B across distinct pieces
 * calculating compatibility, profile fit, clearance, orientation constraints, and confidence.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { Detected2DInterface } from "../interfaces/types";
import type { ConnectionCandidate, InferenceResult, InferredConnectionType, ProfileCompatibility } from "./types";
import type { CanonicalConnection } from "../../canonical/types";
import { InferenceDiagnostics } from "./diagnostics";
import { createCanonicalConnection } from "../../canonical/defaults";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });
const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export class ConnectionInferencer2D {
  /**
   * Main entrypoint: Infers physical connection candidates across a set of detected 2D interface ports.
   */
  static inferConnections(
    interfacesByPiece: Map<string, Detected2DInterface[]>,
    diagnostics?: InferenceDiagnostics
  ): InferenceResult {
    const diag = diagnostics || new InferenceDiagnostics();
    const allInterfaces: Detected2DInterface[] = [];
    for (const list of interfacesByPiece.values()) {
      allInterfaces.push(...list);
    }

    diag.info("INFERENCE_START", `Starting connection inference across ${allInterfaces.length} interface port(s).`);

    const candidates: ConnectionCandidate[] = [];
    const canonicalConnections: CanonicalConnection[] = [];
    let connCounter = 1;
    let compatibleCount = 0;
    let incompatibleCount = 0;

    for (let i = 0; i < allInterfaces.length; i++) {
      for (let j = i + 1; j < allInterfaces.length; j++) {
        const ifA = allInterfaces[i];
        const ifB = allInterfaces[j];

        // Reject same-piece interface self-mating
        if (ifA.owningPieceId === ifB.owningPieceId) continue;

        const candidate = this.evaluatePair(ifA, ifB, `conn_cand_${connCounter++}`);
        candidates.push(candidate);

        if (candidate.compatible) {
          compatibleCount++;
          diag.info(
            "CANDIDATE_MATCHED",
            `Inferred compatible connection '${candidate.candidateId}' [${candidate.connectionType}] between '${ifA.id}' and '${ifB.id}' (confidence: ${candidate.confidence.toFixed(2)}).`
          );

          // Map to standard CanonicalConnection IR
          const cConn = createCanonicalConnection(
            ifA.id,
            ifB.id,
            candidate.orientationConstraint.allowedAngleRange.targetAngleDeg
          );
          cConn.id = candidate.candidateId;
          canonicalConnections.push(cConn);
        } else {
          incompatibleCount++;
          diag.info(
            "PAIR_INCOMPATIBLE",
            `Rejected interface pair '${ifA.id}' ↔ '${ifB.id}': ${candidate.reason}`
          );
        }
      }
    }

    diag.info(
      "INFERENCE_COMPLETE",
      `Connection inference complete: ${compatibleCount} compatible candidate(s), ${incompatibleCount} incompatible pair(s).`
    );

    return {
      candidates,
      canonicalConnections,
      diagnostics: diag,
      compatibleCount,
      incompatibleCount,
    };
  }

  /**
   * Evaluates a single pairwise interface combination (Interface A ↔ Interface B).
   */
  private static evaluatePair(
    ifA: Detected2DInterface,
    ifB: Detected2DInterface,
    candidateId: string
  ): ConnectionCandidate {
    const warnings: string[] = [];
    let compatible = true;
    let score = 1.0;
    let reason = "Interfaces are dimensionally and mechanically compatible.";

    // Rule 1: Gender Role Complementarity Check
    const gA = ifA.genderRole;
    const gB = ifB.genderRole;

    let genderCompatible = false;
    if (gA === "insert" && gB === "receiver") genderCompatible = true;
    else if (gA === "receiver" && gB === "insert") genderCompatible = true;
    else if (gA === "neutral" && gB === "neutral") genderCompatible = true;

    if (!genderCompatible) {
      compatible = false;
      score -= 0.6;
      reason = `Incompatible gender roles: '${gA}' cannot mate with '${gB}'.`;
    }

    // Rule 2: Profile Match & Dimensional Tolerance Check
    const widthDiff = Math.abs(ifA.profile.width - ifB.profile.width);
    const depthDiff = Math.abs(ifA.profile.depth - ifB.profile.depth);

    let fitQuality: ProfileCompatibility["fitQuality"] = "exact";
    if (widthDiff > 2.0) {
      fitQuality = "incompatible";
      if (compatible) {
        compatible = false;
        reason = `Profile width mismatch: difference (${widthDiff.toFixed(1)}mm) exceeds tolerance threshold (2.0mm).`;
      }
      score -= 0.5;
    } else if (widthDiff > 0.5) {
      fitQuality = "loose";
      warnings.push(`Loose fit: ${widthDiff.toFixed(1)}mm width variance.`);
      score -= 0.1;
    } else if (widthDiff > 0.1) {
      fitQuality = "tight";
    }

    // Rule 3: Unrelated Flat Edges Filtering
    if (ifA.featureKind === "flat_contact" && ifB.featureKind === "flat_contact") {
      compatible = false;
      score = 0.2;
      reason = "Unrelated flat edges without mating slots or alignment tags do not auto-declare connection.";
    }

    // Determine connection type
    let connectionType: InferredConnectionType = "tab_slot";
    if (ifA.featureKind === "interlock" || ifB.featureKind === "interlock") {
      connectionType = "interlock";
    } else if (ifA.featureKind === "flat_contact" || ifB.featureKind === "flat_contact") {
      connectionType = "edge_contact";
    }

    // Determine kinematic rotation axis and joining angle range
    const targetAngleDeg = connectionType === "tab_slot" ? 90.0 : 180.0;
    const allowedRotationAxis = vec3(0, 0, 1);
    const allowedAngleRange = {
      minAngleDeg: targetAngleDeg - 5.0,
      maxAngleDeg: targetAngleDeg + 5.0,
      targetAngleDeg,
    };

    const midContact = vec2(
      (ifA.local2DFrame.origin.x + ifB.local2DFrame.origin.x) / 2.0,
      (ifA.local2DFrame.origin.y + ifB.local2DFrame.origin.y) / 2.0
    );

    const confidence = Math.max(0.0, Math.min(1.0, score * ifA.confidence * ifB.confidence));

    return {
      candidateId,
      interfaceAId: ifA.id,
      interfaceBId: ifB.id,
      pieceAId: ifA.owningPieceId,
      pieceBId: ifB.owningPieceId,
      compatible,
      connectionType,
      profileCompatibility: {
        widthDeltaMm: Math.round(widthDiff * 100) / 100,
        depthDeltaMm: Math.round(depthDiff * 100) / 100,
        fitQuality,
      },
      matingGeometry: {
        contactCenter: midContact,
        contactNormal: ifA.local2DFrame.normal,
      },
      requiredClearanceMm: Math.max(ifA.clearanceMm, ifB.clearanceMm),
      orientationConstraint: {
        allowedRotationAxis,
        allowedAngleRange,
      },
      confidence: Math.round(confidence * 100) / 100,
      reason,
      warnings,
    };
  }
}
