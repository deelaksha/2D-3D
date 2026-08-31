/**
 * Assembly validation — the "is this puzzle actually solved?" pass.
 *
 * Scans the whole project (pure function, no store, no side effects) and
 * answers two related questions:
 *  - connectorStatuses(): for every connector, is it joined in 3D, does a
 *    compatible partner exist anywhere in the project but hasn't been joined
 *    yet, or is it a true orphan with nothing to mate with?
 *  - validateAssembly(): the same information rolled up into a
 *    ValidationReport of user-facing issues (orphan connectors, type
 *    mismatches on realized connections, duplicate connections, a connector
 *    reused across more than one connection, and mated parts that have
 *    drifted apart from their expected snap position).
 */
import type {
  Connection,
  Connector,
  IssueLevel,
  Part,
  Placement,
  Project,
  ValidationIssue,
  ValidationReport,
  Vec3,
} from "@/core/model/types";
import { checkCompatibility, type CompatResult } from "@/core/connectors/compat";
import { mateRotationZ, mateTargetXY } from "@/core/connectors/mate";

/** How far (mm) / how many degrees a mated part may drift from its expected
 * snap transform before it's flagged as misaligned. Generous enough to absorb
 * integer rounding from placePart(), tight enough to catch a real manual drag. */
const MISALIGN_POSITION_MM = 3;
const MISALIGN_ROTATION_DEG = 2;

export type ConnectorJoinState = "joined" | "paired" | "unmatched";

export interface ConnectorStatus {
  partId: string;
  partName: string;
  connectorId: string;
  connectorName: string;
  state: ConnectorJoinState;
  /** Human-readable reason, e.g. what it's matched with or why it's unmatched. */
  detail: string;
}

export interface PartConnectorSummary {
  partId: string;
  partName: string;
  connectors: ConnectorStatus[];
}

interface Located {
  part: Part;
  connector: Connector;
}

function locate(project: Project, connectorId: string): Located | null {
  for (const part of project.parts) {
    const connector = part.connectors.find((c) => c.id === connectorId);
    if (connector) return { part, connector };
  }
  return null;
}

/** The single best-scoring candidate partner for `c`, among every other
 * connector in the project (any part). Null when the project has nothing
 * else to compare against (e.g. a lone part). */
function bestCandidate(
  project: Project,
  part: Part,
  c: Connector,
): { part: Part; connector: Connector; result: CompatResult } | null {
  let best: { part: Part; connector: Connector; result: CompatResult } | null = null;
  for (const otherPart of project.parts) {
    for (const other of otherPart.connectors) {
      if (other.id === c.id) continue;
      const result = checkCompatibility({ part, connector: c }, { part: otherPart, connector: other });
      if (!best || result.score > best.result.score) {
        best = { part: otherPart, connector: other, result };
      }
    }
  }
  return best;
}

/** Per-connector join state across the whole project. */
export function connectorStatuses(project: Project): ConnectorStatus[] {
  const out: ConnectorStatus[] = [];
  for (const part of project.parts) {
    for (const c of part.connectors) {
      const joinedCnx = project.assembly.connections.find(
        (cnx) => cnx.sourceConnector === c.id || cnx.targetConnector === c.id,
      );
      if (joinedCnx) {
        out.push({
          partId: part.id,
          partName: part.name,
          connectorId: c.id,
          connectorName: c.name,
          state: "joined",
          detail: joinedCnx.reason || "Connected in the 3D assembly.",
        });
        continue;
      }

      const best = bestCandidate(project, part, c);
      if (best && best.result.status !== "invalid") {
        out.push({
          partId: part.id,
          partName: part.name,
          connectorId: c.id,
          connectorName: c.name,
          state: "paired",
          detail: `Matches ${best.part.name} · ${best.connector.name} — not joined in 3D yet.`,
        });
      } else {
        out.push({
          partId: part.id,
          partName: part.name,
          connectorId: c.id,
          connectorName: c.name,
          state: "unmatched",
          detail: best
            ? `Closest candidate is ${best.part.name} · ${best.connector.name}, but ${best.result.reason}`
            : `No other part defines a matching connector for this ${c.type} yet.`,
        });
      }
    }
  }
  return out;
}

