/**
 * Automatic 2D Interface Detector Master Coordinator.
 * Detects tabs, slots, notches, finger interlocks, and flat contact interfaces from 2D piece geometry
 * and maps them directly into CanonicalInterface IR objects.
 */
import type { SegmentedPiece2D } from "../types";
import type { Detected2DInterface, InterfaceDetectionResult } from "./types";
import type { CanonicalInterface, CanonicalPiece } from "../../canonical/types";
import { DetectionDiagnostics } from "./diagnostics";
import { FeatureAnalyzer } from "./featureAnalyzer";
import { createCanonicalInterface } from "../../canonical/defaults";

export class InterfaceDetector2D {
  /**
   * Detects 2D interface ports for a piece and attaches them to CanonicalPiece.
   */
  static detectForPiece(
    piece: SegmentedPiece2D,
    canonicalPiece?: CanonicalPiece,
    diagnostics?: DetectionDiagnostics
  ): InterfaceDetectionResult {
    const diag = diagnostics || new DetectionDiagnostics();
    diag.info("INTERFACE_DETECT_START", `Detecting 2D interfaces for piece '${piece.pieceId}'.`);

    const interfaces = FeatureAnalyzer.analyzePiece(piece);
    const canonicalInterfaces: CanonicalInterface[] = [];
    let uncertainCount = 0;

    for (const iface of interfaces) {
      if (iface.uncertain) {
        uncertainCount++;
        diag.warning(
          "UNCERTAIN_INTERFACE_FEATURE",
          `Interface '${iface.id}' on piece '${piece.pieceId}' is uncertain (confidence: ${iface.confidence.toFixed(2)}): ${iface.diagnosticReason}`,
          iface.local2DFrame.origin
        );
      }

      // Map to standard CanonicalInterface IR
      const cInterface = createCanonicalInterface(
        iface.owningPieceId,
        iface.name,
        { x: iface.local2DFrame.origin.x, y: iface.local2DFrame.origin.y },
        { x: iface.local2DFrame.normal.x, y: iface.local2DFrame.normal.y }
      );
      cInterface.id = iface.id;
      cInterface.interfaceType = iface.canonicalType;
      cInterface.profile.width = iface.profile.width;
      cInterface.profile.depth = iface.profile.depth;

      canonicalInterfaces.push(cInterface);
    }

    if (canonicalPiece) {
      canonicalPiece.interfaceIds = canonicalInterfaces.map((cIf) => cIf.id);
    }

    diag.info(
      "INTERFACE_DETECT_COMPLETE",
      `Detected ${interfaces.length} interface(s) (${uncertainCount} uncertain) for piece '${piece.pieceId}'.`
    );

    return {
      owningPieceId: piece.pieceId,
      interfaces,
      canonicalInterfaces,
      diagnostics: diag,
      uncertainCount,
    };
  }
}
