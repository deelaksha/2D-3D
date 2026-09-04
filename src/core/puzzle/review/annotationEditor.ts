/**
 * Annotation Editor & Event Sourcing Engine (Phase 62).
 *
 * Implements editing actions for all 9 editable targets:
 *   1. piece boundaries
 *   2. piece IDs
 *   3. interface IDs
 *   4. interface types
 *   5. connection relationships
 *   6. parameters
 *   7. assembly transforms
 *   8. allowed angles
 *   9. constraints
 *
 * Enforces strict immutability of original source data, records every change
 * as an immutable AnnotationEvent, and runs reviewer-independent validation.
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type {
  AnnotationEvent,
  ReviewEditableTarget,
  ReviewSessionRecord,
} from "./types";
import { ReviewerIndependentValidator } from "./reviewerIndependentValidator";

export class AnnotationEditor {
  /**
   * 1. Edit Piece Boundary
   */
  static editPieceBoundary(
    session: ReviewSessionRecord,
    pieceId: ID,
    newLoop: Vec2[],
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const piece = session.currentExample.pieces.find((p) => p.pieceId === pieceId);
    if (!piece) throw new Error(`PIECE_NOT_FOUND: Cannot edit boundary for non-existent piece '${pieceId}'.`);

    const oldValue = piece.localPolygon2D ? [...piece.localPolygon2D.map((pt) => ({ ...pt }))] : [];
    const newValue = newLoop.map((pt) => ({ ...pt }));

    // Apply to current working draft
    piece.localPolygon2D = newValue;
    if (session.currentExample.segmentationContours) {
      session.currentExample.segmentationContours[pieceId] = newValue;
    }

    return this.commitEvent(session, "piece_boundary", pieceId, oldValue, newValue, reviewerId, reason);
  }

  /**
   * 2. Edit Piece ID
   */
  static editPieceId(
    session: ReviewSessionRecord,
    oldId: ID,
    newId: ID,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const piece = session.currentExample.pieces.find((p) => p.pieceId === oldId);
    if (!piece) throw new Error(`PIECE_NOT_FOUND: Piece '${oldId}' does not exist.`);
    if (session.currentExample.pieces.some((p) => p.pieceId === newId)) {
      throw new Error(`DUPLICATE_ID: Piece ID '${newId}' is already in use.`);
    }

    // Apply rename across all linked structures
    piece.pieceId = newId;

    if (session.currentExample.segmentationContours[oldId]) {
      session.currentExample.segmentationContours[newId] = session.currentExample.segmentationContours[oldId];
      delete session.currentExample.segmentationContours[oldId];
    }

    if (session.currentExample.pieceSolids3D[oldId]) {
      session.currentExample.pieceSolids3D[newId] = session.currentExample.pieceSolids3D[oldId];
      delete session.currentExample.pieceSolids3D[oldId];
    }

    for (const iface of session.currentExample.interfaces) {
      if (iface.owningPieceId === oldId) {
        iface.owningPieceId = newId;
      }
    }

    if (session.currentExample.assembly?.pieceTransforms[oldId]) {
      session.currentExample.assembly.pieceTransforms[newId] = session.currentExample.assembly.pieceTransforms[oldId];
      delete session.currentExample.assembly.pieceTransforms[oldId];
    }

    for (const step of session.currentExample.assembly?.assemblySequence || []) {
      if (step.addedPieceId === oldId) {
        step.addedPieceId = newId;
      }
    }

    return this.commitEvent(session, "piece_id", oldId, oldId, newId, reviewerId, reason);
  }

  /**
   * 3. Edit Interface ID
   */
  static editInterfaceId(
    session: ReviewSessionRecord,
    oldId: ID,
    newId: ID,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const iface = session.currentExample.interfaces.find((i) => i.interfaceId === oldId);
    if (!iface) throw new Error(`INTERFACE_NOT_FOUND: Interface '${oldId}' does not exist.`);
    if (session.currentExample.interfaces.some((i) => i.interfaceId === newId)) {
      throw new Error(`DUPLICATE_ID: Interface ID '${newId}' is already in use.`);
    }

    iface.interfaceId = newId;

    for (const c of session.currentExample.connections) {
      if (c.interfaceAId === oldId) c.interfaceAId = newId;
      if (c.interfaceBId === oldId) c.interfaceBId = newId;
    }

    return this.commitEvent(session, "interface_id", oldId, oldId, newId, reviewerId, reason);
  }

  /**
   * 4. Edit Interface Type & Gender Role
   */
  static editInterfaceType(
    session: ReviewSessionRecord,
    interfaceId: ID,
    newType: "tab" | "slot" | "finger" | "dovetail" | "miter" | "butt" | "custom",
    newGenderRole: "insert" | "receiver" | "neutral",
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const iface = session.currentExample.interfaces.find((i) => i.interfaceId === interfaceId);
    if (!iface) throw new Error(`INTERFACE_NOT_FOUND: Interface '${interfaceId}' does not exist.`);

    const oldValue = { type: iface.interfaceType, genderRole: iface.genderRole };
    const newValue = { type: newType, genderRole: newGenderRole };

    iface.interfaceType = newType;
    iface.genderRole = newGenderRole;

    return this.commitEvent(session, "interface_type", interfaceId, oldValue, newValue, reviewerId, reason);
  }

  /**
   * 5. Edit Connection Relationship
   */
  static editConnectionRelationship(
    session: ReviewSessionRecord,
    connectionId: ID,
    sourceInterfaceId: ID,
    targetInterfaceId: ID,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    let conn = session.currentExample.connections.find((c) => c.connectionId === connectionId);
    let oldValue: unknown = null;

    if (conn) {
      oldValue = { interfaceAId: conn.interfaceAId, interfaceBId: conn.interfaceBId };
      conn.interfaceAId = sourceInterfaceId;
      conn.interfaceBId = targetInterfaceId;
    } else {
      // Add new connection
      conn = {
        connectionId,
        interfaceAId: sourceInterfaceId,
        interfaceBId: targetInterfaceId,
        connectionType: "tab_slot",
        joiningAngleDeg: 90.0,
      };
      session.currentExample.connections.push(conn);
    }

    const newValue = { interfaceAId: sourceInterfaceId, interfaceBId: targetInterfaceId };
    return this.commitEvent(session, "connection_relationship", connectionId, oldValue, newValue, reviewerId, reason);
  }

  /**
   * 6. Edit Parameter
   */
  static editParameter(
    session: ReviewSessionRecord,
    pieceId: ID,
    paramName: "widthMm" | "heightMm" | "thicknessMm" | "tabWidthMm" | "tabDepthMm",
    newValue: number,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const piece = session.currentExample.pieces.find((p) => p.pieceId === pieceId);
    if (!piece) throw new Error(`PIECE_NOT_FOUND: Piece '${pieceId}' does not exist.`);

    const oldValue = piece.designParameters[paramName];
    piece.designParameters[paramName] = newValue;

    return this.commitEvent(session, "parameter", `${pieceId}.${paramName}`, oldValue, newValue, reviewerId, reason);
  }

  /**
   * 7. Edit Assembly Transform
   */
  static editAssemblyTransform(
    session: ReviewSessionRecord,
    pieceId: ID,
    position: Vec3,
    rotationQuaternion: { x: number; y: number; z: number; w: number },
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    if (!session.currentExample.assembly.pieceTransforms) {
      session.currentExample.assembly.pieceTransforms = {};
    }

    const oldValue = session.currentExample.assembly.pieceTransforms[pieceId]
      ? { ...session.currentExample.assembly.pieceTransforms[pieceId] }
      : null;

    const newValue = {
      position: { ...position },
      rotationQuaternion: { ...rotationQuaternion },
    };

    session.currentExample.assembly.pieceTransforms[pieceId] = newValue;

    return this.commitEvent(session, "assembly_transform", pieceId, oldValue, newValue, reviewerId, reason);
  }

  /**
   * 8. Edit Allowed Joining Angle
   */
  static editAllowedAngle(
    session: ReviewSessionRecord,
    connectionId: ID,
    newAngleDeg: number,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    const conn = session.currentExample.connections.find((c) => c.connectionId === connectionId);
    if (!conn) throw new Error(`CONNECTION_NOT_FOUND: Connection '${connectionId}' does not exist.`);

    const oldValue = conn.joiningAngleDeg;
    conn.joiningAngleDeg = newAngleDeg;

    // Update corresponding constraint if present
    for (const c of session.currentExample.constraints || []) {
      if (c.constraintId.includes(connectionId) || (c.parameters && c.parameters.joiningAngleDeg !== undefined)) {
        c.parameters.joiningAngleDeg = newAngleDeg;
      }
    }

    return this.commitEvent(session, "allowed_angle", connectionId, oldValue, newAngleDeg, reviewerId, reason);
  }

  /**
   * 9. Edit Constraint
   */
  static editConstraint(
    session: ReviewSessionRecord,
    constraintId: ID,
    parameters: Record<string, number | string | boolean>,
    severity: "HARD" | "SOFT",
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    let constraint = session.currentExample.constraints.find((c) => c.constraintId === constraintId);
    let oldValue: unknown = null;

    if (constraint) {
      oldValue = { parameters: { ...constraint.parameters }, severity: constraint.severity };
      constraint.parameters = { ...parameters };
      constraint.severity = severity;
    } else {
      constraint = {
        constraintId,
        constraintType: "angle",
        severity,
        parameters: { ...parameters },
      };
      session.currentExample.constraints.push(constraint);
    }

    const newValue = { parameters, severity };
    return this.commitEvent(session, "constraint", constraintId, oldValue, newValue, reviewerId, reason);
  }

  /**
   * Commits an AnnotationEvent, runs reviewer-independent validation, and updates session.
   */
  private static commitEvent(
    session: ReviewSessionRecord,
    target: ReviewEditableTarget,
    targetId: string,
    oldValue: unknown,
    newValue: unknown,
    reviewerId: string,
    reason: string
  ): AnnotationEvent {
    // 1. Run Reviewer-Independent Validation
    const validation = ReviewerIndependentValidator.validate(session.currentExample);
    session.independentValidation = validation.triStageResult;

    // 2. Build Event
    const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const event: AnnotationEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      reviewerId,
      target,
      targetId,
      oldValue,
      newValue,
      reason,
      validationSummary: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    };

    // 3. Update session metadata
    session.history.push(event);
    session.updatedIso = new Date().toISOString();

    if (session.state === "UNREVIEWED") {
      session.state = "IN_REVIEW";
    }

    if (!validation.isValid && session.state === "APPROVED") {
      session.state = "NEEDS_CORRECTION";
    }

    return event;
  }
}
