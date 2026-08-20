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
import { useProject } from "@/core/store/store";
import {
  addConnection,
  clear3DScene,
  createPart,
  placeAllParts,
  placePart,
  removeConnection,
  rotateConnector,
  setPartMaterial,
  unplacePart,
} from "@/core/store/actions";

import { checkCompatibility } from "@/core/connectors/compat";
import { materialOf } from "@/core/model/defaults";
import {
  autoConnectProject,
  applyExplodeFactor,
  buildProjectObject,
  calculateMatingTransform,
  disposeObject,
  type RenderMode,
} from "./build3d";

export type EnvTheme = "dark" | "workshop" | "light" | "cyber";

interface HoveredInfo {
  isConnector?: boolean;
  name: string;
  type?: string;
  role?: string;
  thickness?: number;
  material?: string;
  colorHex?: string;
  partName?: string;
  screenX: number;
  screenY: number;
}

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
  shadowPlane: THREE.Mesh | null;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  applyCameraImmediately: () => void;
  fit: (radius: number) => void;
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

function PartThumbnail({ part, materialColor }: { part: any; materialColor: string }): JSX.Element {
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

        {/* 3D Extruded Depth Bevel */}
        <rect
          x={rectX + 2.5}
          y={rectY + 3.5}
          width={svgW}
          height={svgH}
          rx={4}
          fill={adjustColor(materialColor, -50)}
        />

        {/* Main Panel Shape */}
        <rect
          x={rectX}
          y={rectY}
          width={svgW}
          height={svgH}
          rx={4}
          fill={`url(#grad-${part.id})`}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1.2"
          filter={`url(#shd-${part.id})`}
        />

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
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  // Viewport State Controls
  const [renderMode, setRenderMode] = useState<RenderMode>("textured");
  const [envTheme, setEnvTheme] = useState<EnvTheme>("dark");
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showConnectors, setShowConnectors] = useState<boolean>(true);
  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);


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

    const gridHelper = new THREE.GridHelper(
      1400,
      44,
      ENV_CONFIGS.dark.gridCenter,
      ENV_CONFIGS.dark.grid
    );
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -0.5;
    scene.add(gridHelper);

    const shadowGeo = new THREE.PlaneGeometry(2000, 2000);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.z = -1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const target = new THREE.Vector3(0, 0, 0);
    const targetGoal = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical(600, Math.PI / 3, Math.PI / 4);
    const sphericalGoal = new THREE.Spherical(600, Math.PI / 3, Math.PI / 4);

    const applyCameraImmediately = () => {
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    };

    const fit = (radius: number) => {
      const r = Math.max(radius, 40);
      const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.35;
      sphericalGoal.radius = dist;
      sphericalGoal.phi = Math.PI / 3;
      sphericalGoal.theta = Math.PI / 4;
      targetGoal.set(0, 0, 0);

      camera.near = Math.max(1, r / 100);
      camera.far = r * 300;
      camera.updateProjectionMatrix();

      keyLight.shadow.camera.left = -r * 2;
      keyLight.shadow.camera.right = r * 2;
      keyLight.shadow.camera.top = r * 2;
      keyLight.shadow.camera.bottom = -r * 2;
      keyLight.shadow.camera.updateProjectionMatrix();
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
      shadowPlane,
      keyLight,
      fillLight,
      rimLight,
      ambientLight,
      applyCameraImmediately,
      fit,
    };
    viewerRef.current = viewer;

    let dragging = false;
    let isPan = false;
    let px = 0;
    let py = 0;
    let downX = 0;
    let downY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      isPan = e.button === 2 || e.button === 1 || e.shiftKey;
      px = e.clientX;
      py = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;

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
    };

    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }

      const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moveDist < 5) {
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

    if (v.gridHelper) {
      v.scene.remove(v.gridHelper);
      v.gridHelper.geometry.dispose();
      v.gridHelper = new THREE.GridHelper(1400, 44, cfg.gridCenter, cfg.grid);
      v.gridHelper.rotation.x = Math.PI / 2;
      v.gridHelper.position.z = -0.5;
      v.gridHelper.visible = showGrid;
      v.scene.add(v.gridHelper);
    }
  }, [envTheme, showGrid]);

  /* ---- (Re)build meshes when project, renderMode, or placements change ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (v.group) {
      v.scene.remove(v.group);
      disposeObject(v.group);
      v.group = null;
    }

    const g = buildProjectObject(project, renderMode);
    const box = new THREE.Box3().setFromObject(g);
    if (!box.isEmpty()) {
      v.scene.add(g);
      v.group = g;

      if (explodeFactor > 0) {
        applyExplodeFactor(g, explodeFactor);
      }

      const sphere = box.getBoundingSphere(new THREE.Sphere());
      v.fit(sphere.radius);
    } else {
      v.scene.add(g);
      v.group = g;
    }
  }, [project, renderMode]);


  /* ---- Toggle 3D Connector Markers Visibility ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !v.group) return;
    v.group.traverse((obj) => {
      if (obj.userData && obj.userData.isConnector) {
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
    if (!v || !v.group || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), v.camera);

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

            showToast(`Connected ${p1.name} to ${p2.name}!`);
            setSelectedSourceConn(null);
          }
        }
        return;
      }
    }
  };

  /* ---- Interactive Pointer Move for Tooltip ---- */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = viewerRef.current;
    if (!v || !v.group || !mountRef.current) {
      setHoveredInfo(null);
      return;
    }

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), v.camera);

    const intersects = raycaster.intersectObjects(v.group.children, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const data = hit.userData;
      if (data && data.isConnector) {
        setHoveredInfo({
          isConnector: true,
          name: data.connectorName,
          type: data.connectorType,
          role: data.connectorRole,
          partName: data.partName,
          screenX: e.clientX,
          screenY: e.clientY,
        });
        return;
      } else if (data && data.partName) {
        setHoveredInfo({
          isConnector: false,
          name: data.partName,
          thickness: data.thickness,
          material: data.materialName,
          colorHex: data.colorHex ?? "#c8a25a",
          screenX: e.clientX,
          screenY: e.clientY,
        });
        return;
      }
    }
    setHoveredInfo(null);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAutoConnect = () => {
    autoConnectProject(project);
    showToast("Auto-connected all compatible joints in 3D!");
  };

  const handleAddPartToScene = (partId: string) => {
    const p = project.parts.find((x) => x.id === partId);
    if (!p) return;
    placePart(partId, { x: p.transform.x, y: -p.transform.y, z: 0 }, { x: 0, y: 0, z: p.transform.rotation });
    showToast(`Added ${p.name} to 3D scene`);
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

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const targetPt = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, targetPt);
    const dropPos = targetPt ? { x: Math.round(targetPt.x), y: Math.round(targetPt.y), z: 0 } : { x: 0, y: 0, z: 0 };

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

    // Check if dragging a Part
    const partId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("partId");
    if (partId) {
      const p = project.parts.find((x) => x.id === partId);
      if (!p) return;
      placePart(partId, dropPos, { x: 0, y: 0, z: p.transform.rotation });
      showToast(`Dragged & placed ${p.name} in 3D scene!`);
    }
  };



  const setCameraPreset = (preset: "iso" | "top" | "front" | "side" | "fit") => {
    const v = viewerRef.current;
    if (!v) return;

    if (preset === "fit") {
      if (v.group) {
        const box = new THREE.Box3().setFromObject(v.group);
        if (!box.isEmpty()) v.fit(box.getBoundingSphere(new THREE.Sphere()).radius);
      }
      return;
    }

    v.targetGoal.set(0, 0, 0);

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
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoveredInfo(null)}
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
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                    onClick={() => handleAddPartToScene(p.id)}
                    style={{ cursor: "pointer" }}
                    title="Click or drag onto 3D viewport to place"
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
          {/* View Preset Buttons */}
          <div className="wk-3d-btn-group">
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

          {/* Connections Drawer Toggle & Auto-Connect Button */}
          <button
            type="button"
            className={`wk-3d-btn ${showConnectors ? "wk-3d-btn--active" : ""}`}
            onClick={() => setShowConnectors(!showConnectors)}
            title="Toggle 3D interactive connector dots visibility"
          >
            {showConnectors ? "👁 Dots On" : "🙈 Dots Off"}
          </button>

          <button
            type="button"
            className={`wk-3d-btn ${showConnectionsPanel ? "wk-3d-btn--active" : ""}`}
            onClick={() => setShowConnectionsPanel(!showConnectionsPanel)}
          >
            ⚡ Connections ({project.assembly.connections.length})
          </button>


          <button
            type="button"
            className="wk-3d-btn"
            onClick={handleAutoConnect}
            title="Auto-connect all matching tab-slots and peg-holes in 3D"
            style={{ color: "var(--wk-accent-ink)", fontWeight: 700 }}
          >
            ✦ Auto-Connect All
          </button>
        </div>
      </div>

      {/* ---- Selected Source Connector Banner ---- */}
      {selectedSourceConn && (
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
      {showConnectionsPanel && (
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
                No 3D connections saved yet. Click connectors on 3D parts to link them, or hit <strong>Auto-Connect All</strong>!
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

      {/* ---- Dynamic Hover Inspection Tooltip ---- */}
      {hoveredInfo && (
        <div
          className="wk-3d-inspect-tooltip"
          style={{
            left: hoveredInfo.screenX,
            top: hoveredInfo.screenY,
          }}
        >
          {hoveredInfo.isConnector ? (
            <>
              <div className="wk-3d-inspect-title">
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: hoveredInfo.role === "insert" ? "#22c55e" : hoveredInfo.role === "receiver" ? "#3b82f6" : "#f59e0b",
                  }}
                />
                Connector: {hoveredInfo.name}
              </div>
              <div className="wk-3d-inspect-row">
                <span>Part:</span>
                <span className="wk-3d-inspect-val">{hoveredInfo.partName}</span>
              </div>
              <div className="wk-3d-inspect-row">
                <span>Type:</span>
                <span className="wk-3d-inspect-val" style={{ textTransform: "capitalize" }}>
                  {hoveredInfo.type} ({hoveredInfo.role})
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="wk-3d-inspect-title">
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: hoveredInfo.colorHex,
                  }}
                />
                {hoveredInfo.name}
              </div>
              <div className="wk-3d-inspect-row">
                <span>Material:</span>
                <span className="wk-3d-inspect-val">{hoveredInfo.material}</span>
              </div>
              <div className="wk-3d-inspect-row">
                <span>Thickness:</span>
                <span className="wk-3d-inspect-val">{hoveredInfo.thickness} mm</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
