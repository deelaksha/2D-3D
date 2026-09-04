import { describe, expect, it } from "vitest";
import { RealDataIngestionPipeline } from "../core/puzzle/realdata/realDataIngestionPipeline";
import {
  DatasetApprovalBlockedError,
  DatasetDiffEngine,
  DatasetLockedError,
  DatasetManifest,
  DatasetVersion,
  QualityAuditor,
} from "../core/puzzle/datasetversioning";
import type { RealDatasetExample } from "../core/puzzle/realdata/types";
import type { VersionedDatasetExample } from "../core/puzzle/datasetversioning/types";

// Base sample project JSON
const baseProjectJson = (id: string, width = 100) =>
  JSON.stringify({
    schemaVersion: 1,
    meta: { id, name: `Project ${id}`, displayUnit: "mm" },
    parts: [
      {
        id: "part_1",
        name: "Base Part",
        width,
        height: 100,
        thickness: 3.0,
        connectors: [
          {
            id: "conn_tab_1",
            partId: "part_1",
            name: "Tab",
            type: "tab",
            position: { x: 50, y: 0 },
            orientation: 0,
            width: 20,
            height: 5,
            depth: 5,
            tolerance: 0.1,
            compatibleWith: ["slot"],
          },
        ],
      },
      {
        id: "part_2",
        name: "Wall Part",
        width,
        height: 80,
        thickness: 3.0,
        connectors: [
          {
            id: "conn_slot_1",
            partId: "part_2",
            name: "Slot",
            type: "slot",
            position: { x: 50, y: 0 },
            orientation: 0,
            width: 20,
            height: 5,
            depth: 5,
            tolerance: 0.1,
            compatibleWith: ["tab"],
          },
        ],
      },
    ],
    materials: [{ id: "mat_3mm", name: "Cardboard", thickness: 3.0 }],
    groups: [],
    dimensions: [],
    assembly: {
      placements: [
        { partId: "part_1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { partId: "part_2", position: { x: 0, y: 0, z: 50 }, rotation: { x: 90, y: 0, z: 0 } },
      ],
      connections: [
        {
          id: "c_1",
          fromPartId: "part_1",
          fromConnectorId: "conn_tab_1",
          toPartId: "part_2",
          toConnectorId: "conn_slot_1",
          joiningAngleDeg: 90.0,
          status: "valid",
        },
      ],
    },
  });

function makeExample(id: string, width = 100): RealDatasetExample {
  const result = RealDataIngestionPipeline.ingestFile({
    filename: `${id}.json`,
    content: baseProjectJson(id, width),
  });
  if (!result.datasetExample) throw new Error("Failed to create example.");
  result.datasetExample.itemId = id;
  return result.datasetExample;
}

describe("Phase 63: Dataset Versioning & Quality-Management System", () => {
  describe("1. Mandatory 7-Point Example Version Metadata", () => {
    it("attaches all 7 version metadata fields to every example", () => {
      const dataset = new DatasetVersion("puzzle_cardboard", "v1.0.0");
      const rawEx = makeExample("ex_01");

      const versioned = dataset.addExample(rawEx, "train");

      expect(versioned.versionMetadata).toBeDefined();
      const m = versioned.versionMetadata;

      expect(m.example_id).toBe("ex_01");
      expect(m.schema_version).toBe("1.0.0");
      expect(m.dataset_version).toBe("v1.0.0");
      expect(m.source_version).toBeDefined();
      expect(m.annotation_version).toBe("APPROVED");
      expect(m.geometry_version).toBe("1.0.0");
      expect(m.validation_version).toBe("1.0.0");
    });
  });

  describe("2. Immutable Dataset Snapshots & Manifest", () => {
    it("creates an immutable snapshot and prevents subsequent modifications", () => {
      const dataset = new DatasetVersion("puzzle_cardboard", "v1.0.0");
      dataset.addExample(makeExample("ex_01"), "train");
      dataset.addExample(makeExample("ex_02"), "validation");

      expect(dataset.isLocked()).toBe(false);

      // Lock snapshot
      const manifest = dataset.createSnapshot();
      expect(dataset.isLocked()).toBe(true);
      expect(manifest.isImmutable).toBe(true);
      expect(manifest.rootSnapshotHash).toBeDefined();
      expect(manifest.totalExamples).toBe(2);
      expect(manifest.splitsCount.train).toBe(1);
      expect(manifest.splitsCount.validation).toBe(1);

      // Mutating snapshot must throw DatasetLockedError
      expect(() => {
        dataset.addExample(makeExample("ex_03"), "test");
      }).toThrow(DatasetLockedError);

      expect(() => {
        dataset.removeExample("ex_01");
      }).toThrow(DatasetLockedError);

      expect(() => {
        dataset.assignSplit("ex_01", "test");
      }).toThrow(DatasetLockedError);
    });

    it("serializes and deserializes DatasetManifest accurately", () => {
      const dataset = new DatasetVersion("puzzle_cardboard", "v1.0.0");
      dataset.addExample(makeExample("ex_01"), "train");
      const manifest = dataset.getManifest();

      const jsonStr = DatasetManifest.serialize(manifest);
      const restored = DatasetManifest.deserialize(jsonStr);

      expect(restored.datasetVersion).toBe("v1.0.0");
      expect(restored.rootSnapshotHash).toBe(manifest.rootSnapshotHash);
      expect(restored.itemEntries.length).toBe(1);
    });
  });

  describe("3. 9 Defect Categories Detection in QualityAuditor", () => {
    it("detects duplicate examples and conflicting annotations", () => {
      const ex1 = makeExample("ex_dup_1");
      const ex2 = makeExample("ex_dup_2");

      // Give both identical source hash
      ex1.provenance.source_version = "hash_identical_123";
      ex2.provenance.source_version = "hash_identical_123";

      // Give conflicting difficulty annotations
      ex1.userRequirement.targetDifficulty = "easy";
      ex2.userRequirement.targetDifficulty = "expert";

      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      dataset.addExample(ex1, "train");
      dataset.addExample(ex2, "train");

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.duplicate_examples.passed).toBe(false);
      expect(report.categorySummaries.conflicting_annotations.passed).toBe(false);
      expect(report.criticalDefectsCount).toBeGreaterThan(0);
    });

    it("detects missing fields in version metadata", () => {
      const ex = makeExample("ex_missing");
      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      const versioned = dataset.addExample(ex, "train");

      // Corrupt mandatory version metadata
      (versioned.versionMetadata as any).geometry_version = "";

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.missing_fields.passed).toBe(false);
      expect(report.allDefects.some((d) => d.category === "missing_fields")).toBe(true);
    });

    it("detects invalid geometry (degenerate vertex count / negative thickness)", () => {
      const ex = makeExample("ex_bad_geom");
      ex.pieces[0].localPolygon2D = [{ x: 0, y: 0 }, { x: 10, y: 10 }]; // only 2 points
      ex.pieces[1].designParameters.thicknessMm = -1; // negative thickness

      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      dataset.addExample(ex, "train");

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.invalid_geometry.passed).toBe(false);
    });

    it("detects invalid connections (gender conflict / invalid angle)", () => {
      const ex = makeExample("ex_bad_conn");
      // Gender conflict: both receiver
      ex.interfaces[0].genderRole = "receiver";
      ex.interfaces[1].genderRole = "receiver";
      ex.connections[0].joiningAngleDeg = 999; // impossible angle

      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      dataset.addExample(ex, "train");

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.invalid_connections.passed).toBe(false);
    });

    it("detects data leakage between train and test splits", () => {
      const exTrain = makeExample("ex_shared");
      const exTest = makeExample("ex_shared"); // exact same ID in test!

      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      dataset.addExample(exTrain, "train");
      dataset.addExample(exTest, "test");

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.data_leakage.passed).toBe(false);
      expect(report.allDefects.some((d) => d.category === "data_leakage")).toBe(true);
    });

    it("detects near-duplicate train/test examples", () => {
      // Two examples with different IDs, but identical geometry profile
      const exTrain = makeExample("ex_train_box", 100);
      const exTest = makeExample("ex_test_box", 100);

      const dataset = new DatasetVersion("audit_test", "v1.0.0");
      dataset.addExample(exTrain, "train");
      dataset.addExample(exTest, "test");

      const report = dataset.runQualityAudit();
      expect(report.categorySummaries.near_duplicate_train_test.passed).toBe(false);
      expect(report.allDefects.some((d) => d.category === "near_duplicate_train_test")).toBe(true);
    });
  });

  describe("4. 5-State Dataset Lifecycle & Approval Gates", () => {
    it("transitions through DRAFT -> REVIEW -> APPROVED -> TRAINING -> DEPRECATED", () => {
      const dataset = new DatasetVersion("puz_lifecycle", "v1.0.0");
      expect(dataset.getStatus()).toBe("DRAFT");

      // Add valid examples with different dimensions so no near-duplicate collision
      dataset.addExample(makeExample("ex_train", 100), "train");
      dataset.addExample(makeExample("ex_val", 200), "validation");
      dataset.addExample(makeExample("ex_test", 300), "test");

      dataset.submitForReview();
      expect(dataset.getStatus()).toBe("REVIEW");

      // Approve (verifies audit and locks snapshot)
      const report = dataset.approve();
      expect(report.isApprovedForTraining).toBe(true);
      expect(dataset.getStatus()).toBe("APPROVED");
      expect(dataset.isLocked()).toBe(true);

      // Promote to active training baseline
      dataset.markForTraining();
      expect(dataset.getStatus()).toBe("TRAINING");

      // Deprecate
      dataset.deprecate();
      expect(dataset.getStatus()).toBe("DEPRECATED");
    });

    it("blocks approval if dataset has active critical defects", () => {
      const dataset = new DatasetVersion("puz_bad", "v1.0.0");
      const badEx = makeExample("ex_bad");
      badEx.pieces[0].localPolygon2D = [{ x: 0, y: 0 }]; // degenerate geometry

      dataset.addExample(badEx, "train");
      dataset.submitForReview();

      expect(() => {
        dataset.approve();
      }).toThrow(DatasetApprovalBlockedError);

      expect(dataset.getStatus()).toBe("REVIEW");
    });
  });

  describe("5. Dataset Diff Engine", () => {
    it("computes deep differences between two dataset releases", () => {
      const ex1 = makeExample("ex_01", 100);
      const ex2 = makeExample("ex_02", 150);
      const ex3 = makeExample("ex_03", 200);

      const v1 = new DatasetVersion("puzzle_lib", "v1.0.0");
      v1.addExample(ex1, "train");
      v1.addExample(ex2, "validation");

      const v2 = new DatasetVersion("puzzle_lib", "v2.0.0");
      // Modified ex1 width
      const ex1Modified = makeExample("ex_01", 110);
      v2.addExample(ex1Modified, "train");
      // Added ex3, removed ex2
      v2.addExample(ex3, "test");

      const diff = DatasetDiffEngine.computeDiff(
        "v1.0.0",
        "v2.0.0",
        v1.getExamples(),
        v2.getExamples(),
        "APPROVED",
        "DRAFT"
      );

      expect(diff.baseVersion).toBe("v1.0.0");
      expect(diff.targetVersion).toBe("v2.0.0");
      expect(diff.statusChange?.from).toBe("APPROVED");
      expect(diff.statusChange?.to).toBe("DRAFT");
      expect(diff.addedExamples).toContain("ex_03");
      expect(diff.removedExamples).toContain("ex_02");
      expect(diff.modifiedExamples.length).toBe(1);
      expect(diff.modifiedExamples[0].exampleId).toBe("ex_01");
      expect(diff.modifiedExamples[0].changedAspects).toContain("parameters");
    });
  });
});
