/**
 * WoodKit Designer — "House" demo project.
 *
 * Builds a small foldable house kit: a square Base, four Walls that stand up
 * around its edges, and two Roof panels that meet at an apex. Every part is a
 * real Part (rect shape, plywood material) carrying NAMED connectors whose
 * local positions/orientations are physically sensible so the compatibility
 * and snapping engines have something meaningful to chew on.
 *
 * Two coordinate systems appear here:
 *  - 2D authoring (Part.transform + Shape, mm, y-DOWN, angles CW where 0=+X).
 *    Shapes are rect at local origin (0,0), so local coords span
 *    [0..width] x [0..height]; edges are top(y=0) bottom(y=height)
 *    left(x=0) right(x=width). Outward orientations: up=-Y=270, down=+Y=90,
 *    right=+X=0, left=-X=180.
 *  - 3D assembly (Placement.position/rotation, Euler DEGREES, three.js: Y up).
 *    Per the to3d contract each panel is centered at the origin spanning
 *    +/-width/2 in X, +/-height/2 in Y, extruded along +Z by `thickness`, and
 *    starts life vertical in the XY plane facing +Z.
 */
import { makeConnector, makePart, makeProject } from "@/core/model/defaults";
import type { Connector, Part, Project } from "@/core/model/types";

/* ------------------------------------------------------------------ */
/* Dimensions (mm) — single source of truth, reused by the 3D math.   */
/* ------------------------------------------------------------------ */

const BASE = 120; // base is a 120 x 120 square
const WALL_W = 120; // wall width matches a base edge
const WALL_H = 80; // wall height (how tall the house stands)
const ROOF_W = 130; // roof width (runs along the ridge; 5mm overhang each end)
const ROOF_D = 70; // roof depth = slope length from ridge to eave
const THICK = 4; // plywood stock thickness

/* Roof geometry, derived so the two panels meet cleanly at an apex.
 * Each roof panel is a right-triangle slope: the slope length is ROOF_D (70),
 * its horizontal run is HALF_SPAN (60, half the house depth), so the vertical
 * rise is sqrt(slope^2 - run^2). The panel starts vertical (XY plane); we lay
 * it back about the X axis until it makes angle ROOF_TILT with the horizontal.
 *   cos(ROOF_TILT) = run / slope = HALF_SPAN / ROOF_D   -> ~31deg
 *   Euler X rotation from vertical = 90 - ROOF_TILT     -> ~59deg
 */
const HALF_SPAN = BASE / 2; // 60 : half the house depth in Z (one roof's run)
const ROOF_TILT = Math.round(
  (Math.acos(HALF_SPAN / ROOF_D) * 180) / Math.PI,
); // ~31deg from horizontal
// Euler X rotation: a vertical panel (0deg) laid toward horizontal (90deg)
// minus the tilt-from-horizontal above.
const ROOF_X_ROT = 90 - ROOF_TILT; // ~59deg -> panel leans back into a slope
// Vertical rise across the full slope, and ridge height above the wall tops.
const ROOF_RISE = Math.round(Math.sqrt(ROOF_D * ROOF_D - HALF_SPAN * HALF_SPAN)); // ~36
const RIDGE_Y = WALL_H + ROOF_RISE; // apex height (~116)
const ROOF_CENTER_Y = WALL_H + ROOF_RISE / 2; // panel center height (~98)
const ROOF_CENTER_Z = HALF_SPAN / 2; // panel center offset in Z (~30)

/* ------------------------------------------------------------------ */
/* Small authoring helper                                              */
/* ------------------------------------------------------------------ */

/** Add a fully-formed connector (with a stable NAME) to a part. */
function connect(
  part: Part,
  name: string,
  type: Connector["type"],
  x: number,
  y: number,
  orientation: number,
  overrides: Partial<Connector> = {},
): void {
  part.connectors.push(
    makeConnector(part.id, type, { x, y }, { name, orientation, ...overrides }),
  );
}

/**
 * Register a part in the project AND seed an (unplaced) 3D placement for it,
 * mirroring what createPart() does so the assembly stays well-formed.
 */
function register(project: Project, part: Part): Part {
  project.parts.push(part);
  project.assembly.placements.push({
    partId: part.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    placed: false,
  });
  return part;
}

/* ------------------------------------------------------------------ */
/* houseDemo()                                                         */
/* ------------------------------------------------------------------ */

