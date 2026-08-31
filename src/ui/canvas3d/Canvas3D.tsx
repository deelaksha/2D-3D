/**
 * Canvas3D — High-fidelity interactive 3D Studio viewport, 3D Mating Engine,
 * and 3D Parts & Materials Library Sidebar.
 * Features:
 * - Studio lighting & soft contact shadow ground.
 * - Multi-theme environment backgrounds (Dark Studio, Warm Workshop, Clean Light, Cyber).
 * - Render modes (Textured wood grain, Solid color, Wireframe, X-Ray transparent).
 * - 3D Parts & Materials Library Sidebar for staging assembly one-by-one cleanly.
 * - Interactive 3D Connector Snapping & Click-to-Connect mating workflow.
 * - Auto-Connect All matching joints engine.
 * - Connections Management HUD Drawer.
 * - Viewport preset buttons (ISO, Top 2D, Front, Side, Fit view).
 * - Exploded assembly view slider (0% to 100% disassembly display).
 * - Auto-rotation presentation mode.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { store, useProject, useUI } from "@/core/store/store";
import {
  addConnection,
  clear3DScene,
  clearSelection,
  createPart,
  placeAllParts,
  placePart,
  removeConnection,
  rotateConnector,
  rotatePlacement3D,
  scalePlacement3D,
  selectOne,
  setPartMaterial,
  setPlacementMarker,
  unplacePart,
} from "@/core/store/actions";

import { checkCompatibility } from "@/core/connectors/compat";
import { boundsOfPoints, isClosedShape } from "@/core/geometry/outline";
import { partModifiersWorld, partOutlineWorld } from "@/core/geometry/world";
import { materialOf } from "@/core/model/defaults";
import {
  applyExplodeFactor,
  buildPlacementMarker3D,
  buildProjectObject,
  calculateMatingTransform,
  disposeObject,
  type GizmoAxis,
  type RenderMode,
  type TransformTool,
} from "./build3d";

/** Closest-point-between-two-lines: returns the signed distance along `axisDir`
 * (from `axisPoint`) to the point on that axis line nearest the ray. Used to
 * drive axis-constrained gizmo dragging (move/scale). */
function closestParamOnAxisToRay(ray: THREE.Ray, axisPoint: THREE.Vector3, axisDir: THREE.Vector3): number {
  const w0 = new THREE.Vector3().subVectors(ray.origin, axisPoint);
  const b = ray.direction.dot(axisDir);
  const d = ray.direction.dot(w0);
  const e = axisDir.dot(w0);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-6) return -e;
  return (e - b * d) / denom;
}

function computeGridSize(radius: number): { size: number; divisions: number } {
  const size = Math.max(200, Math.min(6000, Math.round((radius * 6) / 20) * 20));
  const divisions = Math.max(10, Math.min(60, Math.round(size / 25)));
  return { size, divisions };
}

type GizmoDrag =
  | {
      kind: "move";
      partId: string;
      axis: GizmoAxis;
      axisDir: THREE.Vector3;
      centerWorld: THREE.Vector3;
      startPos: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      t0: number;
    }
  | {
      kind: "rotate";
      partId: string;
      axis: GizmoAxis;
      axisDir: THREE.Vector3;
      centerWorld: THREE.Vector3;
      basisA: THREE.Vector3;
      basisB: THREE.Vector3;
      startRotation: { x: number; y: number; z: number };
      angle0: number;
    }
  | {
      kind: "scale";
      partId: string;
      axis: GizmoAxis;
      axisDir: THREE.Vector3;
      centerWorld: THREE.Vector3;
      startScale: { x: number; y: number; z: number };
      handleLength: number;
      t0: number;
    };

export type EnvTheme = "dark" | "workshop" | "light" | "cyber";



interface SelectedConnector {
  connectorId: string;
  partId: string;
  partName: string;
  connectorName: string;
  type: string;
  role: string;
}

interface Viewer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  targetGoal: THREE.Vector3;
  spherical: THREE.Spherical;
  sphericalGoal: THREE.Spherical;
  group: THREE.Group | null;
  gridHelper: THREE.GridHelper | null;
  gridColors: { grid: number; gridCenter: number };
  shadowPlane: THREE.Mesh | null;
  /** Visible crosshair/target showing the exact spot the next placed part lands at. */
  markerGroup: THREE.Group | null;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  applyCameraImmediately: () => void;
  /** Frame the camera on a world-space bounding box (auto-fit on load / selection). */
  frame: (box: THREE.Box3, opts?: { preserveAngle?: boolean }) => void;
  /** Resize the ground grid to stay proportionate to the current scene content. */
  setGridRadius: (radius: number) => void;
  /** Rebuild the grid using the current gridColors (after an env theme change). */
  rebuildGridColors: () => void;
}

const ENV_CONFIGS: Record<
  EnvTheme,
  { bg: number; grid: number; gridCenter: number; key: number; fill: number; ambient: number }
> = {
  dark: {
    bg: 0x0f1117,
    grid: 0x282e3d,
    gridCenter: 0x384054,
    key: 0xffffff,
    fill: 0x88aacc,
    ambient: 0x333b4d,
  },
  workshop: {
    bg: 0x1a1614,
    grid: 0x382a20,
    gridCenter: 0xef8c3b,
    key: 0xffe8d6,
    fill: 0xffaa55,
    ambient: 0x4a3425,
  },
  light: {
    bg: 0xf1f5f9,
    grid: 0xcbd5e1,
    gridCenter: 0x94a3b8,
    key: 0xffffff,
    fill: 0xddedff,
    ambient: 0x8899aa,
  },
  cyber: {
    bg: 0x080914,
    grid: 0x1e293b,
    gridCenter: 0x06b6d4,
    key: 0x38bdf8,
    fill: 0xf43f5e,
    ambient: 0x1e1b4b,
  },
};

function adjustColor(hex: string, amt: number): string {
  let usePound = false;
  if (hex[0] === "#") {
    hex = hex.slice(1);
    usePound = true;
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let b = ((num >> 8) & 0x00ff) + amt;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  let g = (num & 0x0000ff) + amt;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;
  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, "0");
}

