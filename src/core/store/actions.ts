/**
 * Semantic, undoable actions over the project. UI components and tools call
 * these instead of mutating state directly, so every change is labelled and
 * reversible. Selection/camera helpers wrap store.setUI (non-undoable).
 */
import { store } from "./store";
import { uid } from "../model/ids";
import {
  identityTransform,
  makeConnector,
  makePart,
  makeShape,
} from "../model/defaults";
import { connectorFeature, connectorRole, defaultRole } from "../connectors/feature";
import { complementType } from "../connectors/compat";
import type {
  BooleanOp,
  Connection,
  ConnectionStatus,
  Connector,
  ConnectorRole,
  ConnectorType,
  Constraint,
  Dimension,
  Material,
  Part,
  PartGroup,
  Placement,
  Shape,
  Vec2,
  Vec3,
} from "../model/types";

/* ---- lookup helpers (pure) ---------------------------------------- */

export const findPart = (id: string): Part | undefined =>
  store.getState().project.parts.find((p) => p.id === id);

export const findConnector = (id: string): Connector | undefined => {
  for (const p of store.getState().project.parts) {
    const c = p.connectors.find((c) => c.id === id);
    if (c) return c;
  }
  return undefined;
};

/* ---- parts -------------------------------------------------------- */

export function createPart(name: string, opts: Partial<Part> = {}): string {
  const project = store.getState().project;
  const materialId = opts.materialId ?? project.materials[0]?.id ?? "";
  const part = makePart(name, materialId, opts);
  store.commit(`Create ${name}`, (d) => {
    d.parts.push(part);
    d.assembly.placements.push({
      partId: part.id,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      placed: false,
    });
  });
  return part.id;
}

export function addPart(part: Part): void {
  store.commit(`Add ${part.name}`, (d) => {
    d.parts.push(part);
    d.assembly.placements.push({
      partId: part.id,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      placed: false,
    });
  });
}

export function updatePart(id: string, patch: Partial<Part>, label = "Edit part"): void {
  store.commit(label, (d) => {
    const p = d.parts.find((p) => p.id === id);
    if (p) Object.assign(p, patch);
  });
}

export function updatePartTransform(
  id: string,
  patch: Partial<Part["transform"]>,
  label = "Move part",
): void {
  store.commit(label, (d) => {
    const p = d.parts.find((p) => p.id === id);
    if (p) p.transform = { ...p.transform, ...patch };
  });
}

/**
 * Apply transform patches to MANY parts in a SINGLE commit. Used by canvas drags
 * so moving an N-part selection is one document clone + one render per frame,
 * not N (which would thrash at large selections / part counts).
 */
export function updatePartsTransform(
  updates: { id: string; patch: Partial<Part["transform"]> }[],
  label = "Move part",
): void {
  if (updates.length === 0) return;
  store.commit(label, (d) => {
    for (const u of updates) {
      const p = d.parts.find((p) => p.id === u.id);
      if (p) p.transform = { ...p.transform, ...u.patch };
    }
  });
}

export function renamePart(id: string, name: string): void {
  updatePart(id, { name }, "Rename part");
}

export function setPartVisibility(id: string, visible: boolean): void {
  updatePart(id, { visible }, visible ? "Show part" : "Hide part");
}

export function setPartLock(id: string, locked: boolean): void {
  updatePart(id, { locked }, locked ? "Lock part" : "Unlock part");
}

export function setPartMaterial(id: string, materialId: string): void {
  updatePart(id, { materialId }, "Change material");
}

export function deleteParts(ids: string[], force = false): void {
  // Bulk/keyboard delete skips locked parts (consistent with move/nudge/marquee);
  // the explicit per-row ✕ button passes force=true to override.
  let targets = ids;
  if (!force) {
    const locked = new Set(store.getState().project.parts.filter((p) => p.locked).map((p) => p.id));
    targets = ids.filter((id) => !locked.has(id));
  }
  if (targets.length === 0) return;
  const set = new Set(targets);
  store.commit(targets.length > 1 ? "Delete parts" : "Delete part", (d) => {
    d.parts = d.parts.filter((p) => !set.has(p.id));
    d.assembly.placements = d.assembly.placements.filter((pl) => !set.has(pl.partId));
    d.assembly.connections = d.assembly.connections.filter(
      (c) => !set.has(c.sourcePart) && !set.has(c.targetPart),
    );
  });
  store.setUI((ui) => ({
    selection: ui.selection.filter((s) => !set.has(s)),
    activePartId: ui.activePartId && set.has(ui.activePartId) ? null : ui.activePartId,
  }));
}