export function houseDemo(): Project {
  const project = makeProject("House Demo");
  project.meta.description =
    "A foldable plywood house: base, four walls and a two-panel apex roof.";
  const plywood =
    project.materials.find((m) => m.kind === "plywood") ?? project.materials[0];
  const mat = plywood.id;

  /* -- Base: 120x120 plywood, laid out top-left on the canvas -------- */
  const base = makePart("Base", mat, {
    type: "base",
    width: BASE,
    height: BASE,
    thickness: THICK,
    transform: { x: 40, y: 60, rotation: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false },
  });
  // Four outward-facing SLOTS, one per edge, each mated to a wall's bottom tabs.
  connect(base, "Base-Wall1", "slot", BASE / 2, 0, 270, {
    compatibleWith: ["Wall1-BottomLeft", "Wall1-BottomRight"],
  }); // top edge  -> Wall 1
  connect(base, "Base-Wall2", "slot", BASE, BASE / 2, 0, {
    compatibleWith: ["Wall2-BottomLeft", "Wall2-BottomRight"],
  }); // right edge -> Wall 2
  connect(base, "Base-Wall3", "slot", BASE / 2, BASE, 90, {
    compatibleWith: ["Wall3-BottomLeft", "Wall3-BottomRight"],
  }); // bottom edge-> Wall 3
  connect(base, "Base-Wall4", "slot", 0, BASE / 2, 180, {
    compatibleWith: ["Wall4-BottomLeft", "Wall4-BottomRight"],
  }); // left edge  -> Wall 4
  register(project, base);

  /* -- Walls 1..4: 120x80 plywood -----------------------------------
   * Each wall carries two bottom TABS (mate the base slot) plus two side
   * EDGE connectors that meet the neighbouring walls at the corners.
   * Neighbour ring: Wall1 -> Wall2 -> Wall3 -> Wall4 -> Wall1.        */
  const wallLayout: Array<{
    n: number;
    tx: number;
    ty: number;
    leftNeighbor: number; // wall whose RIGHT edge meets this wall's LEFT edge
    rightNeighbor: number; // wall whose LEFT edge meets this wall's RIGHT edge
  }> = [
    { n: 1, tx: 220, ty: 60, leftNeighbor: 4, rightNeighbor: 2 },
    { n: 2, tx: 220, ty: 200, leftNeighbor: 1, rightNeighbor: 3 },
    { n: 3, tx: 220, ty: 340, leftNeighbor: 2, rightNeighbor: 4 },
    { n: 4, tx: 420, ty: 60, leftNeighbor: 3, rightNeighbor: 1 },
  ];
  for (const w of wallLayout) {
    const wall = makePart(`Wall ${w.n}`, mat, {
      type: "wall",
      width: WALL_W,
      height: WALL_H,
      thickness: THICK,
      transform: { x: w.tx, y: w.ty, rotation: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false },
    });
    // Bottom edge is local y = WALL_H; tabs face down/out (+Y = 90 CW).
    connect(wall, `Wall${w.n}-BottomLeft`, "tab", WALL_W / 3, WALL_H, 90, {
      compatibleWith: [`Base-Wall${w.n}`],
    });
    connect(wall, `Wall${w.n}-BottomRight`, "tab", (2 * WALL_W) / 3, WALL_H, 90, {
      compatibleWith: [`Base-Wall${w.n}`],
    });
    // Side EDGE connectors meet the neighbouring walls' opposite edges.
    connect(wall, `Wall${w.n}-Left`, "edge", 0, WALL_H / 2, 180, {
      compatibleWith: [`Wall${w.leftNeighbor}-Right`],
    });
    connect(wall, `Wall${w.n}-Right`, "edge", WALL_W, WALL_H / 2, 0, {
      compatibleWith: [`Wall${w.rightNeighbor}-Left`],
    });
    register(project, wall);
  }

  /* -- Roof Left / Roof Right: 130x70 plywood -----------------------
   * Each roof has one TAB at its eave (bottom edge) that drops onto a wall
   * top, and one EDGE at its ridge (top edge) that mates with the other
   * roof's ridge to form the apex.                                     */
  const roofLeft = makePart("Roof Left", mat, {
    type: "roof",
    width: ROOF_W,
    height: ROOF_D,
    thickness: THICK,
    transform: { x: 420, y: 220, rotation: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false },
  });
  connect(roofLeft, "RoofLeft-Wall", "tab", ROOF_W / 2, ROOF_D, 90, {
    compatibleWith: ["Wall3-Top", "Base-Wall3"],
  }); // eave edge -> a wall top
  connect(roofLeft, "RoofLeft-Ridge", "edge", ROOF_W / 2, 0, 270, {
    compatibleWith: ["RoofRight-Ridge"],
  }); // ridge edge -> other roof
  register(project, roofLeft);

  const roofRight = makePart("Roof Right", mat, {
    type: "roof",
    width: ROOF_W,
    height: ROOF_D,
    thickness: THICK,
    transform: { x: 620, y: 220, rotation: 0, scaleX: 1, scaleY: 1, flipX: false, flipY: false },
  });
  connect(roofRight, "RoofRight-Wall", "tab", ROOF_W / 2, ROOF_D, 90, {
    compatibleWith: ["Wall1-Top", "Base-Wall1"],
  });
  connect(roofRight, "RoofRight-Ridge", "edge", ROOF_W / 2, 0, 270, {
    compatibleWith: ["RoofLeft-Ridge"],
  });
  register(project, roofRight);

  return project;
}
