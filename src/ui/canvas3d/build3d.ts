/**
 * build3d — turns the SAME 2D Project model into high-fidelity Three.js meshes
 * for the 3D preview. Read-only: each part's 2D outline is extruded by its
 * thickness, styled with procedural PBR materials (realistic wood grain, satin,
 * wireframe, or X-ray modes), tagged with inspect metadata, and prepared for
 * exploded assembly views, interactive 3D connector snapping, and mating lines.
 */
import * as THREE from "three";
import type { Connection, Connector, Part, Placement, Project, Vec2, Vec3 } from "@/core/model/types";
import { partOutlineWorld, partModifiersWorld } from "@/core/geometry/world";
import { materialOf } from "@/core/model/defaults";
import { checkCompatibility, connectorFamily } from "@/core/connectors/compat";
import { defaultRole } from "@/core/connectors/feature";
import { addConnection, placePart } from "@/core/store/actions";

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

/** Build interactive 3D Connector sphere markers on a part group */
export function buildConnectorNodes3D(part: Part, thickness: number, group: THREE.Group): void {
  for (const c of part.connectors) {
    const role = c.role ?? defaultRole(c.type);
    let colorHex = 0xf59e0b; // Amber neutral
    if (role === "insert" || connectorFamily(c.type) === "insert") {
      colorHex = 0x22c55e; // Green insert
    } else if (role === "receiver" || connectorFamily(c.type) === "receive") {
      colorHex = 0x3b82f6; // Blue receiver
    }

    const sphereGeo = new THREE.SphereGeometry(Math.max(4, Math.min(8, (c.width || 10) / 2)), 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.2,
    });

    const marker = new THREE.Mesh(sphereGeo, sphereMat);
    const posX = c.position.x + part.transform.x;
    const posY = -(c.position.y + part.transform.y);
    marker.position.set(posX, posY, thickness / 2 + 3);
    marker.name = `connector_${c.id}`;

    marker.userData = {
      isConnector: true,
      connectorId: c.id,
      connectorName: c.name,
      connectorType: c.type,
      connectorRole: role,
      partId: part.id,
      partName: part.name,
      localPos: new THREE.Vector3(posX, posY, thickness / 2),
    };


    group.add(marker);
  }
}

/** One part → a 3D object (extruded board + plugs + crisp edges + metadata + connectors). */
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
    originalRotation: new THREE.Euler(0, 0, 0),
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

  // Crisp darker edge outline for visual definition
  if (renderMode !== "wireframe") {
    const edges = new THREE.EdgesGeometry(baseGeo, 30);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x111827,
      transparent: true,
      opacity: 0.28,
    });
    group.add(new THREE.LineSegments(edges, lineMat));
  }

  // Add 3D Connector Nodes
  buildConnectorNodes3D(part, thickness, group);

  return group;
}

/** Whole project → a group of extruded parts (placed or connected in 3D). */
export function buildProjectObject(
  project: Project,
  renderMode: RenderMode = "textured"
): THREE.Group {
  const root = new THREE.Group();
  const partGroupMap = new Map<string, THREE.Group>();

  for (const part of project.parts) {
    if (!part.visible) continue;

    // Only render parts that have been added to the 3D scene (placed === true)
    const placement = project.assembly.placements.find((pl) => pl.partId === part.id);
    const isPlaced = placement ? placement.placed : false;

    if (isPlaced) {
      const o = buildPartObject(project, part, renderMode);
      if (o) {
        if (placement) {
          o.position.set(placement.position.x, placement.position.y, placement.position.z);
          o.rotation.set(
            THREE.MathUtils.degToRad(placement.rotation.x),
            THREE.MathUtils.degToRad(placement.rotation.y),
            THREE.MathUtils.degToRad(placement.rotation.z)
          );
        }
        root.add(o);
        partGroupMap.set(part.id, o);
      }
    }
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
      child.userData.originalRotation = child.rotation.clone();
    });
  }

  // Build glowing 3D connection lines between connected joints
  const linesGroup = buildConnectionLines3D(project, partGroupMap);
  root.add(linesGroup);

  return root;
}