/** connectorStatuses(), grouped by part — the shape the "✓ G1 / ⚠ G3" checklist UI wants. */
export function partConnectorSummaries(project: Project): PartConnectorSummary[] {
  const statuses = connectorStatuses(project);
  return project.parts
    .filter((p) => p.connectors.length > 0)
    .map((p) => ({
      partId: p.id,
      partName: p.name,
      connectors: statuses.filter((s) => s.partId === p.id),
    }));
}

/**
 * Candidate mating transforms — actions.ts connectPortPair and build3d.ts
 * calculateMatingTransform share the same orientation math (core/connectors/
 * mate.ts) but still differ slightly in Z placement (thickness offset,
 * perpendicular X rotation for wall-on-base joins). Rather than pick one as
 * "correct" and duplicate-import the three.js-bearing module, this returns
 * every transform a legitimate auto-mate could have produced; a real drift
 * check accepts a match against ANY of them.
 */
function expectedMateCandidates(
  sourcePart: Part,
  sourceConn: Connector,
  targetPart: Part,
  targetConn: Connector,
  sourcePlacement?: Placement,
): { position: Vec3; rotation: Vec3 }[] {
  const sourcePos = sourcePlacement?.position ?? { x: sourcePart.transform.x, y: -sourcePart.transform.y, z: 0 };
  const sourceRot = sourcePlacement?.rotation ?? { x: 0, y: 0, z: sourcePart.transform.rotation };

  const targetRotZ = mateRotationZ(sourceRot.z, sourceConn.orientation, targetConn.orientation);
  const targetXY = mateTargetXY(sourcePos, sourceRot.z, sourceConn.position, targetRotZ, targetConn.position);
  const flatZ = sourcePos.z;
  const stackedZ = sourcePos.z + sourcePart.thickness;

  return [
    { position: { x: targetXY.x, y: targetXY.y, z: flatZ }, rotation: { x: sourceRot.x, y: sourceRot.y, z: targetRotZ } },
    { position: { x: targetXY.x, y: targetXY.y, z: stackedZ }, rotation: { x: 90, y: sourceRot.y, z: targetRotZ } },
    { position: { x: targetXY.x, y: targetXY.y, z: stackedZ }, rotation: { x: sourceRot.x, y: sourceRot.y, z: targetRotZ } },
  ];
}

/** Shortest distance (degrees) between two angles, wraparound-safe. */
function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function connectionLabel(project: Project, cnx: Connection): string {
  const src = locate(project, cnx.sourceConnector);
  const tgt = locate(project, cnx.targetConnector);
  const srcLabel = src ? `${src.part.name} · ${src.connector.name}` : "an unknown connector";
  const tgtLabel = tgt ? `${tgt.part.name} · ${tgt.connector.name}` : "an unknown connector";
  return `${srcLabel} ↔ ${tgtLabel}`;
}

function aggregateLevel(issues: ValidationIssue[]): IssueLevel {
  if (issues.some((i) => i.level === "error")) return "error";
  if (issues.some((i) => i.level === "warning")) return "warning";
  return "ok";
}

