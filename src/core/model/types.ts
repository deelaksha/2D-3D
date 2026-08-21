/**
 * WoodKit Designer — Core Data Model (single source of truth).
 *
 * DESIGN PHILOSOPHY
 * -----------------
 * A 2D object is not merely a drawing — it represents a physical wooden part.
 * A connector is not merely a symbol — it represents a physical attachment point.
 * A connection is not merely a line — it represents an assembly relationship.
 *
 * This module unifies:  2D geometry -> physical metadata -> connectors ->
 * assembly relationships -> 3D representation  in ONE model.
 *
 * All lengths are stored in MILLIMETRES (mm). The UI converts for display only.
 * This file has NO dependencies and NO runtime logic beyond type declarations
 * and a few small enums/constants so it can be imported everywhere safely.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned bounding box in model space (mm). */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Unit = "mm" | "cm" | "inch";

export type ID = string;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * A shape's kind. The parametric kinds carry their own parameters; "path" and
 * "polygon" carry explicit point lists. Rendering + hit-testing derive an
 * outline (list of sub-paths) from these via src/core/geometry.
 */
export type ShapeKind =
  | "rect"
  | "roundedRect"
  | "square"
  | "circle"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "star"
  | "line"
  | "polyline"
  | "arc"
  | "bezier"
  | "path"
  | "ring"
  | "capsule"
  | "slot"
  | "trapezoid"
  | "parallelogram"
  | "diamond"
  | "hexagon"
  | "octagon";

/** A single point of a freeform/bezier path. */
export interface PathPoint {
  x: number;
  y: number;
  /** Optional cubic bezier control handles (absolute mm coords). */
  cIn?: Vec2;
  cOut?: Vec2;
}

/**
 * Parametric shape parameters. Only the fields relevant to `kind` are used, but
 * keeping them in one open interface keeps the model flat and serialisable.
 * A shape is defined in the part's LOCAL coordinate system; the part transform
 * places it in world space.
 */
export interface Shape {
  kind: ShapeKind;
  /** Local origin of the shape (mm). Interpreted per-kind (usually top-left). */
  x: number;
  y: number;
  /** Bounding size for parametric shapes (mm). */
  width: number;
  height: number;
  /** Rotation of the shape within the part (degrees, CW). */
  rotation: number;
  /** roundedRect / capsule / slot corner radius (mm). */
  radius?: number;
  /** ring inner radius, star inner radius ratio, polygon side count, etc. */
  sides?: number;
  innerRadius?: number;
  /** Star point count / polygon sides. */
  points?: number;
  /** Explicit outline for kind "polygon" | "path" | "polyline" | "bezier". */
  nodes?: PathPoint[];
  /** Whether an explicit path is closed. */
  closed?: boolean;
}

/** Boolean modifier applied to a part's base shape to cut holes/slots/tabs. */
export type BooleanOp = "union" | "subtract" | "intersect";

