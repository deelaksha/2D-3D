/**
 * Dataset Quality Auditor & Multi-Defect Detection Engine (Phase 63).
 *
 * Scans dataset collections and detects all 9 defect categories:
 *   1. duplicate examples
 *   2. conflicting annotations
 *   3. missing fields
 *   4. invalid geometry
 *   5. invalid connections
 *   6. invalid assemblies
 *   7. missing ground truth
 *   8. data leakage (train vs val/test)
 *   9. near-duplicate train/test examples
 */
import type { Vec2 } from "@/core/model/types";
import type {
  DatasetQualityReport,
  QualityDefect,
  QualityDefectCategory,
  VersionedDatasetExample,
} from "./types";
import { PuzzleAssemblyGraph } from "../graph/graph";
import type { AssemblyConnectionEdge, PuzzlePieceNode } from "../graph/types";

export class QualityAuditor {
  /**
   * Runs comprehensive quality audit across all examples in a dataset version.
   */
  static auditDataset(
    datasetVersion: string,
    examples: VersionedDatasetExample[]
  ): DatasetQualityReport {
    const reportId = `rep_${datasetVersion}_${Date.now()}`;
    const allDefects: QualityDefect[] = [];

    const categoryMap: Record<QualityDefectCategory, QualityDefect[]> = {
      duplicate_examples: [],
      conflicting_annotations: [],
      missing_fields: [],
      invalid_geometry: [],
      invalid_connections: [],
      invalid_assemblies: [],
      missing_ground_truth: [],
      data_leakage: [],
      near_duplicate_train_test: [],
    };

    const addDefect = (
      category: QualityDefectCategory,
      severity: "CRITICAL" | "WARNING" | "INFO",
      message: string,
      exampleIds: string[],
      details?: Record<string, unknown>
    ) => {
      const defect: QualityDefect = {
        defectId: `def_${category}_${allDefects.length + 1}`,
        category,
        severity,
        message,
        exampleIds,
        details,
      };
      categoryMap[category].push(defect);
      allDefects.push(defect);
    };

    // 1. Missing Fields Check
    for (const ex of examples) {
      const missing: string[] = [];
      if (!ex.itemId) missing.push("itemId");
      if (!ex.pieces || !Array.isArray(ex.pieces)) missing.push("pieces");
      if (!ex.interfaces || !Array.isArray(ex.interfaces)) missing.push("interfaces");
      if (!ex.connections || !Array.isArray(ex.connections)) missing.push("connections");
      if (!ex.puzzle) missing.push("puzzle");
      if (!ex.assembly) missing.push("assembly");

      // 7-point metadata check
      const v = ex.versionMetadata;
      if (!v) {
        missing.push("versionMetadata");
      } else {
        if (!v.example_id) missing.push("versionMetadata.example_id");
        if (!v.schema_version) missing.push("versionMetadata.schema_version");
        if (!v.dataset_version) missing.push("versionMetadata.dataset_version");
        if (!v.source_version) missing.push("versionMetadata.source_version");
        if (!v.annotation_version) missing.push("versionMetadata.annotation_version");
        if (!v.geometry_version) missing.push("versionMetadata.geometry_version");
        if (!v.validation_version) missing.push("versionMetadata.validation_version");
      }

      if (missing.length > 0) {
        addDefect(
          "missing_fields",
          "CRITICAL",
          `Example '${ex.itemId || "unknown"}' is missing required fields: ${missing.join(", ")}`,
          [ex.itemId]
        );
      }
    }

    // 2. Duplicate Examples & Conflicting Annotations Check
    const hashToExamples = new Map<string, VersionedDatasetExample[]>();
    const geomSignatureToExamples = new Map<string, VersionedDatasetExample[]>();

    for (const ex of examples) {
      const srcHash = ex.versionMetadata?.source_version || ex.provenance?.source_version || ex.itemId;
      const existing = hashToExamples.get(srcHash) || [];
      existing.push(ex);
      hashToExamples.set(srcHash, existing);

      // Geometric signature
      const sig = this.computeGeometricSignature(ex);
      const geomExisting = geomSignatureToExamples.get(sig) || [];
      geomExisting.push(ex);
      geomSignatureToExamples.set(sig, geomExisting);
    }

    // Flag identical source hash duplicates
    for (const [hash, group] of hashToExamples.entries()) {
      if (group.length > 1) {
        addDefect(
          "duplicate_examples",
          "CRITICAL",
          `Identical source content hash '${hash.slice(0, 10)}...' detected across ${group.length} examples (${group.map((g) => g.itemId).join(", ")}).`,
          group.map((g) => g.itemId)
        );

        // Check for conflicting annotations on identical source
        const diffDifficulties = new Set(group.map((g) => g.userRequirement?.targetDifficulty));
        const diffConnCounts = new Set(group.map((g) => g.connections.length));
        if (diffDifficulties.size > 1 || diffConnCounts.size > 1) {
          addDefect(
            "conflicting_annotations",
            "CRITICAL",
            `Conflicting annotations detected for identical source '${hash.slice(0, 10)}...': differing difficulty ratings or connection configurations.`,
            group.map((g) => g.itemId)
          );
        }
      }
    }

    // 3. Invalid Geometry Check
    for (const ex of examples) {
      for (const p of ex.pieces || []) {
        const loop = p.localPolygon2D || [];
        if (loop.length < 3) {
          addDefect(
            "invalid_geometry",
            "CRITICAL",
            `Piece '${p.pieceId}' in example '${ex.itemId}' has fewer than 3 boundary vertices (${loop.length}).`,
            [ex.itemId]
          );
        } else {
          const area = this.calculateArea(loop);
          if (area < 0.01) {
            addDefect(
              "invalid_geometry",
              "CRITICAL",
              `Piece '${p.pieceId}' in example '${ex.itemId}' has zero or negative surface area (${area.toFixed(4)} mm²).`,
              [ex.itemId]
            );
          }
        }

        if (p.designParameters.thicknessMm <= 0) {
          addDefect(
            "invalid_geometry",
            "CRITICAL",
            `Piece '${p.pieceId}' in example '${ex.itemId}' has invalid thickness ${p.designParameters.thicknessMm}mm.`,
            [ex.itemId]
          );
        }
      }
    }

    // 4. Invalid Connections Check
    for (const ex of examples) {
      const ifMap = new Map<string, (typeof ex.interfaces)[0]>();
      for (const iface of ex.interfaces || []) {
        ifMap.set(iface.interfaceId, iface);
      }

      for (const c of ex.connections || []) {
        const ifA = ifMap.get(c.interfaceAId);
        const ifB = ifMap.get(c.interfaceBId);

        if (!ifA || !ifB) {
          addDefect(
            "invalid_connections",
            "CRITICAL",
            `Connection '${c.connectionId}' in example '${ex.itemId}' references non-existent interface(s): A='${c.interfaceAId}', B='${c.interfaceBId}'.`,
            [ex.itemId]
          );
          continue;
        }

        // Gender role conflict check
        if (ifA.genderRole === "insert" && ifB.genderRole === "insert") {
          addDefect(
            "invalid_connections",
            "CRITICAL",
            `Gender conflict in connection '${c.connectionId}' (insert coupled with insert) in example '${ex.itemId}'.`,
            [ex.itemId]
          );
        }
        if (ifA.genderRole === "receiver" && ifB.genderRole === "receiver") {
          addDefect(
            "invalid_connections",
            "CRITICAL",
            `Gender conflict in connection '${c.connectionId}' (receiver coupled with receiver) in example '${ex.itemId}'.`,
            [ex.itemId]
          );
        }

        // Angle check
        if (typeof c.joiningAngleDeg !== "number" || isNaN(c.joiningAngleDeg) || c.joiningAngleDeg < -360 || c.joiningAngleDeg > 360) {
          addDefect(
            "invalid_connections",
            "CRITICAL",
            `Invalid joining angle ${c.joiningAngleDeg}° in connection '${c.connectionId}' in example '${ex.itemId}'.`,
            [ex.itemId]
          );
        }
      }
    }

    // 5. Invalid Assemblies & Graph Reachability
    for (const ex of examples) {
      const pieces = ex.pieces || [];
      const connections = ex.connections || [];

      if (pieces.length > 1) {
        const nodes: PuzzlePieceNode[] = pieces.map((p) => ({
          pieceId: p.pieceId,
          interfaceIds: ex.interfaces.filter((i) => i.owningPieceId === p.pieceId).map((i) => i.interfaceId),
        }));

        const ifaceMap = new Map<string, (typeof ex.interfaces)[0]>();
        for (const iface of ex.interfaces) ifaceMap.set(iface.interfaceId, iface);

        const edges: AssemblyConnectionEdge[] = [];
        for (const c of connections) {
          const ifA = ifaceMap.get(c.interfaceAId);
          const ifB = ifaceMap.get(c.interfaceBId);
          if (ifA && ifB) {
            edges.push({
              connectionId: c.connectionId,
              sourcePieceId: ifA.owningPieceId,
              sourceInterfaceId: ifA.interfaceId,
              targetPieceId: ifB.owningPieceId,
              targetInterfaceId: ifB.interfaceId,
              connectionType: c.connectionType,
              joiningAngleDeg: c.joiningAngleDeg,
              status: "valid",
            });
          }
        }

        try {
          const graph = new PuzzleAssemblyGraph(nodes, edges);
          const components = graph.getConnectedComponents();
          if (components.length > 1) {
            addDefect(
              "invalid_assemblies",
              "WARNING",
              `Disconnected assembly graph: example '${ex.itemId}' contains ${components.length} isolated components.`,
              [ex.itemId]
            );
          }
        } catch {
          // ignore graph build errors
        }
      }
    }

    // 6. Missing Ground Truth Check
    for (const ex of examples) {
      const pieces = ex.pieces || [];
      const transforms = ex.assembly?.pieceTransforms || {};
      const sequence = ex.assembly?.assemblySequence || [];

      if (pieces.length > 1 && Object.keys(transforms).length === 0) {
        addDefect(
          "missing_ground_truth",
          "CRITICAL",
          `Example '${ex.itemId}' is missing 3D ground truth assembly placements.`,
          [ex.itemId]
        );
      }

      if (pieces.length > 1 && sequence.length === 0) {
        addDefect(
          "missing_ground_truth",
          "WARNING",
          `Example '${ex.itemId}' is missing ground truth assembly sequence.`,
          [ex.itemId]
        );
      }
    }

    // 7. Data Leakage Check (train vs val/test)
    const trainExamples = examples.filter((e) => e.split === "train");
    const valExamples = examples.filter((e) => e.split === "validation");
    const testExamples = examples.filter((e) => e.split === "test");

    const trainIds = new Set(trainExamples.map((e) => e.itemId));
    const trainHashes = new Set(trainExamples.map((e) => e.versionMetadata?.source_version || e.provenance?.source_version));

    // Check train vs validation
    for (const v of valExamples) {
      const hash = v.versionMetadata?.source_version || v.provenance?.source_version;
      if (trainIds.has(v.itemId) || (hash && trainHashes.has(hash))) {
        addDefect(
          "data_leakage",
          "CRITICAL",
          `DATA LEAKAGE: Example '${v.itemId}' (hash=${hash?.slice(0, 8)}) exists in both TRAIN and VALIDATION splits.`,
          [v.itemId]
        );
      }
    }

    // Check train vs test
    for (const t of testExamples) {
      const hash = t.versionMetadata?.source_version || t.provenance?.source_version;
      if (trainIds.has(t.itemId) || (hash && trainHashes.has(hash))) {
        addDefect(
          "data_leakage",
          "CRITICAL",
          `DATA LEAKAGE: Example '${t.itemId}' (hash=${hash?.slice(0, 8)}) exists in both TRAIN and TEST splits.`,
          [t.itemId]
        );
      }
    }

    // Check validation vs test
    const valIds = new Set(valExamples.map((e) => e.itemId));
    for (const t of testExamples) {
      if (valIds.has(t.itemId)) {
        addDefect(
          "data_leakage",
          "CRITICAL",
          `DATA LEAKAGE: Example '${t.itemId}' exists in both VALIDATION and TEST splits.`,
          [t.itemId]
        );
      }
    }

    // 8. Near-Duplicate Train/Test Examples Check
    for (const tr of trainExamples) {
      const trSig = this.computeGeometricSignature(tr);

      for (const te of [...valExamples, ...testExamples]) {
        if (tr.itemId !== te.itemId) {
          const teSig = this.computeGeometricSignature(te);
          if (trSig === teSig) {
            addDefect(
              "near_duplicate_train_test",
              "CRITICAL",
              `NEAR-DUPLICATE LEAKAGE: Train example '${tr.itemId}' has identical geometric profile to ${te.split} example '${te.itemId}'.`,
              [tr.itemId, te.itemId],
              { signature: trSig }
            );
          }
        }
      }
    }

    // Compute Overall Score and Verdict
    const criticalCount = allDefects.filter((d) => d.severity === "CRITICAL").length;
    const warningCount = allDefects.filter((d) => d.severity === "WARNING").length;

    let scoreDeduction = criticalCount * 0.2 + warningCount * 0.05;
    const overallScore = Math.max(0.0, Math.min(1.0, 1.0 - scoreDeduction));
    const isApprovedForTraining = criticalCount === 0;

    const categorySummaries = {} as DatasetQualityReport["categorySummaries"];
    for (const cat of Object.keys(categoryMap) as QualityDefectCategory[]) {
      const defs = categoryMap[cat];
      categorySummaries[cat] = {
        category: cat,
        passed: defs.filter((d) => d.severity === "CRITICAL").length === 0,
        defectCount: defs.length,
        defects: defs,
      };
    }

    return {
      reportId,
      datasetVersion,
      generatedIso: new Date().toISOString(),
      isApprovedForTraining,
      overallScore: Number(overallScore.toFixed(3)),
      totalExamplesAudited: examples.length,
      criticalDefectsCount: criticalCount,
      warningDefectsCount: warningCount,
      categorySummaries,
      allDefects,
    };
  }

  private static calculateArea(pts: Vec2[]): number {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2.0;
  }

  /**
   * Computes deterministic geometric & topological signature for near-duplicate detection.
   */
  private static computeGeometricSignature(ex: VersionedDatasetExample): string {
    const pieceCount = ex.pieces?.length || 0;
    const ifaceCount = ex.interfaces?.length || 0;
    const connCount = ex.connections?.length || 0;

    const dimSignatures = (ex.pieces || [])
      .map((p) => `${p.designParameters.widthMm.toFixed(0)}x${p.designParameters.heightMm.toFixed(0)}x${p.designParameters.thicknessMm.toFixed(1)}`)
      .sort()
      .join("|");

    const ifaceSignatures = (ex.interfaces || [])
      .map((i) => `${i.interfaceType}:${i.genderRole}:${i.profileWidthMm.toFixed(0)}`)
      .sort()
      .join("|");

    return `P${pieceCount}_I${ifaceCount}_C${connCount}_[${dimSignatures}]_[${ifaceSignatures}]`;
  }
}
