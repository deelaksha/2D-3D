/**
 * Canvas3D — read-only 3D preview of the current 2D design. It reads the SAME
 * Project model and shows every part extruded to its thickness. View-only:
 * drag to orbit, scroll to zoom, "Fit" reframes. No editing, no tools.
 *
 * Fully isolated in ui/canvas3d/ (self-contained orbit, no external control lib).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useProject } from "@/core/store/store";
import { buildProjectObject, disposeObject } from "./build3d";

interface Viewer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  spherical: THREE.Spherical; // radius / phi / theta around target
  group: THREE.Group | null;
  applyCamera: () => void;
  fit: (radius: number) => void;
}

export default function Canvas3D(): JSX.Element {
  const project = useProject();
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  /* ---- one-time scene setup ---- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeceef1);

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 500000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(0.6, 1, 0.9);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-0.8, -0.5, -0.6);
    scene.add(fill);

    const target = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical(600, Math.PI / 3, Math.PI / 4);
    const applyCamera = () => {
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    };
    const fit = (radius: number) => {
      const r = Math.max(radius, 30);
      const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.25;
      spherical.radius = dist;
      spherical.phi = Math.PI / 3;
      spherical.theta = Math.PI / 4;
      camera.near = Math.max(1, r / 100);
      camera.far = r * 200;
      camera.updateProjectionMatrix();
      applyCamera();
    };
    applyCamera();

    const viewer: Viewer = { renderer, scene, camera, target, spherical, group: null, applyCamera, fit };
    viewerRef.current = viewer;

    /* ---- self-contained orbit / zoom ---- */
    let dragging = false;
    let px = 0;
    let py = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
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
      spherical.theta -= dx * 0.01;
      spherical.phi -= dy * 0.01;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi));
      applyCamera();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(5, Math.min(400000, spherical.radius * Math.exp(e.deltaY * 0.0012)));
      applyCamera();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const loop = () => {
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
      if (viewer.group) disposeObject(viewer.group);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      viewerRef.current = null;
    };
  }, []);

  /* ---- (re)build meshes whenever the design changes ---- */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (v.group) {
      v.scene.remove(v.group);
      disposeObject(v.group);
      v.group = null;
    }
    const g = buildProjectObject(project);
    const box = new THREE.Box3().setFromObject(g);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      g.position.sub(center); // recentre the whole design at the origin
      v.scene.add(g);
      v.group = g;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      v.fit(sphere.radius);
    } else {
      v.scene.add(g);
      v.group = g;
    }
  }, [project]);

  const refit = () => {
    const v = viewerRef.current;
    if (!v || !v.group) return;
    const box = new THREE.Box3().setFromObject(v.group);
    if (!box.isEmpty()) v.fit(box.getBoundingSphere(new THREE.Sphere()).radius);
  };

  return (
    <div className="wk-canvas3d" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div className="wk-canvas__hud wk-canvas__hud--right" style={{ top: "auto", bottom: "var(--wk-s3)" }}>
        <div className="wk-hud-card">
          <span style={{ color: "var(--wk-ink-faint)", fontSize: 12 }}>3D preview · drag to orbit</span>
          <button type="button" className="wk-icon-btn" title="Fit to view" onClick={refit}>
            ⤢
          </button>
        </div>
      </div>
    </div>
  );
}
