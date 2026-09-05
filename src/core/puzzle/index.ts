/**
 * Main Barrel Export for Parametric 2D-to-3D Puzzle Assembly System.
 */

// 1. Core Domain Models
export * from "./domain/types";
export * from "./domain/defaults";

// 2. Pieces
export * from "./piece/types";
export * from "./piece/piece";

// 3. Edges / Connection Interfaces
export * from "./interface/types";
export * from "./interface/interface";

// 4. Connections & 3D Joining Angles
export * from "./connection/types";
export * from "./connection/connection";

// 5. Coordinate Frames
export * from "./frame/types";
export * from "./frame/frameTransform";

// 6. Assembly & Kinematic Solver
export * from "./assembly/types";
export * from "./assembly/solver";

// 7. Constraints
export * from "./constraints/types";
export * from "./constraints/evaluator";

// 8. 3D Geometry
export * from "./geometry/types";
export * from "./geometry/math3d";

// 9. 3D Representation
export * from "./representation3d/types";
export * from "./representation3d/builder";

// 10. Validation
export * from "./validation/types";
export * from "./validation/validator";

// 11. Material / Cardboard Constraints
export * from "./cardboard/types";
export * from "./cardboard/rules";

// 12. AI Interface Placeholders
export * from "./ai/types";
export * from "./ai/placeholder";

// 13. Training Data Interface Placeholders
export * from "./training/types";
export * from "./training/exporter";

// 15. Optimization Placeholders
export * from "./optimization/types";
export * from "./optimization/optimizer";

// 16. Canonical Internal Data Representation (Phase 2)
export * from "./canonical";

// 17. 2D Parametric Piece Representation (Phase 3)
export * from "./parametric";

// 18. Connection-Interface System (Phase 4)
export * from "./interfacesystem";

// 19. 3D Coordinate-Frame System (Phase 5)
export * from "./framesystem";

// 20. Assembly Graph System G = (V, E) (Phase 6)
export * from "./graph";

// 21. Generic Constraint Framework (Phase 7)
export * from "./constraintsystem";

// 22. Material / Cardboard Constraint Subsystem (Phase 8)
export * from "./cardboardsubsystem";

// 23. Parametric 2D Geometry Pipeline (Phase 9)
export * from "./pipeline";

// 24. Deterministic 2D-to-3D Conversion Layer (Phase 10)
export * from "./solid3d";

// 25. 3D Assembly Transformation System (Phase 11)
export * from "./assemblytransforms";

// 26. 3D Geometric Validation Engine (Phase 12)
export * from "./geometricvalidation3d";

// 27. Connection Compatibility Engine (Phase 13)
export * from "./compatibilityengine";

// 28. Assembly-Sequence Planning Subsystem (Phase 14)
export * from "./sequencesolver";

// 29. Unified Puzzle Validation Engine (Phase 15)
export * from "./unifiedvalidation";

// 30. AI Integration Layer (Phase 16)
export * from "./ailayer";

// 31. Training Data Architecture (Phase 17)
export * from "./training";

// 32. Design Knowledge & Retrieval Subsystem (Phase 19)
export * from "./retrieval";

// 33. Automatic Design Repair Subsystem (Phase 20)
export * from "./repair";

// 34. Puzzle Design Optimization Subsystem (Phase 21)
export * from "./optimization";

// 35. End-to-End Puzzle Pipeline Integration (Phase 22)
export * from "./pipeline";

// 36. Real-File Ingestion & Normalization (Steps 26–29)
export * from "./ingestion";

// 37. Feature Extraction & Reconstruction (Steps 30–34)
export * from "./reconstruction";

// 38. Ground-Truth Evaluation & Benchmark Harness (Steps 35–40)
export * from "./benchmark";

// 39. Synthetic Puzzle Generator (Phase 42)
export * from "./generator";

// 40. Piece Segmentation Architecture (Phase 44)
export * from "./segmentation";

// 41. Interface Recognition Architecture (Phase 45)
export * from "./interfacerecognition";

// 42. Connection Prediction Subsystem (Phase 46)
export * from "./connectionprediction";

// 43. Parametric Feature Prediction Subsystem (Phase 47)
export * from "./parameterprediction";

// 44. Design Example Retrieval Architecture (Phase 48)
export * from "./retrievalsystem";

// 45. AI Design Planner (Phase 49)
export * from "./designplanner";

// 46. Master AI Pipeline Integration & Rejection Diagnostics (Phase 50)
export * from "./aipipeline";

// 47. AI Design Validation Gate (Phase 51)
export * from "./aivalidationgate";

// 48. AI-Assisted Design Repair Loop Subsystem (Phase 52)
export * from "./airepair";

// 49. Multi-Candidate Design Generation System (Phase 53)
export * from "./multicandidate";

// 50. Candidate Optimization Integration (Phase 54)
export * from "./candidateoptimization";

// 51. Human-Feedback Architecture (Phase 55)
export * from "./feedback";

