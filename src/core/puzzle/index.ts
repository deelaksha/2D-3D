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