export function deletePart(id: string): void {
  deleteParts([id], true); // explicit per-row delete overrides the lock
}

export function duplicatePart(id: string): string | null {
  const src = findPart(id);
  if (!src) return null;
  const copy: Part = JSON.parse(JSON.stringify(src));
  copy.id = uid("part");
  copy.name = `${src.name} copy`;
  copy.order = src.order + 0.5;
  copy.transform = { ...src.transform, x: src.transform.x + 20, y: src.transform.y + 20 };
  copy.connectors = copy.connectors.map((c) => ({ ...c, id: uid("con"), partId: copy.id }));
  copy.modifiers = copy.modifiers.map((m) => ({ ...m, id: uid("mod") }));
  addPart(copy);
  return copy.id;
}

/* ---- clipboard + selection commands (keyboard shortcuts) ---------- */

/** In-memory clipboard of copied parts (serialized snapshots). */
let clipboard: Part[] = [];
/** Successive pastes cascade so copies don't stack exactly on top of each other. */
let pasteCount = 0;

/** Copy the current selection (or given ids) into the in-memory clipboard. */
export function copySelection(ids?: string[]): void {
  const sel = ids ?? store.getState().ui.selection;
  const parts = store.getState().project.parts.filter((p) => sel.includes(p.id));
  if (parts.length) {
    clipboard = JSON.parse(JSON.stringify(parts));
    pasteCount = 0; // reset cascade on a fresh copy
  }
}

/** Paste clipboard parts (cascading offset + fresh ids) as ONE undo step, then select them. */
export function pasteClipboard(): void {
  if (clipboard.length === 0) return;
  pasteCount++;
  const off = 20 * pasteCount; // step each paste diagonally so they don't overlap
  store.beginGesture();
  const newIds: string[] = [];
  for (const src of clipboard) {
    const copy: Part = JSON.parse(JSON.stringify(src));
    copy.id = uid("part");
    copy.name = `${src.name} copy`;
    copy.order = (src.order ?? 0) + 0.5;
    copy.transform = { ...src.transform, x: src.transform.x + off, y: src.transform.y + off };
    copy.connectors = copy.connectors.map((c) => ({ ...c, id: uid("con"), partId: copy.id }));
    copy.modifiers = copy.modifiers.map((m) => ({ ...m, id: uid("mod") }));
    addPart(copy);
    newIds.push(copy.id);
  }
  store.endGesture(newIds.length > 1 ? "Paste parts" : "Paste part");
  if (newIds.length) select(newIds);
}

/** Cut = copy + delete (skipping locked parts), as one undo step. */
export function cutSelection(ids?: string[]): void {
  const sel = ids ?? store.getState().ui.selection;
  const locked = new Set(store.getState().project.parts.filter((p) => p.locked).map((p) => p.id));
  const targets = sel.filter((id) => !locked.has(id));
  if (targets.length === 0) return;
  store.beginGesture();
  copySelection(targets);
  deleteParts(targets);
  store.endGesture(targets.length > 1 ? "Cut parts" : "Cut part");
}

/** Duplicate every selected part in place as ONE undo step; select the copies. */
export function duplicateSelection(ids?: string[]): void {
  const sel = ids ?? store.getState().ui.selection;
  if (sel.length === 0) return;
  store.beginGesture();
  const copies: string[] = [];
  for (const id of sel) {
    const nid = duplicatePart(id);
    if (nid) copies.push(nid);
  }
  store.endGesture(copies.length > 1 ? "Duplicate parts" : "Duplicate part");
  if (copies.length) select(copies);
}

/** Select every visible, unlocked part. */
export function selectAll(): void {
  const ids = store
    .getState()
    .project.parts.filter((p) => p.visible && !p.locked)
    .map((p) => p.id);
  if (ids.length) select(ids);
}

