/**
 * Dataset Diff Engine (Phase 63).
 *
 * Computes deep differences between two dataset releases or snapshots:
 *   - Added examples
 *   - Removed examples
 *   - Modified examples (geometry, interfaces, connections, parameters, assembly, split)
 *   - Lifecycle status changes
 */
import type {
  DatasetDiffReport,
  DatasetLifecycleStatus,
  VersionedDatasetExample,
} from "./types";

export class DatasetDiffEngine {
  /**
   * Computes deep difference between base and target dataset examples collections.
   */
  static computeDiff(
    baseVersion: string,
    targetVersion: string,
    baseExamples: VersionedDatasetExample[],
    targetExamples: VersionedDatasetExample[],
    baseStatus?: DatasetLifecycleStatus,
    targetStatus?: DatasetLifecycleStatus
  ): DatasetDiffReport {
    const baseMap = new Map<string, VersionedDatasetExample>();
    for (const ex of baseExamples) baseMap.set(ex.itemId, ex);

    const targetMap = new Map<string, VersionedDatasetExample>();
    for (const ex of targetExamples) targetMap.set(ex.itemId, ex);

    const addedExamples: string[] = [];
    const removedExamples: string[] = [];
    const modifiedExamples: DatasetDiffReport["modifiedExamples"] = [];
    let unchangedCount = 0;

    // Check for added or modified
    for (const [id, targetEx] of targetMap.entries()) {
      const baseEx = baseMap.get(id);
      if (!baseEx) {
        addedExamples.push(id);
      } else {
        const changes = this.diffExamples(baseEx, targetEx);
        if (changes.changedAspects.length > 0) {
          modifiedExamples.push({
            exampleId: id,
            changedAspects: changes.changedAspects,
            details: changes.details,
          });
        } else {
          unchangedCount++;
        }
      }
    }

    // Check for removed
    for (const id of baseMap.keys()) {
      if (!targetMap.has(id)) {
        removedExamples.push(id);
      }
    }

    const totalChanges = addedExamples.length + removedExamples.length + modifiedExamples.length;

    const statusChange =
      baseStatus && targetStatus && baseStatus !== targetStatus
        ? { from: baseStatus, to: targetStatus }
        : undefined;

    return {
      baseVersion,
      targetVersion,
      generatedIso: new Date().toISOString(),
      totalChanges,
      statusChange,
      addedExamples,
      removedExamples,
      modifiedExamples,
      unchangedExamplesCount: unchangedCount,
    };
  }

  private static diffExamples(
    base: VersionedDatasetExample,
    target: VersionedDatasetExample
  ): {
    changedAspects: Array<"geometry" | "interfaces" | "connections" | "parameters" | "assembly" | "split">;
    details: string[];
  } {
    const changedAspects: Array<"geometry" | "interfaces" | "connections" | "parameters" | "assembly" | "split"> = [];
    const details: string[] = [];

    // 1. Split change
    if (base.split !== target.split) {
      changedAspects.push("split");
      details.push(`Split changed from '${base.split}' to '${target.split}'.`);
    }

    // 2. Geometry check
    const baseLoopStr = JSON.stringify((base.pieces || []).map((p) => p.localPolygon2D));
    const targetLoopStr = JSON.stringify((target.pieces || []).map((p) => p.localPolygon2D));
    if (baseLoopStr !== targetLoopStr) {
      changedAspects.push("geometry");
      details.push("Boundary polygon coordinates modified.");
    }

    // 3. Parameters check
    const baseParamsStr = JSON.stringify((base.pieces || []).map((p) => p.designParameters));
    const targetParamsStr = JSON.stringify((target.pieces || []).map((p) => p.designParameters));
    if (baseParamsStr !== targetParamsStr) {
      changedAspects.push("parameters");
      details.push("Design dimensions/parameters modified.");
    }

    // 4. Interfaces check
    const baseIfStr = JSON.stringify((base.interfaces || []).map((i) => ({ id: i.interfaceId, type: i.interfaceType, w: i.profileWidthMm })));
    const targetIfStr = JSON.stringify((target.interfaces || []).map((i) => ({ id: i.interfaceId, type: i.interfaceType, w: i.profileWidthMm })));
    if (baseIfStr !== targetIfStr) {
      changedAspects.push("interfaces");
      details.push("Interface ports modified.");
    }

    // 5. Connections check
    const baseConnStr = JSON.stringify((base.connections || []).map((c) => ({ id: c.connectionId, a: c.interfaceAId, b: c.interfaceBId, angle: c.joiningAngleDeg })));
    const targetConnStr = JSON.stringify((target.connections || []).map((c) => ({ id: c.connectionId, a: c.interfaceAId, b: c.interfaceBId, angle: c.joiningAngleDeg })));
    if (baseConnStr !== targetConnStr) {
      changedAspects.push("connections");
      details.push("Connection graph relationships or joining angles modified.");
    }

    // 6. Assembly check
    const baseAsmStr = JSON.stringify(base.assembly);
    const targetAsmStr = JSON.stringify(target.assembly);
    if (baseAsmStr !== targetAsmStr) {
      changedAspects.push("assembly");
      details.push("Assembly transforms or sequence modified.");
    }

    return { changedAspects, details };
  }
}
