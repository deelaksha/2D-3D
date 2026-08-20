/**
 * build3d — turns the SAME 2D Project model into high-fidelity Three.js meshes
 * for the 3D preview. Read-only: each part's 2D outline is extruded by its
 * thickness, styled with procedural PBR materials (realistic wood grain, satin,
 * wireframe, or X-ray modes), tagged with inspect metadata, and prepared for
 * exploded assembly views.
 */
import * as THREE from "three";
import type { Part, Project, Vec2 } from "@/core/model/types";
import { partOutlineWorld, partModifiersWorld } from "@/core/geometry/world";
import { materialOf } from "@/core/model/defaults";

export type RenderMode = "textured" | "solid" | "wireframe" | "xray";

/** Cache for generated procedural wood textures by color hex */
const woodTextureCache = new Map<string, THREE.CanvasTexture>();

/** Generates a seamless procedural wood grain CanvasTexture */
function getProceduralWoodTexture(hexColor: string): THREE.CanvasTexture {
  if (woodTextureCache.has(hexColor)) {
    return woodTextureCache.get(hexColor)!;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const baseColor = new THREE.Color(hexColor);
    const darkColor = baseColor.clone().multiplyScalar(0.72);
    const lightColor = baseColor.clone().offsetHSL(0, 0, 0.08);

    // Base fill gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, `#${baseColor.getHexString()}`);
    grad.addColorStop(0.5, `#${lightColor.getHexString()}`);
    grad.addColorStop(1, `#${baseColor.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Fine organic wood grain lines
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 180; i++) {
      const y = Math.random() * 512;
      const alpha = 0.04 + Math.random() * 0.12;
      ctx.strokeStyle = Math.random() > 0.4 ? `#${darkColor.getHexString()}` : `#${lightColor.getHexString()}`;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        128, y + (Math.random() * 20 - 10),
        384, y + (Math.random() * 20 - 10),
        512, y + (Math.random() * 10 - 5)
      );
      ctx.stroke();
    }

    // Wood rings / knots effect
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = `#${darkColor.getHexString()}`;
    for (let k = 0; k < 3; k++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      for (let r = 10; r < 200; r += 14) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  woodTextureCache.set(hexColor, texture);
  return texture;
}

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

/** Create material based on selected render mode */
export function createPartMaterial(colorHex: string, renderMode: RenderMode = "textured"): THREE.Material {
  const baseColor = new THREE.Color(colorHex);

  switch (renderMode) {
    case "wireframe":
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        wireframe: true,
        roughness: 0.5,
        metalness: 0.1,
      });

    case "xray":
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.38,
        roughness: 0.15,
        transmission: 0.6,
        thickness: 2,
        clearcoat: 0.5,
      });

    case "solid":
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.45,
        metalness: 0.08,
      });

    case "textured":
    default: {
      const map = getProceduralWoodTexture(colorHex);
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        map,
        roughness: 0.55,
        metalness: 0.04,
      });
    }
  }
}

/** One part → a 3D object (extruded board + plugs + crisp edges + metadata). */
export function buildPartObject(
  project: Project,
  part: Part,
  renderMode: RenderMode = "textured"
): THREE.Group | null {
  const loops = partOutlineWorld(part);
  const outer = loops[0];
  if (!outer || outer.length < 3) return null;

  const mods = partModifiersWorld(part);
  const subtract = mods.filter((m) => m.op === "subtract").flatMap((m) => m.loops);
  const union = mods.filter((m) => m.op === "union").flatMap((m) => m.loops);
  const holes = [...loops.slice(1), ...subtract];

  const thickness = Math.max(0.6, part.thickness || 4);
  const matObj = materialOf(project, part.materialId);
  const colorHex = matObj?.color ?? "#c8a25a";
  const mat = createPartMaterial(colorHex, renderMode);

  const group = new THREE.Group();
  group.name = part.name;

  // Store metadata on group for raycast inspection & exploded view
  group.userData = {
    partId: part.id,
    partName: part.name,
    thickness,
    materialName: matObj?.name ?? "Plywood",
    colorHex,
    originalPosition: new THREE.Vector3(0, 0, 0),
    explodeVector: new THREE.Vector3(0, 0, 0),
  };

  const opts: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 3,
    curveSegments: 24,
  };

  const baseGeo = new THREE.ExtrudeGeometry(toShape(outer, holes), opts);
  const baseMesh = new THREE.Mesh(baseGeo, mat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData = group.userData;
  group.add(baseMesh);

  // Insert plugs (tab/peg protrusions)
  for (const loop of union) {
    if (loop.length < 3) continue;
    const plugGeo = new THREE.ExtrudeGeometry(toShape(loop, []), opts);
    const plugMesh = new THREE.Mesh(plugGeo, mat);
    plugMesh.castShadow = true;
    plugMesh.receiveShadow = true;
    plugMesh.userData = group.userData;
    group.add(plugMesh);
  }

  // Crisp darker edge outline for crisp visual definition
  if (renderMode !== "wireframe") {
    const edges = new THREE.EdgesGeometry(baseGeo, 30);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x111827,
      transparent: true,
      opacity: 0.28,
    });
    group.add(new THREE.LineSegments(edges, lineMat));
  }

  return group;
}

/** Whole project → a group of extruded parts (visible parts only). */
export function buildProjectObject(
  project: Project,
  renderMode: RenderMode = "textured"
): THREE.Group {
  const root = new THREE.Group();
  for (const part of project.parts) {
    if (!part.visible) continue;
    const o = buildPartObject(project, part, renderMode);
    if (o) root.add(o);
  }

  // Calculate explode vectors from collective center of mass
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    root.children.forEach((child) => {
      const partBox = new THREE.Box3().setFromObject(child);
      const partCenter = partBox.getCenter(new THREE.Vector3());
      const explodeDir = partCenter.clone().sub(center);
      if (explodeDir.lengthSq() < 0.001) {
        explodeDir.set(Math.random() - 0.5, Math.random() - 0.5, 0.5);
      }
      explodeDir.normalize();
      child.userData.explodeVector = explodeDir;
      child.userData.originalPosition = child.position.clone();
    });
  }

  return root;
}

/** Updates part positions based on exploded view percentage (0.0 to 1.0) */
export function applyExplodeFactor(rootGroup: THREE.Group, factor: number): void {
  const maxDistance = 140; // mm maximum offset
  rootGroup.children.forEach((child) => {
    if (child.userData.explodeVector && child.userData.originalPosition) {
      const offset = child.userData.explodeVector.clone().multiplyScalar(factor * maxDistance);
      child.position.copy(child.userData.originalPosition).add(offset);
    }
  });
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
