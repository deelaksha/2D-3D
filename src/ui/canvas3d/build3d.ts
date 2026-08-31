/**
 * build3d — turns the SAME 2D Project model into high-fidelity Three.js meshes
 * for the 3D preview. Read-only: each part's 2D outline is extruded by its
 * thickness, styled with procedural PBR materials (realistic wood grain, satin,
 * wireframe, or X-ray modes), tagged with inspect metadata, and prepared for
 * exploded assembly views, interactive 3D connector snapping, and mating lines.
 */
import * as THREE from "three";
import type { Connection, Connector, Part, Placement, Project, Vec2, Vec3 } from "@/core/model/types";
import { shapeOutline } from "@/core/geometry/outline";
import { materialOf } from "@/core/model/defaults";
import { connectorRole, defaultRole } from "@/core/connectors/feature";
import { connectorStatuses } from "@/core/assembly/validate";
import { mateRotationZ, mateTargetXY } from "@/core/connectors/mate";

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

/**
 * Apply a part's 2D mirror/scale (flipX/flipY, scaleX/scaleY) to a
 * local-frame outline point, so the 3D extrusion matches the same shape the
 * 2D canvas draws (see partToWorld in core/geometry/world.ts). Rotation and
 * position are layered on afterwards via the part's 3D placement instead of
 * being baked into the geometry here.
 */
export function applyPartOrientation(part: Part, p: Vec2): Vec2 {
  const t = part.transform;
  return {
    x: p.x * (t.scaleX || 1) * (t.flipX ? -1 : 1),
    y: p.y * (t.scaleY || 1) * (t.flipY ? -1 : 1),
  };
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
export function createPartMaterial(
  colorHex: string,
  renderMode: RenderMode = "textured",
  isSelected = false
): THREE.Material {
  const baseColor = new THREE.Color(isSelected ? "#2563eb" : colorHex);

  switch (renderMode) {
    case "wireframe":
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        wireframe: true,
        roughness: 0.3,
        metalness: 0.2,
        emissive: isSelected ? new THREE.Color("#1d4ed8") : new THREE.Color("#000000"),
      });

    case "xray":
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transparent: true,
        opacity: isSelected ? 0.75 : 0.38,
        roughness: 0.15,
        transmission: isSelected ? 0.3 : 0.6,
        thickness: 2,
        clearcoat: 0.5,
        emissive: isSelected ? new THREE.Color("#1e40af") : new THREE.Color("#000000"),
      });

    case "solid":
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.35,
        metalness: isSelected ? 0.2 : 0.08,
        emissive: isSelected ? new THREE.Color("#1e3a8a") : new THREE.Color("#000000"),
      });

    case "textured":
    default: {
      const map = getProceduralWoodTexture(isSelected ? "#2563eb" : colorHex);
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        map,
        roughness: 0.45,
        metalness: isSelected ? 0.15 : 0.04,
        emissive: isSelected ? new THREE.Color("#1e3a8a") : new THREE.Color("#000000"),
      });
    }
  }
}

export type TransformTool = "move" | "rotate" | "scale";
export type GizmoAxis = "x" | "y" | "z";

const AXIS_COLORS: Record<GizmoAxis, number> = { x: 0xef4444, y: 0x22c55e, z: 0x3b82f6 };

/** Orient a gizmo part built along local +Y so it points along the requested world axis. */
function orientAlongAxis(obj: THREE.Object3D, axis: GizmoAxis): void {
  if (axis === "x") obj.rotation.z = -Math.PI / 2;
  else if (axis === "z") obj.rotation.x = Math.PI / 2;
  // "y" needs no rotation — geometry is already built along +Y.
}

function tagGizmoHandle(
  obj: THREE.Object3D,
  data: { isGizmoAxis: true; gizmoMode: TransformTool; axis: GizmoAxis; partId: string; handleLength: number }
): void {
  obj.userData = data;
  obj.renderOrder = 999;
  obj.traverse((c) => {
    c.userData = data;
    c.renderOrder = 999;
  });
}

/** Move handle: a shaft + cone arrowhead along one axis, click-draggable to translate. */
function buildMoveHandle(axis: GizmoAxis, length: number, partId: string): THREE.Group {
  const color = AXIS_COLORS[axis];
  const shaftLen = length * 0.78;
  const headLen = length * 0.24;
  const shaftRadius = Math.max(0.9, length * 0.028);
  const headRadius = shaftRadius * 2.6;

  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 10), mat);
  shaft.position.y = shaftLen / 2;
  group.add(shaft);

  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLen, 14), mat);
  head.position.y = shaftLen + headLen / 2;
  group.add(head);

  orientAlongAxis(group, axis);
  tagGizmoHandle(group, { isGizmoAxis: true, gizmoMode: "move", axis, partId, handleLength: length });
  return group;
}

