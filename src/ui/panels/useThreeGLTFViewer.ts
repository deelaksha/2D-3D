import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export type ViewerFormat = "glb" | "gltf" | "obj";

export interface ThreeGLTFViewerState {
  loading: boolean;
  error: string | null;
  wireframe: boolean;
  showGrid: boolean;
  toggleWireframe: () => void;
  toggleGrid: () => void;
  resetCamera: () => void;
}

/**
 * React hook that manages a Three.js render loop, GLTF/OBJ loading, and orbit controls.
 * Attaches to a <canvas> ref provided by the caller.
 */
export function useThreeGLTFViewer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  modelUrl: string | null,
  format: ViewerFormat = "glb"
): ThreeGLTFViewerState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Store scene references in a ref so they persist across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const rafRef = useRef<number | null>(null);

  // Orbit state
  const orbitRef = useRef({
    dragging: false,
    rightDragging: false,
    lastX: 0,
    lastY: 0,
    phi: Math.PI / 4,    // vertical angle
    theta: Math.PI / 4,  // horizontal angle
    radius: 200,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  });

  // ── Initialize Three.js scene ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d23);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 10000);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(-100, -50, -100);
    scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(400, 20, 0x444455, 0x333340);
    scene.add(grid);
    gridRef.current = grid;

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const o = orbitRef.current;
      const x = o.targetX + o.radius * Math.sin(o.phi) * Math.sin(o.theta);
      const y = o.targetY + o.radius * Math.cos(o.phi);
      const z = o.targetZ + o.radius * Math.sin(o.phi) * Math.cos(o.theta);
      camera.position.set(x, y, z);
      camera.lookAt(o.targetX, o.targetY, o.targetZ);
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    // Pointer events for orbit / pan / zoom
    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 2) orbitRef.current.rightDragging = true;
      else orbitRef.current.dragging = true;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      const o = orbitRef.current;
      const dx = e.clientX - o.lastX;
      const dy = e.clientY - o.lastY;
      o.lastX = e.clientX;
      o.lastY = e.clientY;

      if (o.dragging) {
        o.theta -= dx * 0.01;
        o.phi = Math.max(0.05, Math.min(Math.PI - 0.05, o.phi - dy * 0.01));
      }
      if (o.rightDragging) {
        const factor = o.radius * 0.002;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        if (cameraRef.current) {
          cameraRef.current.getWorldDirection(up);
          right.crossVectors(up, cameraRef.current.up).normalize();
        }
        o.targetX -= right.x * dx * factor;
        o.targetY += dy * factor;
        o.targetZ -= right.z * dx * factor;
      }
    };
    const onPointerUp = () => {
      orbitRef.current.dragging = false;
      orbitRef.current.rightDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius = Math.max(10, Math.min(5000, orbitRef.current.radius * (1 + e.deltaY * 0.001)));
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      renderer.dispose();
    };
  }, [canvasRef]);

  // ── Load model when URL changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Remove existing model
    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      modelGroupRef.current = null;
    }

    setLoading(true);
    setError(null);

    const onLoad = (group: THREE.Group) => {
      modelGroupRef.current = group;
      scene.add(group);

      // Auto-fit camera
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      const o = orbitRef.current;
      o.targetX = center.x;
      o.targetY = center.y;
      o.targetZ = center.z;
      o.radius = maxDim * 2.2;
      o.phi = Math.PI / 3;
      o.theta = Math.PI / 4;

      // Snap grid to bottom of model
      if (gridRef.current) gridRef.current.position.y = box.min.y;

      setLoading(false);
    };

    const onError = (e: any) => {
      setError(`Failed to load 3D model: ${e?.message || e}`);
      setLoading(false);
    };

    if (format === "obj") {
      const loader = new OBJLoader();
      loader.load(modelUrl, onLoad, undefined, onError);
    } else {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => onLoad(gltf.scene),
        undefined,
        onError
      );
    }
  }, [modelUrl, format]);

  // ── Wireframe toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => ((m as THREE.MeshStandardMaterial).wireframe = wireframe));
      }
    });
  }, [wireframe]);

  // ── Grid visibility ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  const resetCamera = () => {
    const o = orbitRef.current;
    o.phi = Math.PI / 3;
    o.theta = Math.PI / 4;
    if (modelGroupRef.current) {
      const box = new THREE.Box3().setFromObject(modelGroupRef.current);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      o.targetX = center.x;
      o.targetY = center.y;
      o.targetZ = center.z;
      o.radius = maxDim * 2.2;
    }
  };

  return {
    loading,
    error,
    wireframe,
    showGrid,
    toggleWireframe: () => setWireframe((w) => !w),
    toggleGrid: () => setShowGrid((g) => !g),
    resetCamera,
  };
}