/** Nudge the selected parts by (dx,dy) mm as one undo step. */
export function nudgeSelection(dx: number, dy: number, ids?: string[]): void {
  const sel = ids ?? store.getState().ui.selection;
  if (sel.length === 0) return;
  store.beginGesture();
  for (const id of sel) {
    const p = findPart(id);
    if (!p || p.locked) continue;
    updatePartTransform(id, { x: p.transform.x + dx, y: p.transform.y + dy }, "Nudge");
  }
  store.endGesture("Nudge");
}

/** Reorder: place `id` immediately before/after `targetId` in tree order. */
export function reorderPart(id: string, targetOrder: number): void {
  updatePart(id, { order: targetOrder }, "Reorder");
}

/* ---- shape + modifiers (holes / slots / tabs) --------------------- */

/** Smallest allowed physical dimension in mm (parts can't be zero/negative). */
export const MIN_DIM_MM = 0.1;

export function setPartShape(id: string, patch: Partial<Shape>): void {
  const clean = { ...patch };
  if (clean.width != null) clean.width = Math.max(MIN_DIM_MM, clean.width);
  if (clean.height != null) clean.height = Math.max(MIN_DIM_MM, clean.height);
  store.commit("Edit shape", (d) => {
    const p = d.parts.find((p) => p.id === id);
    if (p) {
      p.shape = { ...p.shape, ...clean };
      if (clean.width != null) p.width = clean.width;
      if (clean.height != null) p.height = clean.height;
    }
  });
}

export function addModifier(
  partId: string,
  op: BooleanOp,
  shape: Shape,
  name?: string,
): string {
  const modId = uid("mod");
  store.commit(name ?? `Add ${op}`, (d) => {
    const p = d.parts.find((p) => p.id === partId);
    if (p) p.modifiers.push({ id: modId, op, shape, name });
  });
  return modId;
}

/** Convenience: cut a hole (subtract) into a part at a local position. */
export function addHole(partId: string, position: Vec2, diameter = 10): string {
  const shape = makeShape("circle", {
    x: position.x - diameter / 2,
    y: position.y - diameter / 2,
    width: diameter,
    height: diameter,
  });
  return addModifier(partId, "subtract", shape, "hole");
}

export function updateModifier(partId: string, modId: string, patch: Partial<{ op: BooleanOp; shape: Shape; name: string }>): void {
  store.commit("Edit cutout", (d) => {
    const p = d.parts.find((p) => p.id === partId);
    const m = p?.modifiers.find((m) => m.id === modId);
    if (m) Object.assign(m, patch);
  });
}

export function deleteModifier(partId: string, modId: string): void {
  store.commit("Delete cutout", (d) => {
    const p = d.parts.find((p) => p.id === partId);
    if (p) p.modifiers = p.modifiers.filter((m) => m.id !== modId);
  });
}

/* ---- connectors --------------------------------------------------- */

/**
 * Sync a connector's board geometry (its plug/socket) onto its part. Removes the
 * connector's previous feature modifier and re-adds the current one (or none, for
 * a neutral connector). Runs inside a commit recipe (mutates the draft part).
 */
function syncConnectorFeature(p: Part, c: Connector): void {
  p.modifiers = p.modifiers.filter((m) => m.connectorId !== c.id);
  const feat = connectorFeature(c);
  if (feat) {
    p.modifiers.push({
      id: uid("mod"),
      op: feat.op,
      shape: feat.shape,
      name: `${c.name} (${connectorRole(c)})`,
      connectorId: c.id,
    });
  }
}

export function addConnector(
  partId: string,
  type: ConnectorType,
  position: Vec2,
  overrides: Partial<Connector> = {},
): string {
  const c = makeConnector(partId, type, position, overrides);
  if (c.role == null) c.role = defaultRole(type); // male/female from the type's family
  store.commit(`Add ${type}`, (d) => {
    const p = d.parts.find((p) => p.id === partId);
    if (p) {
      p.connectors.push(c);
      syncConnectorFeature(p, c); // cut a socket / add a plug
    }
  });
  return c.id;
}