/** Full assembly validation pass. Pure — safe to call on every render. */
export function validateAssembly(project: Project): ValidationReport {
  const issues: ValidationIssue[] = [];

  // 1. Orphan connectors: no receiver/connector anywhere in the project.
  for (const s of connectorStatuses(project)) {
    if (s.state === "unmatched") {
      issues.push({
        level: "warning",
        code: "connector-unmatched",
        message: `${s.partName} · ${s.connectorName} has no matching connector or receiver yet.`,
        refs: [s.connectorId, s.partId],
      });
    }
  }

  // 2. Parts with no connectors at all (only meaningful once there's more than one part).
  if (project.parts.length > 1) {
    for (const p of project.parts) {
      if (p.connectors.length === 0) {
        issues.push({
          level: "warning",
          code: "part-no-connectors",
          message: `${p.name} has no connectors defined yet, so it can't join the assembly.`,
          refs: [p.id],
        });
      }
    }
  }

  // 3. Realized connections: type/pattern/size mismatches, and duplicates.
  const seenPairs = new Map<string, Connection[]>();
  for (const cnx of project.assembly.connections) {
    const key = pairKey(cnx.sourceConnector, cnx.targetConnector);
    seenPairs.set(key, [...(seenPairs.get(key) ?? []), cnx]);

    const src = locate(project, cnx.sourceConnector);
    const tgt = locate(project, cnx.targetConnector);
    if (!src || !tgt) {
      issues.push({
        level: "error",
        code: "connection-dangling",
        message: `A saved connection points at a connector that no longer exists.`,
        refs: [cnx.id],
      });
      continue;
    }

    const result = checkCompatibility({ part: src.part, connector: src.connector }, { part: tgt.part, connector: tgt.connector });
    if (result.status === "invalid") {
      issues.push({
        level: "error",
        code: "connection-invalid",
        message: `${connectionLabel(project, cnx)}: ${result.reason}`,
        refs: [cnx.id, src.connector.id, tgt.connector.id, src.part.id, tgt.part.id],
      });
    } else if (result.status === "possible") {
      issues.push({
        level: "warning",
        code: "connection-loose",
        message: `${connectionLabel(project, cnx)}: ${result.reason}`,
        refs: [cnx.id, src.connector.id, tgt.connector.id, src.part.id, tgt.part.id],
      });
    }

    // 4. Alignment: if both parts are placed in 3D, the target should sit
    // exactly where the connector geometry expects it to. A gap means the
    // user dragged one part away from its mate after joining.
    const srcPl = project.assembly.placements.find((pl) => pl.partId === src.part.id);
    const tgtPl = project.assembly.placements.find((pl) => pl.partId === tgt.part.id);
    if (srcPl?.placed && tgtPl?.placed) {
      const candidates = expectedMateCandidates(src.part, src.connector, tgt.part, tgt.connector, srcPl);
      let bestPosError = Infinity;
      let bestRotError = Infinity;
      let anyCandidateAligned = false;
      for (const expected of candidates) {
        const dx = expected.position.x - tgtPl.position.x;
        const dy = expected.position.y - tgtPl.position.y;
        const dz = expected.position.z - tgtPl.position.z;
        const posError = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rotError = angleDelta(expected.rotation.z, tgtPl.rotation.z);
        if (posError <= MISALIGN_POSITION_MM && rotError <= MISALIGN_ROTATION_DEG) anyCandidateAligned = true;
        if (posError < bestPosError) {
          bestPosError = posError;
          bestRotError = rotError;
        }
      }
      if (!anyCandidateAligned) {
        issues.push({
          level: "warning",
          code: "connection-misaligned",
          message: `${connectionLabel(project, cnx)} is connected but the parts have drifted apart (off by ~${Math.round(bestPosError)}mm). Use "Snap & connect pair" to re-align them.`,
          refs: [cnx.id, src.part.id, tgt.part.id],
        });
      }
    }
  }

  for (const [, group] of seenPairs) {
    if (group.length > 1) {
      const [first] = group;
      issues.push({
        level: "warning",
        code: "connection-duplicate",
        message: `${connectionLabel(project, first)} is connected ${group.length} times — remove the extra connection.`,
        refs: group.map((c) => c.id),
      });
    }
  }

  // 5. A connector reused across more than one connection (each physical
  // feature should generally mate with exactly one partner).
  const usage = new Map<string, number>();
  for (const cnx of project.assembly.connections) {
    usage.set(cnx.sourceConnector, (usage.get(cnx.sourceConnector) ?? 0) + 1);
    usage.set(cnx.targetConnector, (usage.get(cnx.targetConnector) ?? 0) + 1);
  }
  for (const [connectorId, count] of usage) {
    if (count > 1) {
      const found = locate(project, connectorId);
      if (found) {
        issues.push({
          level: "warning",
          code: "connector-overused",
          message: `${found.part.name} · ${found.connector.name} is used in ${count} connections at once — check this is intended.`,
          refs: [connectorId, found.part.id],
        });
      }
    }
  }

  return { level: aggregateLevel(issues), issues };
}