export interface ShapeModifier {
  id: ID;
  op: BooleanOp;
  shape: Shape;
  /** Human label, e.g. "window hole". */
  name?: string;
  /** When this modifier is the geometry of a connector, the connector's id. */
  connectorId?: ID;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export type MaterialKind =
  | "plywood"
  | "mdf"
  | "cardboard"
  | "acrylic"
  | "solidwood"
  | "foamboard";

export interface Material {
  id: ID;
  name: string;
  kind: MaterialKind;
  /** Default stock thickness (mm). */
  thickness: number;
  /** g/cm^3, informational. */
  density?: number;
  /** Display colour (hex) for 2D fill + 3D albedo. */
  color: string;
  /** Manufacturing note shown in the inspector. */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Connectors                                                          */
/* ------------------------------------------------------------------ */

/**
 * Connector types represent real physical attachment features. They fall into
 * complementary families used by the compatibility engine (see connectors/compat).
 */
export type ConnectorType =
  | "peg"
  | "hole"
  | "slot"
  | "tab"
  | "notch"
  | "dowel"
  | "hinge"
  | "magnet"
  | "snap"
  | "edge"
  | "corner"
  | "surface"
  | "custom";

/**
 * A connector's physical role:
 *  - "insert"   — male: adds a matching piece that pokes OUT (tab, peg, dowel…)
 *  - "receiver" — female: cuts an opening the insert plugs into (slot, hole, notch…)
 *  - "neutral"  — mates face-to-face, no added or removed material (magnet, hinge…)
 *  - "custom"   — custom connector/receiver definition
 */
export type ConnectorRole = "insert" | "receiver" | "neutral" | "custom";

/** Custom physical design patterns for connectors. */
export type ConnectorPattern =
  | "standard"
  | "dovetail"
  | "puzzle"
  | "tslot"
  | "teeth"
  | "wave";

/**
 * A connector lives on a part, at a local position, facing a direction.
 * `orientation` is degrees CW; 0 points +X (right) in the part's local frame.
 */
export interface Connector {
  id: ID;
  partId: ID;
  name: string;
  type: ConnectorType;
  /** Male (adds a plug) vs female (cuts a socket) vs neutral vs custom. Drives geometry. */
  role?: ConnectorRole;
  /** Opposite / inverted / negative mode: flips plug ↔ socket geometry and mating logic. */
  inverted?: boolean;
  /** Custom joint shape pattern (dovetail, puzzle key, t-slot, finger-teeth, wave). */
  pattern?: ConnectorPattern;
  /** Custom connector/receiver type name when type/role is custom. */
  customTypeName?: string;
  /** Local position on the part (mm). */
  position: Vec2;
  /** Facing direction (degrees CW, 0 = +X). */
  orientation: number;
  /** Feature footprint (mm). Interpreted per-type: slot/tab use width+height. */
  width: number;
  height: number;
  /** Insertion depth into the mating part (mm). */
  depth: number;
  /** For round features (peg/dowel/hole). */
  diameter?: number;
  /** Fit tolerance (mm) used by the compatibility engine. */
  tolerance: number;
  /**
   * Explicit compatibility allow-list of connector ids or names. When present it
   * augments the automatic type/geometry rules. Empty means "auto only".
   */
  compatibleWith: string[];
  /** Free-form key/value metadata. */
  metadata?: Record<string, string | number | boolean>;
}


/* ------------------------------------------------------------------ */
/* Constraints                                                         */
/* ------------------------------------------------------------------ */

export type ConstraintKind =
  | "fixedWidth"
  | "fixedHeight"
  | "equalLength"
  | "parallel"
  | "perpendicular"
  | "concentric"
  | "centered"
  | "aligned"
  | "fixedAngle"
  | "fixedDistance"
  | "symmetric";

export interface Constraint {
  id: ID;
  kind: ConstraintKind;
  /** Target part/shape/connector ids the constraint applies to. */
  targets: ID[];
  /** Numeric value (mm or degrees) where relevant. */
  value?: number;
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Dimensions (annotations)                                           */
/* ------------------------------------------------------------------ */

export type DimensionKind =
  | "horizontal"
  | "vertical"
  | "aligned"
  | "radial"
  | "diameter"
  | "angle"
  | "distance";

export interface Dimension {
  id: ID;
  kind: DimensionKind;
  /** World-space anchor points (mm). */
  a: Vec2;
  b: Vec2;
  /** Perpendicular offset of the dimension line (mm). */
  offset: number;
  /** Optional label override; otherwise measured value is shown. */
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Parts (physical wooden components)                                 */
/* ------------------------------------------------------------------ */

export type PartType =
  | "generic"
  | "base"
  | "wall"
  | "roof"
  | "floor"
  | "beam"
  | "panel"
  | "custom";

/**
 * A Part is BOTH a design layer (drawn in 2D) and a physical component
 * (extruded in 3D). It owns exactly one base shape plus boolean modifiers,
 * its own connectors, constraints and metadata.
 */
export interface Part {
  id: ID;
  name: string;
  type: PartType;
  /** World transform of the part in the 2D canvas. */
  transform: Transform2D;
  /** Nominal footprint (mm) — kept in sync with the base shape bounds. */
  width: number;
  height: number;
  /** Stock thickness (mm) → 3D extrusion depth. */
  thickness: number;
  materialId: ID;
  /** Fill colour override (hex). Falls back to material colour. */
  color?: string;
  /** Base outline drawn in the part's local frame. */
  shape: Shape;
  /** Holes / slots / tabs applied to the base shape. */
  modifiers: ShapeModifier[];
  connectors: Connector[];
  constraints: Constraint[];
  /** Layer-style flags. */
  visible: boolean;
  locked: boolean;
  /** Stacking + tree order (lower = earlier). */
  order: number;
  /** Optional grouping parent (part group id) for the layer tree. */
  groupId?: ID | null;
  metadata?: Record<string, string | number | boolean>;
}

export interface Transform2D {
  /** Position of the part origin in world space (mm). */
  x: number;
  y: number;
  /** Rotation (degrees CW). */
  rotation: number;
  /** Uniform-ish scale factors (usually 1). */
  scaleX: number;
  scaleY: number;
  /** Mirror flags. */
  flipX: boolean;
  flipY: boolean;
}

/** A collapsible group node in the layer/part tree. */
export interface PartGroup {
  id: ID;
  name: string;
  order: number;
  collapsed: boolean;
  parentId?: ID | null;
}

/* ------------------------------------------------------------------ */
/* Assembly (3D relationships)                                        */
/* ------------------------------------------------------------------ */

export type ConnectionStatus =
  | "valid"
  | "invalid"
  | "possible"
  | "unknown";

/** A realised connection between two connectors of two parts. */
export interface Connection {
  id: ID;
  sourcePart: ID;
  sourceConnector: ID;
  targetPart: ID;
  targetConnector: ID;
  status: ConnectionStatus;
  /** Reason string for invalid/possible states (shown to the user). */
  reason?: string;
}

/** Placement of a part in the 3D assembly scene. */
export interface Placement {
  partId: ID;
  position: Vec3;
  /** Euler rotation in degrees. */
  rotation: Vec3;
  /** Whether the part has been dragged into the 3D scene yet. */
  placed: boolean;
}

export interface Assembly {
  id: ID;
  name: string;
  placements: Placement[];
  connections: Connection[];
}

/* ------------------------------------------------------------------ */
/* Project (top-level document)                                       */
/* ------------------------------------------------------------------ */

export interface ProjectMeta {
  id: ID;
  name: string;
  /** ISO timestamps injected by the host (model stays deterministic). */
  createdAt?: string;
  updatedAt?: string;
  /** Preferred display unit; storage is always mm. */
  displayUnit: Unit;
  author?: string;
  description?: string;
}

export interface Project {
  meta: ProjectMeta;
  materials: Material[];
  groups: PartGroup[];
  parts: Part[];
  dimensions: Dimension[];
  assembly: Assembly;
  /** Schema version for persistence migrations. */
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Validation result (assembly / design checks)                       */
/* ------------------------------------------------------------------ */

export type IssueLevel = "ok" | "warning" | "error";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  /** Related part/connector/connection ids for click-to-focus. */
  refs?: ID[];
}

export interface ValidationReport {
  level: IssueLevel;
  issues: ValidationIssue[];
}
