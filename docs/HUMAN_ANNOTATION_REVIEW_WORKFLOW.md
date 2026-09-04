# Human-in-the-Loop Annotation & Review Workflow (Phase 62)

## 1. Objective & Operational Scope

Phase 62 establishes the **Human-in-the-Loop (HITL) Annotation and Review Subsystem** for verifying machine-extracted puzzle models before they become trusted ML training data.

Machine-extracted designs (from DXF, SVG, CAD, raster drawings, or JSON ingested in Phase 61) may contain ambiguities, loose tolerances, non-standard joint orientations, or missing scale calibrations. The review workflow provides a rigorous human verification gate, enabling human reviewers to inspect, edit, and certify design models while strictly preserving the immutability of the original machine-extracted data.

---

## 2. The 11 Inspection Domains

Human reviewers can comprehensively inspect all 11 domains of an ingested puzzle example:

| Domain | Scope | Inspected Attributes |
| :--- | :--- | :--- |
| **1. Source Drawing** | Raw File Provenance | Original file name, SHA-256 hash, byte size, detected format, relative drawing path. |
| **2. Pieces** | Piece List & Hierarchy | Piece IDs, human-readable names, stock material ID, vertex counts. |
| **3. Piece Boundaries** | 2D Planar Contours | 2D polygon vertices in piece-local space, planar surface area (mm²), perimeter (mm), closure flag. |
| **4. Interfaces** | Edge Port Definitions | Port IDs, owning piece IDs, interface types (`tab`, `slot`, `finger`, `dovetail`), gender roles (`insert`, `receiver`, `neutral`), profile width, profile depth, normal vectors. |
| **5. Connection Graph** | Topological Kinematics | Graph nodes, edges, connected components count, full reachability status, and incident joint angles. |
| **6. Dimensions** | Physical Sizes | Width (mm), height (mm), stock material thickness (mm), laser kerf compensation (mm). |
| **7. Parametric Features** | Extracted Parameters | Linear dimensions, edge offsets, tab widths, slot depths, cutout coordinates. |
| **8. Material Constraints** | Stock Specifications | Sheet bounds (width x height), stock thickness, cardboard fluting/grain angle, density, kerf. |
| **9. 3D Reconstruction** | Local Solid 3D | 3D bounding boxes ($x, y, z \in [-T/2, +T/2]$), volume estimate (mm³), extruded mesh bounds. |
| **10. Assembly Transforms** | 3D Spatial Placements | Rigid transforms ($x, y, z$ positions, quaternion $q_x, q_y, q_z, q_w$), step-by-step assembly sequence. |
| **11. Validation Results** | Physical Feasibility | Structural, geometric, connection, manufacturing, and assembly validation reports, failure codes, and review warnings. |

---

## 3. The 9 Editable Targets

Reviewers can make precise modifications across 9 targets without modifying original source data:

| Target | Description | Cascading Effect / Validation |
| :--- | :--- | :--- |
| `piece_boundary` | Updates 2D boundary polygon coordinates. | Recomputes surface area and checks for non-zero area and ≥ 3 vertices. |
| `piece_id` | Renames a piece ID. | Cascades renames across owning interfaces, connections, 3D bounds, and assembly transforms. |
| `interface_id` | Renames an interface port ID. | Cascades renames across connections and owning piece interface lists. |
| `interface_type` | Updates interface type & gender role. | Verifies complementary gender matching on connected joints. |
| `connection_relationship` | Reconfigures connected interfaces. | Re-evaluates assembly graph connectivity and port pairing. |
| `parameter` | Edits width, height, thickness, or tab/slot dimensions. | Validates positive dimensions ($> 0.1\text{ mm}$). |
| `assembly_transform` | Adjusts 3D spatial position or quaternion rotation. | Updates kinematic placements in assembly sequence. |
| `allowed_angle` | Sets joint joining angle (e.g. 0°, 30°, 45°, 60°, 90°). | Validates angle range ($-360^\circ \text{ to } 360^\circ$). |
| `constraint` | Adds or modifies physical constraints. | Updates declarative constraint rulebook. |

---

