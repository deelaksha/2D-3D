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




















