/**
 * Three.js Scene Bridge (Phase 94).
 *
 * Translates the renderer-independent Phase 93 Scene data model into Three.js 3D objects,
 * while maintaining strict CAD geometry isolation and enabling visual state overlays
 * (VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE).
 */

import * as THREE from "three";
import type {
  RenderGeometry,
  Scene,
  SceneConnection,
  SceneObject,
} from "@/core/puzzle/scene/types";
import type { Puzzle3DVisualState } from "./types";

export interface ThreeSceneBridgeResult {
  /** Root group containing all translated 3D objects. */
  rootGroup: THREE.Group;
  /** Dictionary of piece meshes keyed by pieceId. */
  pieceMeshes: Map<string, THREE.Mesh>;
  /** Dictionary of connector/marker meshes keyed by connectionId. */
  connectionMarkers: Map<string, THREE.Object3D>;
  /** Dictionary of connection pairing lines keyed by connectionId. */
  connectionLines: Map<string, THREE.Line | THREE.LineSegments>;
  /** Coordinate axes group. */
  axesGroup: THREE.Group;
  /** Three.js bounding box enclosing the translated scene. */
  boundingBox: THREE.Box3;
}

export class ThreeSceneBridge {
  /**
   * Translates a Phase 93 Scene into a Three.js hierarchy.
   */
  public static buildThreeScene(
    scene: Scene,
    visualStates: Map<string, Puzzle3DVisualState> = new Map()
  ): ThreeSceneBridgeResult {
    const rootGroup = new THREE.Group();
    rootGroup.name = `ThreeScene_${scene.id}`;

    const pieceMeshes = new Map<string, THREE.Mesh>();
    const connectionMarkers = new Map<string, THREE.Object3D>();
    const connectionLines = new Map<string, THREE.Line | THREE.LineSegments>();
    const axesGroup = new THREE.Group();
    axesGroup.name = "CoordinateAxes";

    const piecesGroup = new THREE.Group();
    piecesGroup.name = "Pieces";
    rootGroup.add(piecesGroup);

    const connectorsGroup = new THREE.Group();
    connectorsGroup.name = "Connectors";
    rootGroup.add(connectorsGroup);

    rootGroup.add(axesGroup);

    // 1. Build Pieces
    for (const pieceObj of scene.pieces) {
      const visualState = visualStates.get(pieceObj.pieceId || "") || "DEFAULT";
      const mesh = this.createPieceMesh(pieceObj, visualState);

      if (pieceObj.pieceId) {
        pieceMeshes.set(pieceObj.pieceId, mesh);
      }
      piecesGroup.add(mesh);
    }

    // 2. Build Connections & Visualizations
    for (const conn of scene.connections) {
      const visualState = visualStates.get(conn.connectionId) || "DEFAULT";

      // Pairing Line
      const line = this.createLineObject(conn.visualization.pairingLine, visualState);
      connectionLines.set(conn.connectionId, line);
      connectorsGroup.add(line);

      // Junction Status Marker
      const marker = this.createMeshObject(conn.visualization.statusMarker, visualState);
      connectionMarkers.set(conn.connectionId, marker);
      connectorsGroup.add(marker);
    }

    // 3. Build Coordinate Axes
    for (const axisObj of scene.coordinateAxes.worldAxes) {
      const axisLine = this.createLineObject(axisObj, "DEFAULT");
      axesGroup.add(axisLine);
    }

    // 4. Compute Scene Bounding Box
    const boundingBox = new THREE.Box3().setFromObject(piecesGroup);
    if (boundingBox.isEmpty()) {
      boundingBox.min.set(-50, -50, -50);
      boundingBox.max.set(50, 50, 50);
    }

    return {
      rootGroup,
      pieceMeshes,
      connectionMarkers,
      connectionLines,
      axesGroup,
      boundingBox,
    };
  }