/** Rotate handle: a ring around one axis, click-draggable to spin the part about that axis. */
function buildRotateHandle(axis: GizmoAxis, radius: number, partId: string): THREE.Group {
  const color = AXIS_COLORS[axis];
  const tube = Math.max(0.7, radius * 0.045);
  const mat = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 64), mat);

  // TorusGeometry's ring normal is +Z by default; rotate so the ring wraps the requested axis.
  if (axis === "x") mesh.rotation.y = Math.PI / 2;
  else if (axis === "y") mesh.rotation.x = Math.PI / 2;

  const group = new THREE.Group();
  group.add(mesh);
  tagGizmoHandle(group, { isGizmoAxis: true, gizmoMode: "rotate", axis, partId, handleLength: radius });
  return group;
}

/** Scale handle: a shaft + cube head along one axis, click-draggable to scale the part. */
function buildScaleHandle(axis: GizmoAxis, length: number, partId: string): THREE.Group {
  const color = AXIS_COLORS[axis];
  const shaftLen = length * 0.8;
  const headSize = Math.max(3, length * 0.14);
  const shaftRadius = Math.max(0.9, length * 0.028);

  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 10), mat);
  shaft.position.y = shaftLen / 2;
  group.add(shaft);

  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), mat);
  head.position.y = shaftLen + headSize / 2;
  group.add(head);

  orientAlongAxis(group, axis);
  tagGizmoHandle(group, { isGizmoAxis: true, gizmoMode: "scale", axis, partId, handleLength: length });
  return group;
}

/** Build the Blender-like 3D transform gizmo (Move / Rotate / Scale) for the selected part. */
export function buildTransformGizmo3D(
  partId: string,
  maxDim: number,
  mode: TransformTool = "move"
): THREE.Group {
  const gizmo = new THREE.Group();
  gizmo.name = "transform_gizmo";
  gizmo.renderOrder = 999;

  const axes: GizmoAxis[] = ["x", "y", "z"];
  if (mode === "rotate") {
    const radius = Math.max(22, maxDim * 0.62);
    axes.forEach((axis) => gizmo.add(buildRotateHandle(axis, radius, partId)));
  } else if (mode === "scale") {
    const length = Math.max(28, maxDim * 0.85);
    axes.forEach((axis) => gizmo.add(buildScaleHandle(axis, length, partId)));
  } else {
    const length = Math.max(28, maxDim * 0.9);
    axes.forEach((axis) => gizmo.add(buildMoveHandle(axis, length, partId)));
  }

  // Small anchor dot at the gizmo origin so it reads clearly as attached to the object.
  const centerDot = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(1.6, maxDim * 0.022), 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.85 })
  );
  centerDot.renderOrder = 999;
  gizmo.add(centerDot);

  return gizmo;
}

const PLACEMENT_MARKER_COLOR = 0xffdd00;

/** Build the 3D placement marker — a crosshair/target showing exactly where the
 * next part will be placed. Drawn through the world origin of its own group so
 * moving the group (marker position) moves the whole crosshair as one unit. */
export function buildPlacementMarker3D(size = 18): THREE.Group {
  const marker = new THREE.Group();
  marker.name = "placement_marker";
  marker.renderOrder = 1000;

  const lineMat = new THREE.LineBasicMaterial({
    color: PLACEMENT_MARKER_COLOR,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });

  const axes: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const [ax, ay, az] of axes) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-ax * size, -ay * size, -az * size),
      new THREE.Vector3(ax * size, ay * size, az * size),
    ]);
    const line = new THREE.Line(geo, lineMat);
    line.renderOrder = 1000;
    marker.add(line);
  }

  // Ring around the crosshair (in the XZ ground plane) so the marker reads
  // clearly as a "target" from a top-down camera angle, not just axis spikes.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.55, Math.max(0.6, size * 0.04), 8, 32),
    new THREE.MeshBasicMaterial({
      color: PLACEMENT_MARKER_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 1000;
  marker.add(ring);

  const centerDot = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(1.2, size * 0.08), 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    })
  );
  centerDot.renderOrder = 1000;
  marker.add(centerDot);

  return marker;
}

