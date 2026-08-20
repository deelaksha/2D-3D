/**
 * build3d — turns the SAME 2D Project model into three.js meshes for the 3D
 * preview. Read-only: each part's real 2D outline (with its holes/sockets) is
 * extruded by its thickness and left where it sits in 2D. Insert "plugs" (union
 * modifiers) are extruded too so tabs/pegs poke out. Nothing here edits state.
 *
 * Isolated in ui/canvas3d/ so the 3D feature can be removed or swapped freely.
 */
import * as THREE from "three";
import type { Part, Project, Vec2 } from "@/core/model/types";
import { partOutlineWorld, partModifiersWorld } from "@/core/geometry/world";
import { materialOf } from "@/core/model/defaults";

/** Build a filled THREE.Shape from an outer loop + holes (2D y is flipped for 3D). */
function toShape(outer: Vec2[], holes: Vec2[][]): THREE.Shape {
  const s = new THREE.Shape();
  outer.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.y) : s.lineTo(p.x, -p.y)));
  s.closePath();
  for (const h of holes) {
    if (h.length < 3) continue;
    const path = new THREE.Path();
    h.forEach((p, i) => (i === 0 ? path.moveTo(p.x, -p.y) : path.lineTo(p.x, -p.y)));
    path.closePath();
    s.holes.push(path);
  }
  return s;
}

/** One part → a 3D object (extruded board + plugs + faint edge outline). */
export function buildPartObject(project: Project, part: Part): THREE.Object3D | null {
  const loops = partOutlineWorld(part);
  const outer = loops[0];
  if (!outer || outer.length < 3) return null;

  const mods = partModifiersWorld(part);
  const subtract = mods.filter((m) => m.op === "subtract").flatMap((m) => m.loops);
  const union = mods.filter((m) => m.op === "union").flatMap((m) => m.loops);
  const holes = [...loops.slice(1), ...subtract];

  const thickness = Math.max(0.6, part.thickness || 4);
  const color = new THREE.Color(materialOf(project, part.materialId)?.color ?? "#c8a25a");
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 });

  const group = new THREE.Group();
  group.name = part.name;

  const opts: THREE.ExtrudeGeometryOptions = { depth: thickness, bevelEnabled: false, curveSegments: 24 };
  const baseGeo = new THREE.ExtrudeGeometry(toShape(outer, holes), opts);
  group.add(new THREE.Mesh(baseGeo, mat));

  // insert plugs (tab/peg protrusions) as their own little extrusions
  for (const loop of union) {
    if (loop.length < 3) continue;
    group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(toShape(loop, []), opts), mat));
  }

  // subtle darker edge outline so faces read as separate boards
  const edges = new THREE.EdgesGeometry(baseGeo, 35);
  group.add(
    new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x1a1d23, transparent: true, opacity: 0.22 }),
    ),
  );
  return group;
}

/** Whole project → a group of extruded parts (visible parts only). */
export function buildProjectObject(project: Project): THREE.Group {
  const root = new THREE.Group();
  for (const part of project.parts) {
    if (!part.visible) continue;
    const o = buildPartObject(project, part);
    if (o) root.add(o);
  }
  return root;
}

/** Recursively free geometries/materials of a built group before discarding it. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const anyChild = child as THREE.Mesh | THREE.LineSegments;
    if (anyChild.geometry) anyChild.geometry.dispose();
    const m = (anyChild as THREE.Mesh).material;
    if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
    else if (m) (m as THREE.Material).dispose();
  });
}