export function updateConnector(connectorId: string, patch: Partial<Connector>, label = "Edit connector"): void {
  store.commit(label, (d) => {
    for (const p of d.parts) {
      const c = p.connectors.find((c) => c.id === connectorId);
      if (c) {
        Object.assign(c, patch);
        syncConnectorFeature(p, c); // keep the plug/socket in sync with edits
        return;
      }
    }
  });
}

export function renameConnector(connectorId: string, name: string): void {
  updateConnector(connectorId, { name }, "Rename connector");
}

/** Flip a connector between Insert (plug), Receiver (socket), and Neutral. */
export function setConnectorRole(connectorId: string, role: ConnectorRole): void {
  updateConnector(connectorId, { role }, `Set connector to ${role}`);
}

/** Change custom joint shape pattern (standard, dovetail, puzzle, tslot, teeth, wave). */
export function setConnectorPattern(connectorId: string, pattern: import("../model/types").ConnectorPattern): void {
  updateConnector(connectorId, { pattern }, `Set connector pattern to ${pattern}`);
}

/** Toggle opposite / inverted (negative) polarity mode on a connector. */
export function setConnectorInverted(connectorId: string, inverted: boolean): void {
  updateConnector(connectorId, { inverted }, inverted ? "Set connector to Inverted (Negative) mode" : "Set connector to Normal mode");
}

/** Set custom connector/receiver type name. */
export function setConnectorCustomType(connectorId: string, customTypeName: string): void {
  updateConnector(connectorId, { customTypeName }, `Set custom connector type to ${customTypeName}`);
}

/** Rotate connector orientation angle (degrees CW). */
export function rotateConnector(connectorId: string, angleDeltaDeg: number): void {
  const found = findConnector(connectorId);
  if (!found) return;
  const newAngle = ((found.orientation + angleDeltaDeg) % 360 + 360) % 360;
  updateConnector(connectorId, { orientation: newAngle }, `Rotate connector to ${newAngle}°`);
}


/** Locate a connector and its owning part. */
function locateConnector(id: string): { part: Part; connector: Connector } | null {
  for (const p of store.getState().project.parts) {
    const c = p.connectors.find((c) => c.id === id);
    if (c) return { part: p, connector: c };
  }
  return null;
}

/**
 * Turn a connector into its OPPOSITE in place — the mating counterpart type +
 * role (Tab⇄Slot, Peg⇄Hole, an insert plug becomes the socket it fills, etc.).
 * The board geometry (plug/socket) is regenerated automatically.
 */
export function invertConnector(connectorId: string): void {
  const found = locateConnector(connectorId);
  if (!found) return;
  const from = found.connector.type;
  const to = complementType(from);
  updateConnector(connectorId, { type: to, role: defaultRole(to) }, `Flip ${from} → ${to}`);
}

/**
 * Create the matching counterpart of a connector — a NEW connector of the
 * complementary type/role, offset next to the original and cross-linked as
 * compatible, then selected. Lets you design a plug and its socket together.
 */
export function createComplementConnector(connectorId: string): string | null {
  const found = locateConnector(connectorId);
  if (!found) return null;
  const { part, connector: src } = found;
  const to = complementType(src.type);
  store.beginGesture();
  const newId = addConnector(part.id, to, { x: src.position.x + 28, y: src.position.y }, {
    name: `${src.name} (mate)`,
    role: defaultRole(to),
    orientation: src.orientation,
    width: src.width,
    height: src.height,
    depth: src.depth,
    diameter: src.diameter,
    tolerance: src.tolerance,
    compatibleWith: [src.id],
  });
  // cross-link the original so both know they mate
  updateConnector(src.id, { compatibleWith: [...(src.compatibleWith ?? []), newId] }, "Link connectors");
  store.endGesture(`Add matching ${to}`);
  selectConnector(newId);
  return newId;
}

/** Auto-generate a clean, intuitive port label (e.g. "Port A1", "Port A2", "Port B1"). */
export function generateNextPortLabel(project: import("../model/types").Project): string {
  let count = 1;
  for (const p of project.parts) {
    for (const c of p.connectors) {
      if (c.name.startsWith("Port ")) {
        count++;
      }
    }
  }
  const index = Math.floor((count - 1) / 2) + 1;
  const letter = String.fromCharCode(65 + Math.floor((index - 1) / 9));
  const num = ((index - 1) % 9) + 1;
  return `Port ${letter}${num}`;
}

