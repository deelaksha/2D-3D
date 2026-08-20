/**
 * Factory functions producing well-formed model objects with sensible defaults.
 * Everything that CREATES model data should route through here so invariants
 * (units in mm, required fields present) hold everywhere.
 */
import { uid } from "./ids";
import type {
  Assembly,
  Connector,
  ConnectorType,
  Material,
  MaterialKind,
  Part,
  PartType,
  Project,
  Shape,
  ShapeKind,
  Transform2D,
  Vec2,
} from "./types";
import { SCHEMA_VERSION } from "./types";

/* ---- Materials ---------------------------------------------------- */

export const MATERIAL_PRESETS: Record<MaterialKind, Omit<Material, "id">> = {
  plywood: { name: "Plywood", kind: "plywood", thickness: 4, density: 0.6, color: "#d9b380", note: "Laser/CNC friendly. Grain visible." },
  mdf: { name: "MDF", kind: "mdf", thickness: 3, density: 0.75, color: "#c9a878", note: "Smooth, uniform. Seal edges." },
  cardboard: { name: "Cardboard", kind: "cardboard", thickness: 2, density: 0.2, color: "#c8a06a", note: "Light, kid-safe prototyping." },
  acrylic: { name: "Acrylic", kind: "acrylic", thickness: 3, density: 1.18, color: "#8fd3e8", note: "Transparent. Flame-polish edges." },
  solidwood: { name: "Solid Wood", kind: "solidwood", thickness: 6, density: 0.65, color: "#c08a4a", note: "Strong. Mind the grain direction." },
  foamboard: { name: "Foam Board", kind: "foamboard", thickness: 5, density: 0.1, color: "#eeeae0", note: "Very light. Low strength." },
};

export function makeMaterial(kind: MaterialKind, overrides: Partial<Material> = {}): Material {
  return { id: uid("mat"), ...MATERIAL_PRESETS[kind], ...overrides };
}

export function defaultMaterials(): Material[] {
  return (Object.keys(MATERIAL_PRESETS) as MaterialKind[]).map((k) => makeMaterial(k));
}

/* ---- Transform ---------------------------------------------------- */

export function identityTransform(x = 0, y = 0): Transform2D {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false };
}

/* ---- Shapes ------------------------------------------------------- */

export function makeShape(kind: ShapeKind, overrides: Partial<Shape> = {}): Shape {
  const base: Shape = {
    kind,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
  };
  if (kind === "roundedRect" || kind === "slot" || kind === "capsule") base.radius = 8;
  if (kind === "circle" || kind === "ellipse" || kind === "ring") { base.width = 80; base.height = 80; }
  if (kind === "ring") base.innerRadius = 24;
  if (kind === "polygon" || kind === "hexagon" || kind === "octagon") base.sides = kind === "hexagon" ? 6 : kind === "octagon" ? 8 : 5;
  if (kind === "star") base.points = 5;
  return { ...base, ...overrides };
}

/* ---- Connectors --------------------------------------------------- */

const CONNECTOR_DEFAULTS: Record<ConnectorType, Partial<Connector>> = {
  tab: { width: 12, height: 4, depth: 4, tolerance: 0.2 },
  slot: { width: 12, height: 4, depth: 4, tolerance: 0.2 },
  hole: { width: 6, height: 6, depth: 4, diameter: 6, tolerance: 0.2 },
  peg: { width: 6, height: 6, depth: 8, diameter: 6, tolerance: 0.2 },
  dowel: { width: 8, height: 8, depth: 10, diameter: 8, tolerance: 0.2 },
  notch: { width: 10, height: 5, depth: 5, tolerance: 0.3 },
  hinge: { width: 20, height: 6, depth: 4, tolerance: 0.3 },
  magnet: { width: 8, height: 8, depth: 3, diameter: 8, tolerance: 0.5 },
  snap: { width: 10, height: 6, depth: 5, tolerance: 0.4 },
  edge: { width: 20, height: 4, depth: 4, tolerance: 0.3 },
  corner: { width: 12, height: 12, depth: 4, tolerance: 0.3 },
  surface: { width: 16, height: 16, depth: 2, tolerance: 0.5 },
};

export function makeConnector(
  partId: string,
  type: ConnectorType,
  position: Vec2,
  overrides: Partial<Connector> = {},
): Connector {
  const d = CONNECTOR_DEFAULTS[type];
  return {
    id: uid("con"),
    partId,
    name: `${type} connector`,
    type,
    position,
    orientation: 0,
    width: 10,
    height: 4,
    depth: 4,
    tolerance: 0.2,
    compatibleWith: [],
    ...d,
    ...overrides,
  };
}

/* ---- Parts -------------------------------------------------------- */

let orderSeq = 0;

export function makePart(
  name: string,
  materialId: string,
  overrides: Partial<Part> = {},
): Part {
  const width = overrides.width ?? overrides.shape?.width ?? 100;
  const height = overrides.height ?? overrides.shape?.height ?? 80;
  const type: PartType = overrides.type ?? "generic";
  orderSeq += 1;
  return {
    id: uid("part"),
    name,
    type,
    transform: identityTransform(),
    width,
    height,
    thickness: 4,
    materialId,
    shape: makeShape("rect", { width, height }),
    modifiers: [],
    connectors: [],
    constraints: [],
    visible: true,
    locked: false,
    order: orderSeq,
    groupId: null,
    ...overrides,
  };
}

/* ---- Assembly ----------------------------------------------------- */

export function emptyAssembly(): Assembly {
  return { id: uid("asm"), name: "Assembly", placements: [], connections: [] };
}

/* ---- Project ------------------------------------------------------ */

export function makeProject(name = "Untitled Kit"): Project {
  const materials = defaultMaterials();
  return {
    meta: { id: uid("proj"), name, displayUnit: "mm", description: "" },
    materials,
    groups: [],
    parts: [],
    dimensions: [],
    assembly: emptyAssembly(),
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Look up a material by id, falling back to the first material. */
export function materialOf(project: Project, id: string): Material {
  return project.materials.find((m) => m.id === id) ?? project.materials[0];
}
