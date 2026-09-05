/**
 * Renderer-Independent 3D Scene Representation Types (Phase 93).
 *
 * Implements a universal, decoupled 3D scene data model for downstream viewers
 * (WebGL, Three.js, Babylon.js, glTF exporter, etc.) without coupling the core
 * puzzle engine to any specific rendering technology.
 *
 * Separation Guarantee:
 * The scene model strictly separates CAD solid geometry from Rendering geometry.
 * Mutating render meshes, display properties, or shader attributes will never alter
 * the authoritative CAD models.
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { Box3D, Quaternion } from "../geometry/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";

/**
 * Categorization of renderable objects within the 3D scene.
 */
export type SceneObjectKind =
  | "piece"
  | "connector"
  | "axis"
  | "connection_marker"
  | "annotation";

/**
 * Renderer-ready geometric buffer container.
 * Completely independent deep-cloned copy from authoritative CAD solids.
 */
export interface RenderGeometry {
  /** Flat array of 3D vertex positions [x0, y0, z0, x1, y1, z1, ...]. */
  positions: Float32Array;
  /** Flat array of 3D vertex normals [nx0, ny0, nz0, ...]. */
  normals: Float32Array;
  /** Flat array of triangle face indices [i0, j0, k0, ...]. */
  indices: Uint32Array;
  /** Optional texture UV coordinates [u0, v0, u1, v1, ...]. */
  uvs?: Float32Array;
  /** Optional wireframe edge indices [i0, j0, i1, j1, ...]. */
  wireframeIndices?: Uint32Array;
  /** 3D bounding box for this geometry. */
  bounds: Box3D;
  /** Primitive drawing topology (triangles, lines, points). Default: "triangles". */
  primitiveType?: "triangles" | "lines" | "points";
}

/**
 * Display and material properties for scene visualization.
 */
export interface SceneDisplayProperties {
  /** Hexadecimal or CSS color code (e.g. "#8B5A2B", "#4A90E2"). */
  color: string;
  /** Opacity factor in range [0.0, 1.0]. */
  opacity: number;
  /** Whether the material requires alpha blending. */
  transparent: boolean;
  /** Surface roughness in range [0.0, 1.0]. */
  roughness: number;
  /** Metalness / reflectivity in range [0.0, 1.0]. */
  metalness: number;
  /** Whether wireframe rendering is enabled. */
  wireframe: boolean;
  /** Visibility toggle. */
  visible: boolean;
  /** Shadow casting flag. */
  castShadow: boolean;
  /** Shadow receiving flag. */
  receiveShadow: boolean;
  /** Interactive state flags. */
  highlighted?: boolean;
  selected?: boolean;
}

/**
 * Unified Material Definition in the scene.
 */
export interface SceneMaterial {
  id: string;
  name: string;
  displayProperties: SceneDisplayProperties;
  cadMaterialId?: string;
}

/**
 * Every renderable entity in the 3D scene.
 */
export interface SceneObject {
  /** Unique object identifier. */
  id: ID;
  /** Human-readable object name. */
  name: string;
  /** Kind classification. */
  kind: SceneObjectKind;
  /** Decoupled rendering geometry. */
  geometry: RenderGeometry;
  /** Local rigid-body transform relative to parent or assembly. */
  transform: RigidTransform3D;
  /** Global world-space transform. */
  worldTransform: RigidTransform3D;
  /** Material library identifier. */
  materialId: string;
  /** Material and display properties. */
  displayProperties: SceneDisplayProperties;
  /** Associated piece ID (if object corresponds to a puzzle piece). */
  pieceId?: string;
  /** Associated connection IDs (if object corresponds to connector / connection). */
  connectionIds?: string[];
  /** Authoritative CAD model entity reference. */
  cadGeometryRef?: string;
  /** Guarantee flag that this geometry is a deep, independent copy. */
  isImmutableCadCopy: boolean;
}

/**
 * Connection Visualization details between two joined interfaces.
 */
export interface SceneConnectionVisualization {
  /** 3D world position of interface A. */
  startPoint: Vec3;
  /** 3D world position of interface B. */
  endPoint: Vec3;
  /** Midpoint connecting interface origins. */
  midPoint: Vec3;
  /** Connection normal vector. */
  normal: Vec3;
  /** Display color reflecting status (e.g. green for mated, red for failed). */
  color: string;
  /** Renderable line connecting the two interface frames. */
  pairingLine: SceneObject;
  /** Renderable 3D marker at the midpoint interface junction. */
  statusMarker: SceneObject;
}