/**
 * Creates a matched Connector (Plug) and Receiver (Socket) pair with exact matching dimensions.
 */
export function createPortPair(
  sourcePartId: string,
  targetPartId?: string,
  type: ConnectorType = "tab",
  overrides?: Partial<Connector>
): { plugId: string; receiverId: string } | null {
  const project = store.getState().project;
  const sourcePart = project.parts.find((p) => p.id === sourcePartId);
  if (!sourcePart) return null;

  const targetPart =
    (targetPartId ? project.parts.find((p) => p.id === targetPartId) : null) ||
    project.parts.find((p) => p.id !== sourcePartId) ||
    sourcePart;

  const label = generateNextPortLabel(project);
  const recType = complementType(type);

  store.beginGesture();

  // 1. Create Plug (Connector)
  const plugPos = { x: Math.round(sourcePart.shape.width / 2), y: 0 };
  const plugId = addConnector(sourcePart.id, type, plugPos, {
    name: `${label} (Plug)`,
    role: "insert",
    width: 12,
    height: 4,
    depth: sourcePart.thickness,
    tolerance: 0.2,
    ...overrides,
  });

  // 2. Create Receiver (Socket) with EXACT matching dimensions
  const recPos = { x: Math.round(targetPart.shape.width / 2), y: 0 };
  const receiverId = addConnector(targetPart.id, recType, recPos, {
    name: `${label} (Receiver)`,
    role: "receiver",
    width: overrides?.width ?? 12,
    height: overrides?.height ?? 4,
    depth: targetPart.thickness,
    tolerance: overrides?.tolerance ?? 0.2,
    diameter: overrides?.diameter,
    pattern: overrides?.pattern,
    customTypeName: overrides?.customTypeName,
    compatibleWith: [plugId],
  });

  // Cross-link Plug to Receiver
  updateConnector(plugId, { compatibleWith: [receiverId] }, "Link port pair");

  store.endGesture(`Created ${label} Plug & Receiver Pair`);
  selectConnector(plugId);

  return { plugId, receiverId };
}

/**
 * Automatically connect and snap a Plug & Receiver pair in 3D/2D space.
 */
export function connectPortPair(sourceConnectorId: string, targetConnectorId?: string): boolean {
  const project = store.getState().project;
  const src = locateConnector(sourceConnectorId);
  if (!src) return false;

  let tgt = targetConnectorId ? locateConnector(targetConnectorId) : null;

  // Find partner if targetConnectorId not explicitly given
  if (!tgt) {
    for (const p of project.parts) {
      for (const c of p.connectors) {
        if (c.id !== sourceConnectorId) {
          if (
            (src.connector.compatibleWith ?? []).includes(c.id) ||
            (c.compatibleWith ?? []).includes(sourceConnectorId)
          ) {
            tgt = { part: p, connector: c };
            break;
          }
        }
      }
      if (tgt) break;
    }
  }

  if (!tgt) return false;

  const { part: sourcePart, connector: sourceConn } = src;
  const { part: targetPart, connector: targetConn } = tgt;

  // Add connection
  addConnection({
    sourcePart: sourcePart.id,
    sourceConnector: sourceConn.id,
    targetPart: targetPart.id,
    targetConnector: targetConn.id,
    status: "valid",
    reason: `Connected ${sourceConn.name} ⚡ ${targetConn.name}`,
  });

  // Snap target part in 3D scene if target is in assembly placements
  const sourcePlacement = project.assembly.placements.find((pl) => pl.partId === sourcePart.id);
  const sourcePos = sourcePlacement?.position ?? { x: sourcePart.transform.x, y: -sourcePart.transform.y, z: 0 };
  const sourceRot = sourcePlacement?.rotation ?? { x: 0, y: 0, z: sourcePart.transform.rotation };

  const targetRotZ = (sourceRot.z + (sourceConn.orientation - targetConn.orientation)) % 360;
  const sourceConnWorldX = sourcePos.x + sourceConn.position.x;
  const sourceConnWorldY = sourcePos.y - sourceConn.position.y;
  const sourceConnWorldZ = sourcePos.z + sourcePart.thickness;

  placePart(
    targetPart.id,
    {
      x: Math.round(sourceConnWorldX - targetConn.position.x),
      y: Math.round(sourceConnWorldY + targetConn.position.y),
      z: Math.round(sourceConnWorldZ),
    },
    { x: sourceRot.x, y: sourceRot.y, z: targetRotZ }
  );

  return true;
}