## 4. Event Sourcing & Original Data Immutability

> [!IMPORTANT]
> **Zero Data Overwrite Guarantee**:
> `session.originalExample` represents an immutable snapshot of the raw machine-extracted model and is **never modified**.
> All human edits are applied exclusively to `session.currentExample` (the working draft).

Every single manual edit generates an immutable `AnnotationEvent`:

```typescript
export interface AnnotationEvent {
  eventId: string;           // Unique event ID (e.g. evt_1725492834_12345)
  timestamp: string;         // ISO 8601 UTC timestamp
  reviewerId: string;        // Reviewer username or ID
  target: ReviewEditableTarget; // One of the 9 editable targets
  targetId: string;          // Target entity identifier
  oldValue: unknown;         // Previous value before edit
  newValue: unknown;         // New value after edit
  reason: string;            // Human reviewer explanation
  validationSummary?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}
```

---

## 5. The 5 Annotation Lifecycle States

```
UNREVIEWED ──> IN_REVIEW ──┬──> APPROVED (Trusted Training Data)
                           ├──> REJECTED (Excluded)
                           └──> NEEDS_CORRECTION ──> IN_REVIEW
```

| State | Description | ML Eligibility |
| :--- | :--- | :--- |
| `UNREVIEWED` | Ingested by the pipeline; pending human triage. | Excluded from training. |
| `IN_REVIEW` | Checked out by a reviewer; actively being inspected or edited. | Excluded from training. |
| `NEEDS_CORRECTION` | Reviewer flagged defects that require further geometry or connection correction. | Excluded from training. |
| `REJECTED` | Defective, corrupted, or physically impossible design discarded by reviewer. | Excluded from training. |
| `APPROVED` | Verified by reviewer AND certified by reviewer-independent validation. | **Eligible for ML Training Splits**. |

---

## 6. Reviewer-Independent Validation Safety Gate

Human reviewers are prone to typos, such as inputting degenerate boundary polygons (e.g. 2 vertices instead of a closed loop) or leaving dangling interface references.

To protect training data against human error, the system executes **Reviewer-Independent Validation** (`ReviewerIndependentValidator`) on the working draft:

1. **Automatic Trigger**: Executes synchronously after every edit and prior to any state transition.
2. **Strict Approval Gate**:
   ```typescript
   if (newState === "APPROVED") {
     const val = ReviewerIndependentValidator.validate(session.currentExample);
     if (!val.isValid || val.errors.length > 0) {
       throw new ApprovalBlockedError(
         `Cannot approve example with active validation errors: ${val.errors.join("; ")}`
       );
     }
   }
   ```
   **An example CANNOT be marked `APPROVED` if independent physical validation detects errors.**

---

## 7. Example Workflow Usage

```typescript
import { ReviewSessionManager, AnnotationEditor } from "@/core/puzzle/review";
import { RealDataIngestionPipeline } from "@/core/puzzle/realdata";

// 1. Ingest real design file (Phase 61)
const ingestion = RealDataIngestionPipeline.ingestFile({
  filename: "desk_organizer.dxf",
  content: dxfText,
});

// 2. Initialize human review session (Phase 62)
const manager = new ReviewSessionManager();
const session = manager.createSession(ingestion.datasetExample!, "reviewer_alice");

// 3. Inspect all 11 domains
const snapshot = manager.inspectSession(session.sessionId);
console.log("Pieces:", snapshot.pieces);
console.log("Boundary Area:", snapshot.pieceBoundaries["part_base"].area);

// 4. Perform human correction (e.g. adjust thickness)
AnnotationEditor.editParameter(
  session,
  "part_base",
  "thicknessMm",
  3.2,
  "reviewer_alice",
  "Measured stock caliper thickness 3.2mm"
);

// 5. Approve for ML pipeline (enforcing independent validation)
manager.transitionState(session.sessionId, "APPROVED", "reviewer_alice", "Certified clean geometry.");

console.log("Session status:", session.state); // "APPROVED"
console.log("Approved by:", session.approvalAudit?.approvedBy); // "reviewer_alice"
console.log("Audit event count:", session.history.length); // 1
```
