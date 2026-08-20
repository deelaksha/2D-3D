/**
 * Canvas3D — High-fidelity interactive 3D Studio viewport.
 * Features:
 * - Studio lighting & soft contact shadow ground.
 * - Multi-theme environment backgrounds (Dark Studio, Warm Workshop, Clean Light, Cyber).
 * - Render modes (Textured wood grain, Solid color, Wireframe, X-Ray transparent).
 * - Smooth camera damping, panning (Right click / Shift drag), orbiting & zoom.
 * - Viewport preset buttons (ISO, Top 2D, Front, Side, Fit view).
 * - Exploded assembly view slider (0% to 100% disassembly display).
 * - Auto-rotation presentation mode.
 * - Dynamic 3D raycasting with interactive part hover inspection tooltips.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useProject } from "@/core/store/store";
import {
  buildProjectObject,
  disposeObject,
  applyExplodeFactor,
  type RenderMode,
} from "./build3d";

export type EnvTheme = "dark" | "workshop" | "light" | "cyber";

interface HoveredPart {
  name: string;
  thickness: number;
  material: string;
  colorHex: string;
  screenX: number;
  screenY: number;
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
  const [hoveredPart, setHoveredPart] = useState<HoveredPart | null>(null);

  /* ---- One-time scene & engine setup ---- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;

    // Renderer setup with shadow maps & ACES tone mapping
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

    // Studio Lighting setup
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

    // Dynamic Grid Floor
    const gridHelper = new THREE.GridHelper(
      1200,
      40,
      ENV_CONFIGS.dark.gridCenter,
      ENV_CONFIGS.dark.grid
    );
    gridHelper.rotation.x = Math.PI / 2; // Lie flat in X-Y plan
    gridHelper.position.z = -0.5;
    scene.add(gridHelper);

    // Contact Shadow Receiver Plane
    const shadowGeo = new THREE.PlaneGeometry(2000, 2000);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.z = -1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Camera spherical orbit targets & inertia goals
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

      // Set key light shadow frustum size dynamically
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

    /* ---- Pointer Controls (Orbit, Pan, Zoom) ---- */
    let dragging = false;
    let isPan = false;
    let px = 0;
    let py = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      isPan = e.button === 2 || e.button === 1 || e.shiftKey;
      px = e.clientX;
      py = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      px = e.clientX;
      py = e.clientY;

      if (isPan) {
        // Pan parallel to view camera
        const panSpeed = spherical.radius * 0.0012;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.matrix.extractBasis(right, up, new THREE.Vector3());
        targetGoal.addScaledVector(right, -dx * panSpeed);
        targetGoal.addScaledVector(up, dy * panSpeed);
      } else {
        // Orbit around target
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

    /* ---- Main Animation / Render Loop with Damping ---- */
    let raf = 0;
    const loop = () => {
      // Smooth camera interpolation (damping)
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

    // Resize observer
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
      if (v) {
        v.sphericalGoal.theta += 0.008;
      }
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

  /* ---- (Re)build meshes when design or renderMode changes ---- */
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
      const center = box.getCenter(new THREE.Vector3());
      g.position.sub(center); // Recentralise whole project at origin
      v.scene.add(g);
      v.group = g;

      // Re-apply exploded factor if non-zero
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

  /* ---- Handle Exploded Slider Changes ---- */
  const handleExplodeChange = (val: number) => {
    setExplodeFactor(val);
    const v = viewerRef.current;
    if (v && v.group) {
      applyExplodeFactor(v.group, val);
    }
  };

  /* ---- Interactive Raycasting for Hover Tooltip ---- */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = viewerRef.current;
    if (!v || !v.group || !mountRef.current) {
      setHoveredPart(null);
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
      if (data && data.partName) {
        setHoveredPart({
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
    setHoveredPart(null);
  };

  /* ---- Preset Camera Angles ---- */
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
      onPointerLeave={() => setHoveredPart(null)}
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

      {/* ---- Top-Right Render Modes & Presentation ---- */}
      <div className="wk-3d-toolbar-right">
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
        </div>
      </div>

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

          {/* Grid Toggle */}
          <button
            type="button"
            className={`wk-3d-btn ${showGrid ? "wk-3d-btn--active" : ""}`}
            onClick={() => setShowGrid(!showGrid)}
          >
            # Grid
          </button>
        </div>
      </div>

      {/* ---- Dynamic Hover Part Inspection Tooltip ---- */}
      {hoveredPart && (
        <div
          className="wk-3d-inspect-tooltip"
          style={{
            left: hoveredPart.screenX,
            top: hoveredPart.screenY,
          }}
        >
          <div className="wk-3d-inspect-title">
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: hoveredPart.colorHex,
              }}
            />
            {hoveredPart.name}
          </div>
          <div className="wk-3d-inspect-row">
            <span>Material:</span>
            <span className="wk-3d-inspect-val">{hoveredPart.material}</span>
          </div>
          <div className="wk-3d-inspect-row">
            <span>Thickness:</span>
            <span className="wk-3d-inspect-val">{hoveredPart.thickness} mm</span>
          </div>
        </div>
      )}
    </div>
  );
}