/**
 * Rotate a part by deltaDeg (default 90 degrees).
 */
export function rotatePart(partId: string, deltaDeg: number = 90): void {
  const project = store.getState().project;
  const part = project.parts.find((p) => p.id === partId);
  if (!part) return;

  const newRot = ((part.transform.rotation + deltaDeg) % 360 + 360) % 360;
  updatePartTransform(partId, { rotation: newRot }, `Rotate part to ${newRot}°`);

  // Update 3D placement rotation if placed
  const pl = project.assembly.placements.find((p) => p.partId === partId);
  if (pl) {
    placePart(partId, pl.position, { ...pl.rotation, z: newRot });
  }
}

/**
 * Materialize every connector's plug/socket geometry (idempotent). Run once on
 * load so projects/demos authored before the role system show their features.
 * No history entry — it's a normalization, not a user edit.
 */
export function normalizeConnectorFeatures(): void {
  store.patchSilent((d) => {
    for (const p of d.parts) for (const c of p.connectors) syncConnectorFeature(p, c);
  });
}

export function deleteConnector(connectorId: string): void {
  store.commit("Delete connector", (d) => {
    for (const p of d.parts) {
      const before = p.connectors.length;
      p.connectors = p.connectors.filter((c) => c.id !== connectorId);
      if (p.connectors.length !== before) {
        // remove the connector's plug/socket geometry too (no orphaned modifier)
        p.modifiers = p.modifiers.filter((m) => m.connectorId !== connectorId);
        break;
      }
    }
    d.assembly.connections = d.assembly.connections.filter(
      (c) => c.sourceConnector !== connectorId && c.targetConnector !== connectorId,
    );
  });
}

/* ---- constraints -------------------------------------------------- */

export function addConstraint(partId: string, constraint: Omit<Constraint, "id">): string {
  const id = uid("cst");
  store.commit("Add constraint", (d) => {
    const p = d.parts.find((p) => p.id === partId);
    if (p) p.constraints.push({ id, ...constraint });
  });
  return id;
}

export function deleteConstraint(partId: string, constraintId: string): void {
  store.commit("Delete constraint", (d) => {
    const p = d.parts.find((p) => p.id === partId);
    if (p) p.constraints = p.constraints.filter((c) => c.id !== constraintId);
  });
}

/* ---- groups ------------------------------------------------------- */

export function addGroup(name: string): string {
  const id = uid("grp");
  store.commit("Add group", (d) => {
    d.groups.push({ id, name, order: d.groups.length, collapsed: false, parentId: null });
  });
  return id;
}

export function updateGroup(id: string, patch: Partial<PartGroup>): void {
  store.commit("Edit group", (d) => {
    const g = d.groups.find((g) => g.id === id);
    if (g) Object.assign(g, patch);
  });
}

export function setPartGroup(partId: string, groupId: string | null): void {
  updatePart(partId, { groupId }, "Group part");
}

/* ---- dimensions --------------------------------------------------- */

export function addDimension(dim: Omit<Dimension, "id">): string {
  const id = uid("dim");
  store.commit("Add dimension", (d) => d.dimensions.push({ id, ...dim }));
  return id;
}

export function updateDimension(id: string, patch: Partial<Dimension>): void {
  store.commit("Edit dimension", (d) => {
    const dim = d.dimensions.find((x) => x.id === id);
    if (dim) Object.assign(dim, patch);
  });
}

export function deleteDimension(id: string): void {
  store.commit("Delete dimension", (d) => {
    d.dimensions = d.dimensions.filter((x) => x.id !== id);
  });
}

/* ---- materials ---------------------------------------------------- */

export function addMaterial(material: Material): void {
  store.commit("Add material", (d) => d.materials.push(material));
}