// 52. Comprehensive AI Evaluation Framework (Phase 56)
export * from "./aievaluation";

// 53. ML Training Infrastructure (Phase 57)
export * from "./mltraining";

// 54. First Real ML Baseline Model (Phase 58)
export * from "./firstmlmodel";

// 55. Master Hybrid AI Architecture Integration (Phase 59)
export * from "./hybridpipeline";

// 56. Production Readiness System Subsystem (Phase 60)
export * from "./production";

// 57. Production-Quality Real-Data Ingestion Pipeline (Phase 61)
export * from "./realdata";

// 58. Human-in-the-Loop Annotation & Review Workflow (Phase 62)
export * from "./review";

// 59. Dataset Versioning & Quality Management (Phase 63)
export * from "./datasetversioning";

// 60. Hybrid Real + Synthetic Dataset Composition & Stratified Sampling (Phase 64)
export * from "./composition";

// 61. Formal 3D Assembly State & Transition Representation (Phase 66)
export * from "./assemblystate";

// 62. Assembly-Feasibility Validation Subsystem (Phase 68)
export * from "./feasibility";

// 63. Formal Puzzle Difficulty Representation & Deterministic Scoring (Phase 69)
export * from "./difficulty";

// 64. AI-Assisted Puzzle Design Generation Workflow (Phase 71)
export * from "./designgeneration";

// 65. AI Design Critic Subsystem (Phase 72)
export * from "./critic";

// 66. AI-Assisted Repair Agent Subsystem (Phase 73)
export * from "./repairagent";

// 67. Multi-Candidate AI Design Generation Subsystem (Phase 74)
export * from "./candidategeneration";

// 68. Complete AI + Optimization Loop Subsystem (Phase 75)
export * from "./aioptimizationloop";

// 69. Preference Learning Infrastructure Subsystem (Phase 76)
export * from "./preference";

// 70. AI Puzzle-Design System Benchmark Subsystem (Phase 77)
export * from "./systembenchmark";

// 71. Autonomous 2D Puzzle-Generation Subsystem (Advanced Autonomous Generation Phase)
export * from "./autonomous2d";

// 72. Automatic Puzzle-Boundary Partitioning Engine (Phase 82)
export * from "./boundarypartition";

// 73. Automatic Connector Generation Engine (Phase 83)
export * from "./connectorgeneration";

// 74. Automatic Connector Placement Engine (Phase 84)
export * from "./connectorplacement";

// 75. Automatic 2D Generation System (Phase 85)
export {
  Automatic2DGenerationEngine,
  GlobalBoundaryGenerator,
  PiecePartitioningAdapter,
  ConnectionGraphBuilder,
  ConnectorSynthesisEngine,
  ParametricGeometryEngine,
  Automatic2DValidator,
} from "./automatic2d";
export type {
  DesignSpecification2D,
  GeneratedPiece2D,
  GeneratedConnection2D,
  GeneratedPuzzle2D as Automatic2DGeneratedPuzzle,
  PieceDimensions2D,
  ValidationResult2D,
  ValidationIssue2D,
} from "./automatic2d";

// 76. Exact 3D Piece Conversion Subsystem (Phase 86)
export {
  Piece3DConversionEngine,
  ProfileExtractor,
  SolidExtruder,
  CoordinateFrameAssigner,
  Validator3D,
} from "./piece3d";
export type {
  GeneratedPiece3D,
  ExtrudablePieceProfile,
  RetainedConnection3D,
  ConvertedPuzzle3D,
  Piece3DValidationReport,
  Piece3DValidationIssue,
} from "./piece3d";

// 77. Automatic 3D Assembly Generator (Phase 87)
export {
  Automatic3DAssemblyGenerator,
  RootSelector,
  InterfaceAligner,
  PlacementValidator,
} from "./assembly3d";
export type {
  DesiredAssemblyConfiguration,
  AssemblyPlacement,
  PieceTransforms,
  ConnectionState3D,
  ConnectionStates,
  GeneratedAssembly3D,
  AssemblyValidationReport as Phase87AssemblyValidationReport,
  PlacementValidationResult,
  AutomaticAssemblyRequest,
} from "./assembly3d";

// 78. Automatic Joining-Angle Generation System (Phase 88)
export {
  AutomaticJoiningAngleEngine,
  evaluateConnectionAngles,
  evaluatePuzzleJoiningAngles,
  generateCandidateAngles,
  getConnectorAngleRange,
  validateCandidateAngle,
  evaluateCandidates,
} from "./anglegeneration";
export type {
  AngleRejectionReason,
  TierStatus,
  CandidateAngleEvaluation,
  RejectedAngleInfo,
  ValidAngleCandidates,
  AngleGenerationOptions,
  AngleGenerationRequest,
  PuzzleJoiningAnglesResult,
} from "./anglegeneration";