export function PartThumbnail({ part, materialColor }: { part: any; materialColor: string }): JSX.Element {
  const aspect = part.height > 0 ? part.width / part.height : 1.5;
  let svgW = 110;
  let svgH = 65;

  if (aspect > 1.8) {
    svgW = 120;
    svgH = 50;
  } else if (aspect < 0.8) {
    svgW = 55;
    svgH = 75;
  } else {
    svgW = Math.min(110, Math.max(60, 65 * aspect));
    svgH = Math.min(75, Math.max(45, 65 / aspect));
  }

  const pad = 12;
  const viewBoxW = svgW + pad * 2;
  const viewBoxH = svgH + pad * 2;
  const rectX = pad;
  const rectY = pad;

  // Map the part's real 2D geometry (its actual shape outline, any flips/
  // rotation applied in the 2D editor, and any hole/insert modifiers) into
  // the thumbnail box, so the preview always matches what was drawn in 2D —
  // a circle previews as a circle, a rotated/mirrored hexagon previews
  // rotated/mirrored, a part with a cut hole previews with the hole, etc.
  const closed = isClosedShape(part.shape.kind);
  const outlineLoops = partOutlineWorld(part).filter((loop) => loop.length >= 2);
  const mods = closed ? partModifiersWorld(part) : [];
  const subtractLoops = mods.filter((m) => m.op === "subtract").flatMap((m) => m.loops);
  const unionLoops = mods.filter((m) => m.op === "union").flatMap((m) => m.loops);

  const bounds = boundsOfPoints([...outlineLoops, ...subtractLoops, ...unionLoops].flat());
  const boundsW = bounds.maxX - bounds.minX || 1;
  const boundsH = bounds.maxY - bounds.minY || 1;
  const shapeScaleX = svgW / boundsW;
  const shapeScaleY = svgH / boundsH;
  const loopsToPath = (loops: { x: number; y: number }[][], dx: number, dy: number): string =>
    loops
      .filter((loop) => loop.length >= 2)
      .map((loop) => {
        const pts = loop.map((p) => ({
          x: rectX + dx + (p.x - bounds.minX) * shapeScaleX,
          y: rectY + dy + (p.y - bounds.minY) * shapeScaleY,
        }));
        return `M ${pts[0].x} ${pts[0].y} ${pts
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ")}${closed ? " Z" : ""}`;
      })
      .join(" ");
  const shapePath = (dx: number, dy: number): string => loopsToPath([...outlineLoops, ...subtractLoops], dx, dy);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "10px 0",
        background: "var(--wk-surface-3)",
        borderRadius: "var(--wk-r2)",
        border: "1px solid var(--wk-border)",
        margin: "6px 0",
      }}
    >
      <svg width={viewBoxW} height={viewBoxH} viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`shd-${part.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
          </filter>
          <linearGradient id={`grad-${part.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={materialColor} />
            <stop offset="100%" stopColor={adjustColor(materialColor, -25)} />
          </linearGradient>
        </defs>

        {closed ? (
          <>
            {/* 3D Extruded Depth Bevel */}
            <path d={shapePath(2.5, 3.5)} fillRule="evenodd" fill={adjustColor(materialColor, -50)} />

            {/* insert/union modifiers painted under the base so only the protruding part shows */}
            {unionLoops.length > 0 && (
              <path d={loopsToPath(unionLoops, 0, 0)} fill={`url(#grad-${part.id})`} fillRule="evenodd" />
            )}

            {/* Main Panel Shape (even-odd so ring/hole loops render as cut-outs) */}
            <path
              d={shapePath(0, 0)}
              fillRule="evenodd"
              fill={`url(#grad-${part.id})`}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="1.2"
              filter={`url(#shd-${part.id})`}
            />
          </>
        ) : (
          // Open shapes (line/polyline/arc/bezier) preview as a stroke, not a filled blob.
          <path
            d={shapePath(0, 0)}
            fill="none"
            stroke={materialColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#shd-${part.id})`}
          />
        )}

        {/* Connector Notch Indicators on Edges */}
        {part.connectors?.map((c: any) => {
          const cx = rectX + (c.position.x / (part.width || 1)) * svgW;
          const cy = rectY + (c.position.y / (part.height || 1)) * svgH;
          const isInsert = c.role === "insert" || c.type === "tab" || c.type === "peg";
          const dotColor = isInsert ? "#22c55e" : c.role === "receiver" || c.type === "slot" ? "#3b82f6" : "#f59e0b";

          return (
            <g key={c.id}>
              <circle cx={cx} cy={cy} r={4} fill={dotColor} stroke="#ffffff" strokeWidth="1.2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Canvas3D(): JSX.Element {

  const project = useProject();
  const ui = useUI();
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const hasFramedRef = useRef(false);
  const lastSelectionKeyRef = useRef<string>("");
  const showGridRef = useRef(true);
  const markerPickModeRef = useRef(false);

  // Viewport State Controls
  const [renderMode, setRenderMode] = useState<RenderMode>("textured");
  const [envTheme, setEnvTheme] = useState<EnvTheme>("dark");
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showConnectors, setShowConnectors] = useState<boolean>(true);
  const [transformTool, setTransformTool] = useState<TransformTool>("move");
  // Click-to-place mode: when true, the next canvas click moves the placement
  // marker to the clicked point instead of selecting/connecting parts.
  const [markerPickMode, setMarkerPickMode] = useState<boolean>(false);

  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);

  useEffect(() => {
    markerPickModeRef.current = markerPickMode;
  }, [markerPickMode]);


  // 3D Mating & Connection Controls
  const [selectedSourceConn, setSelectedSourceConn] = useState<SelectedConnector | null>(null);
  const [showConnectionsPanel, setShowConnectionsPanel] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3D Library Sidebar Controls
  const [showLibrarySidebar, setShowLibrarySidebar] = useState<boolean>(true);


  /* ---- Placed vs Unplaced Parts Calculations ---- */
  const placedPartIds = new Set(
    project.assembly.placements.filter((pl) => pl.placed).map((pl) => pl.partId)
  );
  const placedParts = project.parts.filter((p) => placedPartIds.has(p.id));
  const unplacedParts = project.parts.filter((p) => !placedPartIds.has(p.id));

  /* ---- One-time scene & engine setup ---- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ENV_CONFIGS.dark.bg);

    const camera = new THREE.PerspectiveCamera(42, w / h, 1, 500000);

    const ambientLight = new THREE.AmbientLight(ENV_CONFIGS.dark.ambient, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(ENV_CONFIGS.dark.key, 1.4);
    keyLight.position.set(400, 700, 500);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 2000;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(ENV_CONFIGS.dark.fill, 0.6);
    fillLight.position.set(-500, -200, -300);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -600, 400);
    scene.add(rimLight);

    // Grid is sized dynamically (via setGridRadius) so it stays proportionate
    // to whatever content is in the scene instead of dwarfing small parts.
    const gridColors = { grid: ENV_CONFIGS.dark.grid, gridCenter: ENV_CONFIGS.dark.gridCenter };
    let lastGridRadius = 220;

    function buildGridHelper(radius: number): THREE.GridHelper {
      const { size, divisions } = computeGridSize(radius);
      const g = new THREE.GridHelper(size, divisions, gridColors.gridCenter, gridColors.grid);
      g.rotation.x = Math.PI / 2;
      g.position.z = -0.5;
      g.visible = showGridRef.current;
      const mat = g.material as THREE.Material;
      mat.transparent = true;
      mat.opacity = 0.7;
      return g;
    }

    let gridHelper = buildGridHelper(lastGridRadius);
    scene.add(gridHelper);

    const shadowGeo = new THREE.PlaneGeometry(4000, 4000);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const markerGroup = buildPlacementMarker3D();
    scene.add(markerGroup);

    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.z = -1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    scene.fog = new THREE.Fog(ENV_CONFIGS.dark.bg, 900, 3200);

    // Pre-fit-ish defaults; frame() re-centers and re-distances as soon as
    // real content loads, so this is just a sane placeholder before that.
    const target = new THREE.Vector3(0, 0, 0);
    const targetGoal = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical(320, Math.PI / 3, Math.PI / 4);
    const sphericalGoal = new THREE.Spherical(320, Math.PI / 3, Math.PI / 4);

    const applyCameraImmediately = () => {
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    };

    applyCameraImmediately();

    const viewer: Viewer = {
      renderer,
      scene,
      camera,
      target,
      targetGoal,
      spherical,
      sphericalGoal,
      group: null,
      gridHelper,
      gridColors,
      shadowPlane,
      markerGroup,
      keyLight,
      fillLight,
      rimLight,
      ambientLight,
      applyCameraImmediately,
      frame: () => {},
      setGridRadius: () => {},
      rebuildGridColors: () => {},
    };
    viewerRef.current = viewer;

    // Frame the camera on a world-space box: recenters the orbit target and
    // picks a distance that fills the viewport, so the selected/active object
    // is never left tiny-and-far-away or off-center.
    viewer.frame = (box: THREE.Box3, opts?: { preserveAngle?: boolean }) => {
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const r = Math.max(sphere.radius, 20);
      const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.6;

      targetGoal.copy(sphere.center);
      sphericalGoal.radius = dist;
      if (!opts?.preserveAngle) {
        sphericalGoal.phi = Math.PI / 3;
        sphericalGoal.theta = Math.PI / 4;
      }

      camera.near = Math.max(0.5, r / 100);
      camera.far = Math.max(4000, r * 300);
      camera.updateProjectionMatrix();

      keyLight.shadow.camera.left = -r * 3;
      keyLight.shadow.camera.right = r * 3;
      keyLight.shadow.camera.top = r * 3;
      keyLight.shadow.camera.bottom = -r * 3;
      keyLight.shadow.camera.updateProjectionMatrix();

      if (scene.fog && (scene.fog as THREE.Fog).isFog) {
        (scene.fog as THREE.Fog).near = r * 3.2;
        (scene.fog as THREE.Fog).far = r * 11;
      }
    };

    viewer.setGridRadius = (radius: number) => {
      const r = Math.max(20, radius);
      if (lastGridRadius > 0 && Math.abs(r - lastGridRadius) / lastGridRadius < 0.18) return;
      lastGridRadius = r;
      scene.remove(gridHelper);
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
      gridHelper = buildGridHelper(r);
      viewer.gridHelper = gridHelper;
      scene.add(gridHelper);
    };

    viewer.rebuildGridColors = () => {
      scene.remove(gridHelper);
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
      gridHelper = buildGridHelper(lastGridRadius);
      viewer.gridHelper = gridHelper;
      scene.add(gridHelper);
    };

    let dragging = false;
    let draggingPartId: string | null = null;
    let gizmoDrag: GizmoDrag | null = null;
    const dragPlane = new THREE.Plane();
    const dragOffset = new THREE.Vector3();
    let dragStartRot = { x: 0, y: 0, z: 0 };
    let isPan = false;
    let px = 0;
    let py = 0;
    let downX = 0;
    let downY = 0;

    const onDown = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      draggingPartId = null;
      gizmoDrag = null;

      isPan = e.button === 2 || e.button === 1 || e.shiftKey;

      if (e.button === 0 && !e.shiftKey && viewer.group && mount) {
        const rect = mount.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const intersects = raycaster.intersectObjects(viewer.group.children, true);

        // Gizmo handles always win over connectors/part bodies underneath them.
        const gizmoHit = intersects.find((hit) => hit.object.userData && hit.object.userData.isGizmoAxis);

        if (gizmoHit) {
          const gd = gizmoHit.object.userData as {
            gizmoMode: TransformTool;
            axis: GizmoAxis;
            partId: string;
            handleLength: number;
          };

          let gizmoRoot: THREE.Object3D | null = gizmoHit.object;
          while (gizmoRoot && gizmoRoot.name !== "transform_gizmo") gizmoRoot = gizmoRoot.parent;

          if (gizmoRoot) {
            gizmoRoot.updateWorldMatrix(true, false);
            const centerWorld = gizmoRoot.getWorldPosition(new THREE.Vector3());
            const worldQuat = new THREE.Quaternion();
            gizmoRoot.getWorldQuaternion(worldQuat);
            const axisLocal =
              gd.axis === "x"
                ? new THREE.Vector3(1, 0, 0)
                : gd.axis === "y"
                ? new THREE.Vector3(0, 1, 0)
                : new THREE.Vector3(0, 0, 1);
            const axisDir = axisLocal.applyQuaternion(worldQuat).normalize();

            const projectState = store.getState().project;
            const placement = projectState.assembly.placements.find((pl) => pl.partId === gd.partId);
            const startPos = placement?.position ?? { x: 0, y: 0, z: 0 };
            const startRot = placement?.rotation ?? { x: 0, y: 0, z: 0 };
            const startScale = placement?.scale ?? { x: 1, y: 1, z: 1 };

            selectOne(gd.partId);

            if (gd.gizmoMode === "rotate") {
              const up = Math.abs(axisDir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
              const basisA = new THREE.Vector3().crossVectors(up, axisDir).normalize();
              const basisB = new THREE.Vector3().crossVectors(axisDir, basisA).normalize();
              const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(axisDir, centerWorld);
              const hitPt = new THREE.Vector3();
              let angle0 = 0;
              if (raycaster.ray.intersectPlane(plane, hitPt)) {
                const v = hitPt.clone().sub(centerWorld);
                angle0 = Math.atan2(v.dot(basisB), v.dot(basisA));
              }
              gizmoDrag = {
                kind: "rotate",
                partId: gd.partId,
                axis: gd.axis,
                axisDir,
                centerWorld,
                basisA,
                basisB,
                startRotation: startRot,
                angle0,
              };
            } else if (gd.gizmoMode === "scale") {
              const t0 = closestParamOnAxisToRay(raycaster.ray, centerWorld, axisDir);
              gizmoDrag = {
                kind: "scale",
                partId: gd.partId,
                axis: gd.axis,
                axisDir,
                centerWorld,
                startScale,
                handleLength: gd.handleLength || 40,
                t0,
              };
            } else {
              const t0 = closestParamOnAxisToRay(raycaster.ray, centerWorld, axisDir);
              gizmoDrag = {
                kind: "move",
                partId: gd.partId,
                axis: gd.axis,
                axisDir,
                centerWorld,
                startPos,
                rotation: startRot,
                t0,
              };
            }
            renderer.domElement.style.cursor = "grabbing";
          }
        } else {
          for (const hit of intersects) {
            const data = hit.object.userData;
            if (data && data.isConnector) {
              break;
            }
            if (data && data.partId) {
              selectOne(data.partId);
              draggingPartId = data.partId;
              const projectState = store.getState().project;
              const placement = projectState.assembly.placements.find((pl) => pl.partId === data.partId);
              const partStartPos = placement?.position ?? { x: 0, y: 0, z: 0 };
              dragStartRot = placement?.rotation ?? { x: 0, y: 0, z: 0 };

              const camDir = new THREE.Vector3();
              camera.getWorldDirection(camDir);
              const dotZ = Math.abs(camDir.z);

              if (dotZ > 0.15) {
                dragPlane.set(new THREE.Vector3(0, 0, 1), -partStartPos.z);
              } else {
                camDir.negate();
                dragPlane.setFromNormalAndCoplanarPoint(camDir, hit.point);
              }

              const hitIntersect = new THREE.Vector3();
              const hasHit = raycaster.ray.intersectPlane(dragPlane, hitIntersect);
              if (hasHit) {
                dragOffset.subVectors(new THREE.Vector3(partStartPos.x, partStartPos.y, partStartPos.z), hitIntersect);
              } else {
                dragOffset.set(0, 0, 0);
              }

              renderer.domElement.style.cursor = "grabbing";
              break;
            }
          }
        }
      }

      if (!draggingPartId && !gizmoDrag) {
        dragging = true;
      }
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;

      if (gizmoDrag && mount) {
        const rect = mount.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

        if (gizmoDrag.kind === "move") {
          const t = closestParamOnAxisToRay(raycaster.ray, gizmoDrag.centerWorld, gizmoDrag.axisDir);
          const delta = t - gizmoDrag.t0;
          const newPos = new THREE.Vector3(
            gizmoDrag.startPos.x,
            gizmoDrag.startPos.y,
            gizmoDrag.startPos.z
          ).addScaledVector(gizmoDrag.axisDir, delta);
          placePart(
            gizmoDrag.partId,
            { x: Math.round(newPos.x), y: Math.round(newPos.y), z: Math.round(newPos.z) },
            gizmoDrag.rotation
          );
        } else if (gizmoDrag.kind === "rotate") {
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            gizmoDrag.axisDir,
            gizmoDrag.centerWorld
          );
          const hitPt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(plane, hitPt)) {
            const v = hitPt.clone().sub(gizmoDrag.centerWorld);
            const angleNow = Math.atan2(v.dot(gizmoDrag.basisB), v.dot(gizmoDrag.basisA));
            const deltaDeg = THREE.MathUtils.radToDeg(angleNow - gizmoDrag.angle0);
            const startRot = gizmoDrag.startRotation;
            const newRot = {
              x: startRot.x + (gizmoDrag.axis === "x" ? deltaDeg : 0),
              y: startRot.y + (gizmoDrag.axis === "y" ? deltaDeg : 0),
              z: startRot.z + (gizmoDrag.axis === "z" ? deltaDeg : 0),
            };
            rotatePlacement3D(gizmoDrag.partId, newRot);
          }
        } else if (gizmoDrag.kind === "scale") {
          const t = closestParamOnAxisToRay(raycaster.ray, gizmoDrag.centerWorld, gizmoDrag.axisDir);
          const delta = t - gizmoDrag.t0;
          const factor = Math.max(0.1, 1 + delta / gizmoDrag.handleLength);
          const startScale = gizmoDrag.startScale;
          const newScale = {
            x: gizmoDrag.axis === "x" ? startScale.x * factor : startScale.x,
            y: gizmoDrag.axis === "y" ? startScale.y * factor : startScale.y,
            z: gizmoDrag.axis === "z" ? startScale.z * factor : startScale.z,
          };
          scalePlacement3D(gizmoDrag.partId, newScale);
        }
        return;
      }

      if (draggingPartId && mount) {
        const rect = mount.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

        const intersectPt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
          const newPos = intersectPt.add(dragOffset);
          placePart(
            draggingPartId,
            { x: Math.round(newPos.x), y: Math.round(newPos.y), z: Math.round(newPos.z) },
            dragStartRot
          );
        }
        return;
      }

      if (dragging) {
        if (isPan) {
          const panSpeed = spherical.radius * 0.0012;
          const right = new THREE.Vector3();
          const up = new THREE.Vector3();
          camera.matrix.extractBasis(right, up, new THREE.Vector3());
          targetGoal.addScaledVector(right, -dx * panSpeed);
          targetGoal.addScaledVector(up, dy * panSpeed);
        } else {
          sphericalGoal.theta -= dx * 0.008;
          sphericalGoal.phi -= dy * 0.008;
          sphericalGoal.phi = Math.max(0.02, Math.min(Math.PI - 0.02, sphericalGoal.phi));
        }
        return;
      }

      if (viewer.group && mount && e.buttons === 0) {
        const rect = mount.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const intersects = raycaster.intersectObjects(viewer.group.children, true);
        let hitPart = false;
        for (const hit of intersects) {
          if (hit.object.userData && hit.object.userData.partId && !hit.object.userData.isConnector) {
            hitPart = true;
            break;
          }
        }
        renderer.domElement.style.cursor = hitPart ? "grab" : "default";
      }
    };

    const onUp = (e: PointerEvent) => {
      const wasGizmoDragging = !!gizmoDrag;
      draggingPartId = null;
      gizmoDrag = null;
      dragging = false;

      renderer.domElement.style.cursor = "default";
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }

      const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moveDist < 5 && !wasGizmoDragging) {
        handleCanvasClick(e.clientX, e.clientY);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = Math.exp(e.deltaY * 0.001);
      sphericalGoal.radius = Math.max(10, Math.min(300000, sphericalGoal.radius * zoomFactor));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    let raf = 0;
    const loop = () => {
      const damp = 0.15;
      spherical.radius += (sphericalGoal.radius - spherical.radius) * damp;
      spherical.phi += (sphericalGoal.phi - spherical.phi) * damp;
      spherical.theta += (sphericalGoal.theta - spherical.theta) * damp;
      target.lerp(targetGoal, damp);

      applyCameraImmediately();

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1;
      const nh = mount.clientHeight || 1;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);

      if (viewer.group) disposeObject(viewer.group);
      if (viewer.markerGroup) disposeObject(viewer.markerGroup);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      viewerRef.current = null;
    };
  }, []);

  /* ---- Auto-Rotate Effect ---- */
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      const v = viewerRef.current;
      if (v) v.sphericalGoal.theta += 0.008;
    }, 16);
    return () => clearInterval(interval);
  }, [autoRotate]);

  /* ---- Environment Theme Updating ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const cfg = ENV_CONFIGS[envTheme];
    v.scene.background = new THREE.Color(cfg.bg);
    v.ambientLight.color.setHex(cfg.ambient);
    v.keyLight.color.setHex(cfg.key);
    v.fillLight.color.setHex(cfg.fill);
    if (v.scene.fog && v.scene.fog instanceof THREE.Fog) {
      v.scene.fog.color.setHex(cfg.bg);
    }

    v.gridColors.grid = cfg.grid;
    v.gridColors.gridCenter = cfg.gridCenter;
    v.rebuildGridColors();
    if (v.gridHelper) {
      v.gridHelper.visible = showGrid;
    }
  }, [envTheme, showGrid]);

  /* ---- (Re)build meshes when project, renderMode, selection, or placements change ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (v.group) {
      v.scene.remove(v.group);
      disposeObject(v.group);
      v.group = null;
    }

    const g = buildProjectObject(project, renderMode, ui.selection, transformTool);
    const box = new THREE.Box3().setFromObject(g);
    v.scene.add(g);
    v.group = g;

    if (!box.isEmpty()) {
      if (explodeFactor > 0) {
        applyExplodeFactor(g, explodeFactor);
      }

      const sphere = box.getBoundingSphere(new THREE.Sphere());
      v.setGridRadius(sphere.radius);

      const selectionKey = [...ui.selection].sort().join(",");
      if (!hasFramedRef.current) {
        v.frame(box, { preserveAngle: false });
        hasFramedRef.current = true;
      } else if (selectionKey && selectionKey !== lastSelectionKeyRef.current) {
        const selBox = new THREE.Box3();
        let found = false;
        g.traverse((child) => {
          const data: any = child.userData;
          if (data && data.partId && !data.isGizmoAxis && ui.selection.includes(data.partId)) {
            selBox.expandByObject(child);
            found = true;
          }
        });
        if (found && !selBox.isEmpty()) {
          v.frame(selBox, { preserveAngle: true });
        }
      }
      lastSelectionKeyRef.current = selectionKey;
    }
  }, [project, renderMode, ui.selection, transformTool]);

  /* ---- Keep the placement marker crosshair in sync with ui.placementMarker ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !v.markerGroup) return;
    const { x, y, z } = ui.placementMarker;
    v.markerGroup.position.set(x, y, z);
  }, [ui.placementMarker]);


  /* ---- Toggle 3D Connector Markers Visibility ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !v.group) return;
    v.group.traverse((obj) => {
      if (obj.userData && (obj.userData.isConnector || obj.userData.isConnectorHalo)) {
        obj.visible = showConnectors;
      }
    });
  }, [showConnectors, project, renderMode]);


  /* ---- Handle Exploded Slider Changes ---- */
  const handleExplodeChange = (val: number) => {
    setExplodeFactor(val);
    const v = viewerRef.current;
    if (v && v.group) {
      applyExplodeFactor(v.group, val);
    }
  };

  /* ---- Interactive Canvas Click for Connector Mating ---- */
  const handleCanvasClick = (clientX: number, clientY: number) => {
    const v = viewerRef.current;
    if (!v || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), v.camera);

    // Click-to-place mode: move the marker to the clicked point instead of
    // running the normal selection/connector-mating click logic.
    if (markerPickModeRef.current) {
      let hitPoint: THREE.Vector3 | null = null;
      if (v.group) {
        const objHits = raycaster.intersectObjects(v.group.children, true);
        if (objHits.length > 0) hitPoint = objHits[0].point.clone();
      }
      if (!hitPoint) {
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const groundPlaneFlip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
        const targetPt = new THREE.Vector3();
        if (
          raycaster.ray.intersectPlane(groundPlane, targetPt) ||
          raycaster.ray.intersectPlane(groundPlaneFlip, targetPt)
        ) {
          hitPoint = targetPt;
        }
      }
      if (hitPoint) {
        const marker = { x: Math.round(hitPoint.x), y: Math.round(hitPoint.y), z: Math.round(hitPoint.z) };
        setPlacementMarker(marker);
        showToast(`Marker set to (${marker.x}, ${marker.y}, ${marker.z})`);
      }
      return;
    }

    if (!v.group) return;
    const intersects = raycaster.intersectObjects(v.group.children, true);
    for (const hit of intersects) {
      const data = hit.object.userData;
      if (data && data.isConnector) {
        const clickedConn: SelectedConnector = {
          connectorId: data.connectorId,
          partId: data.partId,
          partName: data.partName,
          connectorName: data.connectorName,
          type: data.connectorType,
          role: data.connectorRole,
        };

        if (!selectedSourceConn) {
          setSelectedSourceConn(clickedConn);
          showToast(`Selected source connector: ${clickedConn.partName} [${clickedConn.connectorName}]`);
        } else if (selectedSourceConn.connectorId === clickedConn.connectorId) {
          setSelectedSourceConn(null);
        } else if (selectedSourceConn.partId === clickedConn.partId) {
          setSelectedSourceConn(clickedConn);
        } else {
          const p1 = project.parts.find((p) => p.id === selectedSourceConn.partId);
          const c1 = p1?.connectors.find((c) => c.id === selectedSourceConn.connectorId);
          const p2 = project.parts.find((p) => p.id === clickedConn.partId);
          const c2 = p2?.connectors.find((c) => c.id === clickedConn.connectorId);

          if (p1 && c1 && p2 && c2) {
            const compat = checkCompatibility({ part: p1, connector: c1 }, { part: p2, connector: c2 });

            if (compat.status === "invalid") {
              showToast(`⚠ Can't connect ${c1.name} to ${c2.name}: ${compat.reason}`);
            } else {
              addConnection({
                sourcePart: p1.id,
                sourceConnector: c1.id,
                targetPart: p2.id,
                targetConnector: c2.id,
                status: compat.status,
                reason: compat.reason,
              });

              const mating = calculateMatingTransform(p1, c1, p2, c2);
              placePart(p2.id, mating.position, mating.rotation);

              showToast(
                compat.status === "possible"
                  ? `⚠ Connected ${p1.name} to ${p2.name}, but the fit is loose: ${compat.reason}`
                  : `Connected ${p1.name} to ${p2.name}!`
              );
            }
            setSelectedSourceConn(null);
          }
        }
        return;
      }
      if (data && data.partId) {
        selectOne(data.partId);
        showToast(`Selected ${data.partName}`);
        return;
      }
    }
    clearSelection();
  };



  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };



  const handleAddPartToScene = (partId: string) => {
    const p = project.parts.find((x) => x.id === partId);
    if (!p) return;
    placePart(partId, { ...ui.placementMarker }, { x: 0, y: 0, z: p.transform.rotation });
    showToast(`Added ${p.name} to 3D scene at marker (${ui.placementMarker.x}, ${ui.placementMarker.y}, ${ui.placementMarker.z})`);
  };

  const handleDropPartOnCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const v = viewerRef.current;
    if (!v || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), v.camera);

    let dropPos = { x: 0, y: 0, z: 0 };
    let hasDropPos = false;

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const targetPt = new THREE.Vector3();
    let hitGround = raycaster.ray.intersectPlane(groundPlane, targetPt);
    if (!hitGround) {
      const groundPlaneFlip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
      hitGround = raycaster.ray.intersectPlane(groundPlaneFlip, targetPt);
    }
    if (hitGround) {
      dropPos = { x: Math.round(targetPt.x), y: Math.round(targetPt.y), z: 0 };
      hasDropPos = true;
    }

    if (v.group) {
      const intersects = raycaster.intersectObjects(v.group.children, true);
      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.partId) {
          dropPos = {
            x: Math.round(hit.point.x),
            y: Math.round(hit.point.y),
            z: Math.round(hit.point.z),
          };
          hasDropPos = true;
          break;
        }
      }
    }

    // Check if dragging a Material
    const materialId = e.dataTransfer.getData("materialId");
    if (materialId) {
      const mat = project.materials.find((m) => m.id === materialId);
      if (!mat) return;

      // Check if dropped onto an existing 3D part
      if (v.group) {
        const intersects = raycaster.intersectObjects(v.group.children, true);
        for (const hit of intersects) {
          const data = hit.object.userData;
          if (data && data.partId) {
            setPartMaterial(data.partId, materialId);
            showToast(`Applied ${mat.name} material to ${data.partName}!`);
            return;
          }
        }
      }

      // Dropped onto canvas ground -> create a new part made of this material!
      const newPartId = createPart(`${mat.name} Board`, {
        materialId,
        width: 120,
        height: 80,
        thickness: mat.thickness,
      });
      placePart(newPartId, dropPos, { x: 0, y: 0, z: 0 });
      showToast(`Created & staged new ${mat.name} board in 3D!`);
      return;
    }

    // Check if dragging a Part — always lands exactly on the placement marker,
    // not wherever the cursor was dropped, so placement stays precise.
    const partId = e.dataTransfer.getData("partId") || e.dataTransfer.getData("text/plain");
    if (partId) {
      const p = project.parts.find((x) => x.id === partId);
      if (!p) return;
      placePart(partId, { ...ui.placementMarker }, { x: 0, y: 0, z: p.transform.rotation });
      showToast(`Dragged & placed ${p.name} at marker (${ui.placementMarker.x}, ${ui.placementMarker.y}, ${ui.placementMarker.z})`);
    }
  };



  const setCameraPreset = (preset: "iso" | "top" | "front" | "side" | "fit" | "reset") => {
    const v = viewerRef.current;
    if (!v) return;

    if (preset === "reset") {
      handleExplodeChange(0);
      setAutoRotate(false);
      if (v.group) {
        const box = new THREE.Box3().setFromObject(v.group);
        if (!box.isEmpty()) v.frame(box, { preserveAngle: false });
      }
      showToast("Viewport reset to original view!");
      return;
    }

    if (preset === "fit") {
      if (v.group) {
        const box = new THREE.Box3().setFromObject(v.group);
        if (!box.isEmpty()) v.frame(box, { preserveAngle: true });
      }
      return;
    }

    switch (preset) {
      case "iso":
        v.sphericalGoal.phi = Math.PI / 3;
        v.sphericalGoal.theta = Math.PI / 4;
        break;
      case "top":
        v.sphericalGoal.phi = 0.001;
        v.sphericalGoal.theta = 0;
        break;
      case "front":
        v.sphericalGoal.phi = Math.PI / 2;
        v.sphericalGoal.theta = 0;
        break;
      case "side":
        v.sphericalGoal.phi = Math.PI / 2;
        v.sphericalGoal.theta = Math.PI / 2;
        break;
    }
  };

  return (
    <div
      className="wk-canvas3d"
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropPartOnCanvas}
    >

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />



      {/* ---- Top-Left Studio Environment Selector ---- */}
      <div className="wk-3d-toolbar-top">
        <div className="wk-hud-glass">
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--wk-ink-faint)" }}>
            Studio
          </span>
          <div className="wk-3d-btn-group">
            {(["dark", "workshop", "light", "cyber"] as EnvTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`wk-3d-btn ${envTheme === t ? "wk-3d-btn--active" : ""}`}
                onClick={() => setEnvTheme(t)}
                style={{ textTransform: "capitalize" }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Placement Marker: exact target for the next placed part ---- */}
        <div className="wk-hud-glass" style={{ marginTop: 8, gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--wk-ink-faint)" }}>
            Marker
          </span>
          <button
            type="button"
            className={`wk-3d-btn ${markerPickMode ? "wk-3d-btn--active" : ""}`}
            onClick={() => setMarkerPickMode((v) => !v)}
            title="Click in the 3D scene to move the placement marker to that point"
          >
            🎯 {markerPickMode ? "Click scene to place…" : "Pick in Scene"}
          </button>
          <div style={{ width: 1, height: 20, background: "var(--wk-border)" }} />
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--wk-ink-soft)" }}>
              {axis.toUpperCase()}
              <input
                type="number"
                className="wk-input wk-input--num"
                value={ui.placementMarker[axis]}
                onChange={(e) =>
                  setPlacementMarker({ ...ui.placementMarker, [axis]: Number(e.target.value) || 0 })
                }
                style={{ width: 56, flex: "0 0 56px" }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* ---- Top-Right Render Modes, Presentation & Library Toggle ---- */}
      <div className="wk-3d-toolbar-right" style={{ right: showLibrarySidebar ? 344 : "var(--wk-s3)" }}>
        <div className="wk-hud-glass">
          <div className="wk-3d-btn-group">
            {(
              [
                { id: "textured", label: "Wood Grain" },
                { id: "solid", label: "Solid" },
                { id: "wireframe", label: "Wireframe" },
                { id: "xray", label: "X-Ray" },
              ] as { id: RenderMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`wk-3d-btn ${renderMode === m.id ? "wk-3d-btn--active" : ""}`}
                onClick={() => setRenderMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`wk-3d-btn ${autoRotate ? "wk-3d-btn--active" : ""}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title="Auto-rotate presentation spin"
          >
            ↻ Spin
          </button>
          <button
            type="button"
            className={`wk-3d-btn ${showLibrarySidebar ? "wk-3d-btn--active" : ""}`}
            onClick={() => setShowLibrarySidebar(!showLibrarySidebar)}
            title="Toggle 3D Parts & Materials Library Sidebar"
            style={{ fontWeight: 700 }}
          >
            📦 Library ({placedParts.length}/{project.parts.length})
          </button>
        </div>
      </div>

      {/* ---- Right-Side 3D Parts & Materials Library Sidebar ---- */}
      {showLibrarySidebar && (
        <div className="wk-hud-glass wk-3d-sidebar">
          {/* Header & Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--wk-ink-faint)" }}>
              3D Parts Library
            </span>
            <button
              type="button"
              className="wk-icon-btn"
              style={{ width: 22, height: 22, fontSize: 13 }}
              onClick={() => setShowLibrarySidebar(false)}
            >
              ✕
            </button>
          </div>

          {/* Unplaced Library Parts List */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {unplacedParts.length === 0 ? (
              <div style={{ color: "var(--wk-ink-faint)", fontSize: 12, textAlign: "center", padding: 16 }}>
                All designed parts are currently staged in your 3D scene!
                <button
                  type="button"
                  className="wk-btn wk-btn--ghost"
                  style={{ marginTop: 8, fontSize: 11, color: "var(--wk-accent-ink)", width: "100%", justifyContent: "center" }}
                  onClick={() => clear3DScene()}
                >
                  ↺ Reset & Stage One-by-One
                </button>
              </div>
            ) : (
              unplacedParts.map((p) => {
                const mat = materialOf(project, p.materialId);
                return (
                  <div
                    key={p.id}
                    className="wk-3d-library-card"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copyMove";
                      e.dataTransfer.setData("text/plain", p.id);
                      e.dataTransfer.setData("partId", p.id);
                    }}
                    style={{ cursor: "grab" }}
                    title="Drag onto 3D viewport to place at position, or click + Add"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--wk-ink)" }}>{p.name}</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: "var(--wk-r-pill)",
                          background: "var(--wk-surface-3)",
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: mat?.color ?? "#c8a25a" }} />
                        {mat?.name ?? "Wood"}
                      </span>
                    </div>
                    {/* Visual Naked-Eye 3D/2D Object Thumbnail Preview */}
                    <PartThumbnail part={p} materialColor={mat?.color ?? "#c8a25a"} />
                    <button
                      type="button"
                      className="wk-btn wk-btn--ghost"
                      style={{ fontSize: 11, width: "100%", justifyContent: "center", marginTop: 4 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddPartToScene(p.id);
                      }}
                    >
                      + Add to Scene
                    </button>
                  </div>
                );

              })
            )}
          </div>




          {/* Batch Staging Controls Footer */}
          <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 8, marginTop: 6, display: "flex", gap: 6 }}>
            <button
              type="button"
              className="wk-btn wk-btn--ghost"
              style={{ flex: 1, fontSize: 11, justifyContent: "center" }}
              onClick={() => placeAllParts()}
            >
              Place All
            </button>
            <button
              type="button"
              className="wk-btn wk-btn--ghost"
              style={{ flex: 1, fontSize: 11, color: "var(--wk-red)", justifyContent: "center" }}
              onClick={() => clear3DScene()}
            >
              Clear 3D Scene
            </button>
          </div>
        </div>
      )}

      {/* ---- Bottom-Center Floating Viewport Toolbar ---- */}
      <div className="wk-3d-toolbar">
        <div className="wk-hud-glass" style={{ gap: 14 }}>
          {/* Transform Tool Buttons (Blender-style Select / Move / Rotate / Scale) */}
          <div className="wk-3d-btn-group">
            {(
              [
                { id: "move", label: "⬌ Move" },
                { id: "rotate", label: "⟳ Rotate" },
                { id: "scale", label: "⤡ Scale" },
              ] as { id: TransformTool; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wk-3d-btn ${transformTool === t.id ? "wk-3d-btn--active" : ""}`}
                onClick={() => setTransformTool(t.id)}
                title={`Switch to ${t.id} tool for the selected object`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: "var(--wk-border)" }} />

          {/* View Preset Buttons */}
          <div className="wk-3d-btn-group">
            <button
              type="button"
              className="wk-3d-btn"
              onClick={() => setCameraPreset("reset")}
              title="Reset camera and scene to original view position & zoom"
            >
              ↺ RESET
            </button>
            <button type="button" className="wk-3d-btn" onClick={() => setCameraPreset("iso")}>
              ISO
            </button>
            <button type="button" className="wk-3d-btn" onClick={() => setCameraPreset("top")}>
              TOP
            </button>
            <button type="button" className="wk-3d-btn" onClick={() => setCameraPreset("front")}>
              FRONT
            </button>
            <button type="button" className="wk-3d-btn" onClick={() => setCameraPreset("side")}>
              SIDE
            </button>
            <button type="button" className="wk-3d-btn" onClick={() => setCameraPreset("fit")}>
              ⤢ FIT
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: "var(--wk-border)" }} />

          {/* Exploded Assembly Slider */}
          <div className="wk-3d-slider-container">
            <span className="wk-3d-slider-label">Explode</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explodeFactor}
              onChange={(e) => handleExplodeChange(parseFloat(e.target.value))}
              className="wk-3d-range"
            />
            <span style={{ fontSize: 11, fontFamily: "var(--wk-mono)", color: "var(--wk-ink-soft)", minWidth: 28 }}>
              {Math.round(explodeFactor * 100)}%
            </span>
          </div>

          <div style={{ width: 1, height: 20, background: "var(--wk-border)" }} />

        </div>
      </div>

      {/* ---- Selected Source Connector Banner ---- */}
      {selectedSourceConn && Boolean(false) && (
        <div
          className="wk-toast"
          style={{
            top: 60,
            bottom: "auto",
            background: "var(--wk-surface)",
            color: "var(--wk-ink)",
            border: "1px solid var(--wk-accent)",
            gap: 12,
          }}
        >
          <span>
            Connecting <strong>{selectedSourceConn.partName}</strong> [{selectedSourceConn.connectorName}] → Click target connector to mate!
          </span>
          <button
            type="button"
            className="wk-btn wk-btn--ghost"
            style={{ padding: "2px 8px", fontSize: 11, color: "var(--wk-accent-ink)" }}
            onClick={() => rotateConnector(selectedSourceConn.connectorId, 90)}
            title="Rotate connector orientation angle by 90 degrees"
          >
            ↻ Rotate 90°
          </button>
          <button
            type="button"
            className="wk-btn wk-btn--ghost"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={() => setSelectedSourceConn(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ---- Toast Notification ---- */}
      {toastMessage && <div className="wk-toast wk-toast--ok">{toastMessage}</div>}

      {/* ---- Connections Manager Overlay Drawer ---- */}
      {false && showConnectionsPanel && (
        <div
          className="wk-hud-glass"
          style={{
            position: "absolute",
            bottom: 72,
            right: showLibrarySidebar ? 344 : "var(--wk-s3)",
            width: 320,
            maxHeight: 360,
            flexDirection: "column",
            alignItems: "stretch",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>3D Saved Connections</span>
            <button
              type="button"
              className="wk-icon-btn"
              style={{ width: 22, height: 22, fontSize: 13 }}
              onClick={() => setShowConnectionsPanel(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {project.assembly.connections.length === 0 ? (
              <div style={{ color: "var(--wk-ink-faint)", fontSize: 12, textAlign: "center", padding: 12 }}>
                No 3D connections saved yet. Click connectors on 3D parts to link them!
              </div>
            ) : (
              project.assembly.connections.map((cnx) => {
                const sp = project.parts.find((p) => p.id === cnx.sourcePart);
                const tp = project.parts.find((p) => p.id === cnx.targetPart);
                const sc = sp?.connectors.find((c) => c.id === cnx.sourceConnector);
                const tc = tp?.connectors.find((c) => c.id === cnx.targetConnector);

                return (
                  <div
                    key={cnx.id}
                    style={{
                      background: "var(--wk-surface)",
                      border: "1px solid var(--wk-border)",
                      borderRadius: "var(--wk-r1)",
                      padding: "6px 10px",
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {sp?.name ?? "Part"} ➔ {tp?.name ?? "Part"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--wk-ink-faint)" }}>
                        {sc?.name ?? "Conn"} ({sc?.type}) ⇄ {tc?.name ?? "Conn"} ({tc?.type})
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wk-btn wk-btn--ghost"
                      style={{ padding: "2px 6px", color: "var(--wk-red)", fontSize: 11 }}
                      onClick={() => removeConnection(cnx.id)}
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}


    </div>
  );
}