export function updateMaterial(id: string, patch: Partial<Material>): void {
  store.commit("Edit material", (d) => {
    const m = d.materials.find((m) => m.id === id);
    if (m) Object.assign(m, patch);
  });
}

/* ---- assembly: placements + connections --------------------------- */

export function updatePlacement(partId: string, patch: Partial<Placement>, label = "Move in 3D"): void {
  store.commit(label, (d) => {
    let pl = d.assembly.placements.find((p) => p.partId === partId);
    if (!pl) {
      pl = { partId, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, placed: false };
      d.assembly.placements.push(pl);
    }
    Object.assign(pl, patch);
  });
}

export function placePart(partId: string, position: Vec3, rotation?: Vec3): void {
  updatePlacement(partId, { position, rotation: rotation ?? { x: 0, y: 0, z: 0 }, placed: true }, "Place part in 3D");
}

export function unplacePart(partId: string): void {
  store.commit("Remove from 3D", (d) => {
    const pl = d.assembly.placements.find((p) => p.partId === partId);
    if (pl) pl.placed = false;
    d.assembly.connections = d.assembly.connections.filter(
      (c) => c.sourcePart !== partId && c.targetPart !== partId
    );
  });
}

export function clear3DScene(): void {
  store.commit("Clear 3D Scene", (d) => {
    d.assembly.placements.forEach((pl) => (pl.placed = false));
    d.assembly.connections = [];
  });
}

export function placeAllParts(): void {
  store.commit("Place all parts in 3D", (d) => {
    d.parts.forEach((p) => {
      let pl = d.assembly.placements.find((x) => x.partId === p.id);
      if (!pl) {
        pl = { partId: p.id, position: { x: p.transform.x, y: -p.transform.y, z: 0 }, rotation: { x: 0, y: 0, z: p.transform.rotation }, placed: true };
        d.assembly.placements.push(pl);
      } else {
        pl.placed = true;
      }
    });
  });
}


export function addConnection(
  conn: Omit<Connection, "id"> & { id?: string },
): string {
  const id = conn.id ?? uid("cnx");
  store.commit("Connect parts", (d) => {
    d.assembly.connections.push({ ...conn, id });
  });
  return id;
}

export function setConnectionStatus(id: string, status: ConnectionStatus, reason?: string): void {
  store.commit("Update connection", (d) => {
    const c = d.assembly.connections.find((c) => c.id === id);
    if (c) {
      c.status = status;
      c.reason = reason;
    }
  });
}

export function removeConnection(id: string): void {
  store.commit("Disconnect", (d) => {
    d.assembly.connections = d.assembly.connections.filter((c) => c.id !== id);
  });
}

/* ---- selection + camera (UI, non-undoable) ------------------------ */

export function select(ids: string[]): void {
  store.setUI({ selection: ids, activePartId: ids[ids.length - 1] ?? null });
}

export function selectOne(id: string | null): void {
  store.setUI({ selection: id ? [id] : [], activePartId: id, selectedConnectorId: null });
}

export function toggleSelect(id: string): void {
  store.setUI((ui) => {
    const has = ui.selection.includes(id);
    const selection = has ? ui.selection.filter((s) => s !== id) : [...ui.selection, id];
    return { selection, activePartId: has ? selection[selection.length - 1] ?? null : id };
  });
}

export function clearSelection(): void {
  store.setUI({ selection: [], activePartId: null, selectedConnectorId: null });
}

export function selectConnector(id: string | null): void {
  store.setUI({ selectedConnectorId: id });
}

export function setMode(mode: "2d" | "3d" | "board"): void {
  store.setUI({ mode });
}

export function setActiveTool(toolId: string): void {
  store.setUI((ui) => ({
    activeToolId: toolId,
    recentToolIds: [toolId, ...ui.recentToolIds.filter((t) => t !== toolId)].slice(0, 12),
  }));
}

export function toggleFavoriteTool(toolId: string): void {
  store.setUI((ui) => ({
    favoriteToolIds: ui.favoriteToolIds.includes(toolId)
      ? ui.favoriteToolIds.filter((t) => t !== toolId)
      : [...ui.favoriteToolIds, toolId],
  }));
}