/** Build interactive 3D Connector sphere markers on a part group */
export function buildConnectorNodes3D(part: Part, thickness: number, group: THREE.Group, unmatchedIds?: Set<string>): void {
  for (const c of part.connectors) {
    const role = connectorRole(c);
    let colorHex = 0xf59e0b; // Amber neutral
    if (role === "custom" || c.type === "custom") {
      colorHex = 0xa855f7; // Purple custom
    } else if (role === "insert") {
      colorHex = 0x22c55e; // Green insert
    } else if (role === "receiver") {
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
    const posX = c.position.x;
    const posY = -c.position.y;
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

    if (unmatchedIds?.has(c.id)) {
      const haloGeo = new THREE.SphereGeometry(Math.max(4, Math.min(8, (c.width || 10) / 2)) * 1.6, 12, 12);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(marker.position);
      halo.renderOrder = 999;
      halo.userData = { isConnectorHalo: true, connectorId: c.id, partId: part.id };
      group.add(halo);
    }
  }
}

/** One part → a 3D object (extruded board + plugs + crisp edges + metadata + connectors). */
export function buildPartObject(
  project: Project,
  part: Part,
  renderMode: RenderMode = "textured",
  isSelected = false,
  transformTool: TransformTool = "move",
  unmatchedIds?: Set<string>
): THREE.Group | null {
  const orient = (pts: Vec2[]): Vec2[] => pts.map((p) => applyPartOrientation(part, p));

  const loops = shapeOutline(part.shape).map(orient);
  const outer = loops[0];
  if (!outer || outer.length < 3) return null;

  const mods = part.modifiers.map((m) => ({
    op: m.op,
    loops: shapeOutline(m.shape).map(orient),
  }));
  const subtract = mods.filter((m) => m.op === "subtract").flatMap((m) => m.loops);
  const union = mods.filter((m) => m.op === "union").flatMap((m) => m.loops);
  const holes = [...loops.slice(1), ...subtract];

  const thickness = Math.max(0.6, part.thickness || 4);
  const matObj = materialOf(project, part.materialId);
  const colorHex = matObj?.color ?? "#c8a25a";
  const mat = createPartMaterial(colorHex, renderMode, isSelected);

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

  // Crisp edge outline for visual definition (blue highlight when selected)
  if (renderMode !== "wireframe") {
    const edges = new THREE.EdgesGeometry(baseGeo, 30);
    const lineMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x60a5fa : 0x111827,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.28,
    });
    group.add(new THREE.LineSegments(edges, lineMat));
  }

  // Add 3D Connector Nodes
  buildConnectorNodes3D(part, thickness, group, unmatchedIds);

  // Attach 3D Axis Transform Gizmo when selected — anchored at the part's own
  // geometric center (not the local origin, which is usually a corner) so it
  // reads as attached to the object rather than floating off to one side.
  if (isSelected) {
    const maxDim = Math.max(part.width || 40, part.height || 40, thickness);
    const gizmo = buildTransformGizmo3D(part.id, maxDim, transformTool);
    baseGeo.computeBoundingBox();
    const localCenter = new THREE.Vector3();
    baseGeo.boundingBox?.getCenter(localCenter);
    gizmo.position.copy(localCenter);
    group.add(gizmo);
    group.userData.gizmoLocalCenter = localCenter.clone();
  }

  return group;
}

/** Whole project → a group of extruded parts (placed or connected in 3D). */
export function buildProjectObject(
  project: Project,
  renderMode: RenderMode = "textured",
  selection: string[] = [],
  transformTool: TransformTool = "move"
): THREE.Group {
  const root = new THREE.Group();
  const partGroupMap = new Map<string, THREE.Group>();
  const unmatchedIds = new Set(
    connectorStatuses(project)
      .filter((s) => s.state === "unmatched")
      .map((s) => s.connectorId)
  );

  for (const part of project.parts) {
    if (!part.visible) continue;

    // Only render parts that have been added to the 3D scene (placed === true)
    const placement = project.assembly.placements.find((pl) => pl.partId === part.id);
    const isPlaced = placement ? placement.placed : false;

    if (isPlaced) {
      const isSelected = selection.includes(part.id);
      const o = buildPartObject(project, part, renderMode, isSelected, transformTool, unmatchedIds);
      if (o) {
        if (placement) {
          o.position.set(placement.position.x, placement.position.y, placement.position.z);
          o.rotation.set(
            THREE.MathUtils.degToRad(placement.rotation.x),
            THREE.MathUtils.degToRad(placement.rotation.y),
            THREE.MathUtils.degToRad(placement.rotation.z)
          );
          if (placement.scale) {
            o.scale.set(placement.scale.x || 1, placement.scale.y || 1, placement.scale.z || 1);
          }
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

  const targetRotZ = mateRotationZ(sourceRot.z, sourceConn.orientation, targetConn.orientation);
  const targetRotX = isPerpendicular ? 90 : sourceRot.x;
  const targetRotY = sourceRot.y;

  // Offset position so target connector snaps directly to source connector
  const targetXY = mateTargetXY(sourcePos, sourceRot.z, sourceConn.position, targetRotZ, targetConn.position);
  const sourceConnWorldZ = sourcePos.z + sourcePart.thickness;
  const targetPosZ = isPerpendicular ? sourceConnWorldZ : sourcePos.z;

  return {
    position: { x: targetXY.x, y: targetXY.y, z: targetPosZ },
    rotation: { x: targetRotX, y: targetRotY, z: targetRotZ },
  };
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