// 79. Complete Automatic Assembly Solver (Phase 89)
export {
  BacktrackingAssemblySolver,
  solveAutomaticAssembly,
  AssemblyCollisionDetector,
  TransformEvaluator,
} from "./assemblysolver";
export type {
  AssemblySolverInput,
  AssemblySolverOptions,
  SuccessfulAssembly,
  AssemblyFailureReport,
  AssemblySolverResult,
  PlacementRejectionCode,
  SolverStepDiagnostic,
  SolverMetrics,
  CollisionCheckResult,
  BoundingBox3D,
  EvaluatedTransformResult,
} from "./assemblysolver";

// 80. Complete Connector & Assembly Validation Pass (Phase 90)
export {
  AssemblyValidationPass,
  validateConnectorAndAssembly,
  ConnectionValidator,
  AssemblyLevelValidator,
} from "./assemblyvalidation";
export type {
  ValidationFailureItem,
  ConnectionValidationDetail,
  PieceValidationDetail,
  AssemblyValidationOptions,
  AssemblyValidationInput,
  AssemblyValidationReport,
} from "./assemblyvalidation";

// 81. Autonomous Generator to Repair System (Phase 91)
export {
  AutonomousRepairEngine,
  repairAutonomousAssembly,
  ParameterFaultLocalizer,
  LocalGeometryRegenerator,
} from "./autonomousrepair";
export type {
  ParameterModification,
  RepairAttempt,
  RepairHistory,
  AutonomousRepairConfig,
  FinalRepairStatus,
} from "./autonomousrepair";

// 82. High-Level Autonomous Puzzle Generator API (Phase 92)
export {
  HighLevelPuzzleGenerator,
  generatePuzzle,
  RequirementParser,
  parseRequirement,
} from "./highlevelapi";
export type {
  PuzzleRequirementInput,
  ParsedRequirement,
  GenerationStatistics,
  PuzzleGenerationResult,
  HighLevelGeneratorOptions,
} from "./highlevelapi";

// 83. Renderer-Independent 3D Scene Representation (Phase 93)
export {
  SceneBuilder,
  RenderGeometryFactory,
} from "./scene";
export type {
  Scene,
  SceneObject,
  SceneObjectKind,
  RenderGeometry,
  SceneDisplayProperties,
  SceneMaterial,
  SceneConnection,
  SceneConnectionVisualization,
  SceneCoordinateAxes,
  SceneMetadata,
  SceneBuildOptions,
} from "./scene";

// 84. Interactive 3D Preview (Phase 94)
export {
  ThreeSceneBridge,
  Puzzle3DViewerController,
  Puzzle3DPreview,
} from "@/ui/preview3d";
export type {
  Puzzle3DVisualState,
  ViewerCameraPreset,
  ViewerInteractionMode,
  ViewerSelectionState,
  ViewerCameraState,
  Puzzle3DPreviewProps,
} from "@/ui/preview3d";

// 85. Connection Angle Inspection & Live Manipulation (Phase 95)
export {
  AngleManipulationEngine,
  KinematicTreeSolver,
} from "./manipulation";
export type {
  ConnectionAngleInspection,
  AngleAdjustmentRequest,
  AngleAdjustmentResult,
} from "./manipulation";

// 86. Exploded Assembly Visualization (Phase 96)
export {
  ExplodedAssemblyEngine,
} from "./exploded";
export type {
  ExplodedViewMode,
  ExplodedPieceState,
  ExplodedInterfaceIndicator,
  ExplodedConnectionIndicator,
  AssemblyStepState,
  ExplodedIndicatorOptions,
  ExplodedAssemblyConfig,
  ExplodedAssemblyResult,
} from "./exploded";

// 87. Assembly-Animation System (Phase 97)
export {
  AssemblyAnimationEngine,
  AssemblyAnimationPlayer,
} from "./animation";
export type {
  AnimationPlaybackState,
  AnimationPhase,
  PieceAnimationKeyframe,
  StepAnimationTrack,
  AssemblyAnimationTimeline,
  AnimationPlaybackStatus,
  AnimationGenerationOptions,
} from "./animation";

// 88. Comprehensive Puzzle Export Subsystem (Phase 99)
export {
  PuzzleExportEngine,
  SvgExporter,
  DxfExporter,
  DimensionedDrawingExporter,
  StlExporter,
  ObjExporter,
  GltfExporter,
  StepExporter,
  MetadataExporter,
  PuzzleExportValidationError,
} from "./export";
export type {
  Export2DOptions,
  Export3DOptions,
  ExportMetadataOptions,
  PuzzleExportOptions,
  ExportedPiece2D,
  CombinedLayoutResult,
  ExportedPiece3D,
  Assembled3DExport,
  PuzzleMetadataPackage,
  PuzzleExportPackage,
} from "./export";// 89. End-to-End Autonomous Demonstration (Phase 100)
export { AutonomousDemonstrator } from "./demonstration";
export type {
  DemonstrationStep,
  DemonstrationMeasurements,
  AutonomousDemonstrationResult,
} from "./demonstration";

// 90. Professional AI Designer Workspace (Prompts 101–120)
export * from "./designer";