/**
 * Scene representation of a physical connection.
 */
export interface SceneConnection {
  /** Unique scene connection ID. */
  id: ID;
  /** Source physical connection ID. */
  connectionId: string;
  /** Piece A identifier. */
  pieceAId: string;
  /** Piece B identifier. */
  pieceBId: string;
  /** Interface A identifier. */
  interfaceAId: string;
  /** Interface B identifier. */
  interfaceBId: string;
  /** Physical connector type (tab_slot, notch, etc.). */
  connectorType: string;
  /** Physical engagement state. */
  state: "MATED" | "ENGAGED" | "DISENGAGED" | "FAILED";
  /** Applied joining angle in degrees. */
  joiningAngleDeg: number;
  /** 3D visualization objects and spatial vectors. */
  visualization: SceneConnectionVisualization;
}

/**
 * 3D Coordinate Axes container for scene navigation.
 */
export interface SceneCoordinateAxes {
  /** World coordinate axes objects (X=Red, Y=Green, Z=Blue). */
  worldAxes: SceneObject[];
  /** Optional piece-local coordinate axes keyed by piece ID. */
  pieceLocalAxes?: Record<string, SceneObject[]>;
}

/**
 * Scene-level metadata and diagnostic bounds.
 */
export interface SceneMetadata {
  /** Source puzzle identifier. */
  puzzleId: string;
  /** Descriptive scene title. */
  title: string;
  /** Total piece count in scene. */
  pieceCount: number;
  /** Total connection count in scene. */
  connectionCount: number;
  /** Global bounding box enclosing all scene objects. */
  boundingBox: Box3D;
  /** ISO timestamp of scene construction. */
  createdAt: string;
  /** Scene schema version. */
  version: string;
  /** Fingerprint confirming immutability of CAD origin. */
  cadSourceFingerprint: string;
  /** Optional extensible properties. */
  customProperties?: Record<string, any>;
}

/**
 * Complete Renderer-Independent 3D Scene Container.
 *
 * Scene
 *  ├── Pieces
 *  ├── Connectors
 *  ├── Assembly transforms
 *  ├── Materials
 *  ├── Connection visualization
 *  ├── Coordinate axes
 *  └── Metadata
 */
export interface Scene {
  /** Unique scene identifier. */
  id: string;
  /** Scene title. */
  name: string;
  /** All renderable piece solid representations. */
  pieces: SceneObject[];
  /** All renderable connector indicators / geometry. */
  connectors: SceneObject[];
  /** Dictionary of rigid-body assembly transforms keyed by piece ID. */
  assemblyTransforms: Record<string, RigidTransform3D>;
  /** Material library defining physical and display appearances. */
  materials: Record<string, SceneMaterial>;
  /** Visualized physical connections between pieces. */
  connections: SceneConnection[];
  /** World and local coordinate axes. */
  coordinateAxes: SceneCoordinateAxes;
  /** Scene-level metadata and global bounds. */
  metadata: SceneMetadata;
}

/**
 * Configurable options for SceneBuilder.
 */
export interface SceneBuildOptions {
  /** Scene name override. */
  sceneName?: string;
  /** Whether to generate world coordinate axes (default: true). */
  includeCoordinateAxes?: boolean;
  /** Whether to generate piece-local coordinate frames (default: false). */
  includePieceLocalAxes?: boolean;
  /** Length of coordinate axes in mm (default: 30 mm). */
  axisSizeMm?: number;
  /** Whether to generate connection visualization lines & markers (default: true). */
  includeConnectionVisualizations?: boolean;
  /** Color scheme strategy (default: "material"). */
  colorScheme?: "material" | "distinct_pieces" | "connection_status";
  /** Default material display opacity (default: 1.0). */
  defaultOpacity?: number;
  /** Whether to generate wireframe indices on solid meshes (default: true). */
  generateWireframeIndices?: boolean;
  /** Custom material overrides by material ID. */
  materialOverrides?: Record<string, Partial<SceneDisplayProperties>>;
}