  /**
   * Converts a RenderGeometry into a Three.js BufferGeometry.
   */
  public static createBufferGeometry(geom: RenderGeometry): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    if (geom.positions && geom.positions.length > 0) {
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(geom.positions, 3)
      );
    }

    if (geom.normals && geom.normals.length > 0) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(geom.normals, 3)
      );
    }

    if (geom.uvs && geom.uvs.length > 0) {
      geometry.setAttribute("uv", new THREE.BufferAttribute(geom.uvs, 2));
    }

    if (geom.indices && geom.indices.length > 0) {
      geometry.setIndex(new THREE.BufferAttribute(geom.indices, 1));
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Creates a Three.js Mesh for a puzzle piece with visual state styling.
   */
  public static createPieceMesh(
    pieceObj: SceneObject,
    visualState: Puzzle3DVisualState
  ): THREE.Mesh {
    const geometry = this.createBufferGeometry(pieceObj.geometry);
    const material = this.resolveMaterial(pieceObj, visualState);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = pieceObj.name;
    mesh.castShadow = pieceObj.displayProperties.castShadow;
    mesh.receiveShadow = pieceObj.displayProperties.receiveShadow;

    // Apply World Transform
    this.applyTransform(mesh, pieceObj.worldTransform);

    // Attach metadata for raycasting & selection
    mesh.userData = {
      id: pieceObj.id,
      kind: pieceObj.kind,
      pieceId: pieceObj.pieceId,
      connectionIds: pieceObj.connectionIds || [],
      isImmutableCadCopy: true,
      originalColor: pieceObj.displayProperties.color,
      visualState,
    };

    // Add subtle accent wireframe if selected
    if (visualState === "SELECTED_PIECE" || pieceObj.geometry.wireframeIndices) {
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(pieceObj.geometry.positions, 3)
      );
      if (pieceObj.geometry.wireframeIndices) {
        wireGeo.setIndex(
          new THREE.BufferAttribute(pieceObj.geometry.wireframeIndices, 1)
        );
      }
      const wireMat = new THREE.LineBasicMaterial({
        color: visualState === "SELECTED_PIECE" ? 0x00e5ff : 0x222222,
        linewidth: 1,
        transparent: true,
        opacity: visualState === "SELECTED_PIECE" ? 0.9 : 0.25,
      });
      const wireframeLines = new THREE.LineSegments(wireGeo, wireMat);
      wireframeLines.name = `${pieceObj.name}_wireframe`;
      mesh.add(wireframeLines);
    }

    return mesh;
  }

  /**
   * Creates a line object (e.g. connection pairing line or coordinate axis).
   */
  public static createLineObject(
    obj: SceneObject,
    visualState: Puzzle3DVisualState
  ): THREE.LineSegments | THREE.Line {
    const geometry = this.createBufferGeometry(obj.geometry);
    let color = new THREE.Color(obj.displayProperties.color);

    if (visualState === "INVALID_CONNECTION" || visualState === "COLLISION") {
      color = new THREE.Color(0xe74c3c); // Red
    } else if (visualState === "WARNING") {
      color = new THREE.Color(0xf39c12); // Amber
    }

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: obj.displayProperties.transparent,
      opacity: obj.displayProperties.opacity,
      linewidth: 2,
    });

    const line = new THREE.LineSegments(geometry, material);
    line.name = obj.name;
    this.applyTransform(line, obj.worldTransform);

    line.userData = {
      id: obj.id,
      kind: obj.kind,
      pieceId: obj.pieceId,
      connectionIds: obj.connectionIds || [],
      isImmutableCadCopy: true,
    };

    return line;
  }

  /**
   * Creates a generic mesh object (e.g. connector junction marker).
   */
  public static createMeshObject(
    obj: SceneObject,
    visualState: Puzzle3DVisualState
  ): THREE.Mesh {
    const geometry = this.createBufferGeometry(obj.geometry);
    const material = this.resolveMaterial(obj, visualState);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = obj.name;
    mesh.castShadow = obj.displayProperties.castShadow;
    mesh.receiveShadow = obj.displayProperties.receiveShadow;
    this.applyTransform(mesh, obj.worldTransform);

    mesh.userData = {
      id: obj.id,
      kind: obj.kind,
      pieceId: obj.pieceId,
      connectionIds: obj.connectionIds || [],
      isImmutableCadCopy: true,
    };

    return mesh;
  }

  /**
   * Resolves visual state PBR material for an object.
   */
  public static resolveMaterial(
    obj: SceneObject,
    visualState: Puzzle3DVisualState
  ): THREE.MeshStandardMaterial {
    const disp = obj.displayProperties;
    let baseColor = new THREE.Color(disp.color);
    let emissive = new THREE.Color(0x000000);
    let opacity = disp.opacity;
    let roughness = disp.roughness;
    let metalness = disp.metalness;

    switch (visualState) {
      case "SELECTED_PIECE":
        baseColor = new THREE.Color(0x00e5ff); // Cyan
        emissive = new THREE.Color(0x005577);
        roughness = 0.3;
        metalness = 0.2;
        break;
      case "COLLISION":
        baseColor = new THREE.Color(0xe74c3c); // Red alert
        emissive = new THREE.Color(0x550000);
        break;
      case "WARNING":
        baseColor = new THREE.Color(0xf39c12); // Amber warning
        emissive = new THREE.Color(0x332200);
        break;
      case "INVALID_CONNECTION":
        baseColor = new THREE.Color(0xe91e63); // Magenta
        emissive = new THREE.Color(0x440022);
        break;
      case "VALID":
        // Slight green luster if explicitly tagged valid
        emissive = new THREE.Color(0x052205);
        break;
      case "DEFAULT":
      default:
        break;
    }

    return new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive,
      roughness,
      metalness,
      transparent: opacity < 1.0,
      opacity,
      wireframe: disp.wireframe,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Applies a RigidTransform3D to a Three.js Object3D.
   */
  private static applyTransform(
    object3D: THREE.Object3D,
    transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number }; scale?: { x: number; y: number; z: number } }
  ): void {
    object3D.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z
    );
    object3D.quaternion.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w
    );
    if (transform.scale) {
      object3D.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }
  }
}