/** Build glowing 3D spring/laser lines between connected joints */
export function buildConnectionLines3D(
  project: Project,
  partGroupMap: Map<string, THREE.Group>
): THREE.Group {
  const linesGroup = new THREE.Group();
  linesGroup.name = "connection_lines";

  for (const cnx of project.assembly.connections) {
    const sourceGroup = partGroupMap.get(cnx.sourcePart);
    const targetGroup = partGroupMap.get(cnx.targetPart);
    if (!sourceGroup || !targetGroup) continue;

    const sourcePart = project.parts.find((p) => p.id === cnx.sourcePart);
    const targetPart = project.parts.find((p) => p.id === cnx.targetPart);
    if (!sourcePart || !targetPart) continue;

    const sourceConn = sourcePart.connectors.find((c) => c.id === cnx.sourceConnector);
    const targetConn = targetPart.connectors.find((c) => c.id === cnx.targetConnector);
    if (!sourceConn || !targetConn) continue;

    // Local positions
    const posA = new THREE.Vector3(sourceConn.position.x, -sourceConn.position.y, sourcePart.thickness / 2);
    const posB = new THREE.Vector3(targetConn.position.x, -targetConn.position.y, targetPart.thickness / 2);

    // Transform to World
    posA.applyMatrix4(sourceGroup.matrixWorld);
    posB.applyMatrix4(targetGroup.matrixWorld);

    const colorHex = cnx.status === "valid" ? 0x22c55e : cnx.status === "possible" ? 0xf59e0b : 0xef4444;

    const points = [posA, posB];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineDashedMaterial({
      color: colorHex,
      dashSize: 4,
      gapSize: 2,
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    linesGroup.add(line);
  }

  return linesGroup;
}

/**
 * 3D Mating Calculation Engine:
 * Calculates the target part's 3D position & rotation to mate flush onto source part.
 */
export function calculateMatingTransform(
  sourcePart: Part,
  sourceConn: Connector,
  targetPart: Part,
  targetConn: Connector,
  sourcePlacement?: Placement
): { position: Vec3; rotation: Vec3 } {
  // Source 3D position & orientation
  const sourcePos = sourcePlacement?.position ?? { x: sourcePart.transform.x, y: -sourcePart.transform.y, z: 0 };
  const sourceRot = sourcePlacement?.rotation ?? { x: 0, y: 0, z: sourcePart.transform.rotation };

  // Decide if perpendicular join (e.g. wall onto base: tab in slot, edge tab)
  const isPerpendicular =
    (sourceConn.type === "slot" && targetConn.type === "tab") ||
    (sourceConn.type === "hole" && targetConn.type === "peg") ||
    (sourceConn.type === "edge" || targetConn.type === "edge");

  const targetRotZ = (sourceRot.z + (sourceConn.orientation - targetConn.orientation)) % 360;
  const targetRotX = isPerpendicular ? 90 : sourceRot.x;
  const targetRotY = sourceRot.y;

  // Offset position so target connector snaps directly to source connector
  const sourceConnWorldX = sourcePos.x + sourceConn.position.x;
  const sourceConnWorldY = sourcePos.y - sourceConn.position.y;
  const sourceConnWorldZ = sourcePos.z + sourcePart.thickness;

  const targetPosX = sourceConnWorldX - targetConn.position.x;
  const targetPosY = sourceConnWorldY + targetConn.position.y;
  const targetPosZ = isPerpendicular ? sourceConnWorldZ : sourcePos.z;

  return {
    position: { x: targetPosX, y: targetPosY, z: targetPosZ },
    rotation: { x: targetRotX, y: targetRotY, z: targetRotZ },
  };
}

/**
 * Auto-Connect Engine:
 * Scans project for complementary connector pairs across parts and connects them in 3D.
 */
export function autoConnectProject(project: Project): void {
  const usedConnectors = new Set<string>();

  for (let i = 0; i < project.parts.length; i++) {
    const p1 = project.parts[i];
    for (let j = i + 1; j < project.parts.length; j++) {
      const p2 = project.parts[j];

      for (const c1 of p1.connectors) {
        if (usedConnectors.has(c1.id)) continue;

        for (const c2 of p2.connectors) {
          if (usedConnectors.has(c2.id)) continue;

          const compat = checkCompatibility({ part: p1, connector: c1 }, { part: p2, connector: c2 });
          if (compat.status === "valid" || compat.status === "possible") {
            usedConnectors.add(c1.id);
            usedConnectors.add(c2.id);

            // Create connection
            addConnection({
              sourcePart: p1.id,
              sourceConnector: c1.id,
              targetPart: p2.id,
              targetConnector: c2.id,
              status: compat.status,
              reason: compat.reason,
            });

            // Calculate 3D mating transform
            const mating = calculateMatingTransform(p1, c1, p2, c2);
            placePart(p2.id, mating.position, mating.rotation);
            break; // Move to next connector on p1
          }
        }
      }
    }
  }
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
