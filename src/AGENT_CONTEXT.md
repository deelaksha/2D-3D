# AGENT_CONTEXT.md — AI Agent Handoff Document

> **Purpose**: This file allows a new AI agent session to resume development of this project without the full conversation history. Read this file first before doing any investigation.

---

## Project Identity

| | |
|---|---|
| **Name** | 2D-3D Puzzle CAD Engine |
| **Root** | `d:/downloads/2D-3D/2D-3D/` |
| **Language** | TypeScript + React |
| **Framework** | Vite + React 18 |
| **Test runner** | Vitest (`npx vitest run` — always include `run` to avoid watch mode) |
| **Backend** | Python FastAPI at `http://localhost:8000` |
| **Dev server** | `npm run dev` |

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS
- **3D Rendering**: Three.js (`three`, `three/examples/jsm/loaders/GLTFLoader`, `OBJLoader`)
- **AI Backend**: Python FastAPI + Ollama (Qwen LLM) at `http://localhost:8000`
- **Test suite**: Vitest 2.1.9

---

## Module Map

```
src/
├── core/puzzle/
│   ├── automatic2d/         Phase 85 — 2D boundary + piece generation engine
│   ├── boundarypartition/   Phase 82 — Voronoi/grid piece partitioning
│   ├── connectorgeneration/ Phase 83 — Parametric connector synthesis
│   ├── connectorplacement/  Phase 84 — Connector placement into piece boundaries
│   ├── piece3d/             Phase 86 — 2D→3D extrusion (solid meshes, local frames)
│   ├── assembly3d/          Phase 87 — 3D assembly graph and transform solving
│   ├── joiningangle/        Phase 88 — Candidate dihedral angle generation
│   ├── assemblysolver/      Phase 89 — Graph-search 3D assembly solver
│   ├── assemblyvalidation/  Phase 90 — 9-point connection + 8-point assembly validation
│   ├── autonomousrepair/    Phase 91 — Local/global autonomous repair loop
│   ├── highlevelapi/        Phase 92 — Single `generatePuzzle(requirement)` API
│   ├── scene/               Phase 93 — Renderer-independent 3D scene representation
│   ├── manipulation/        Phase 95 — Connection angle inspection + adjustment
│   ├── exploded/            Phase 96 — Exploded assembly view generation
│   ├── animation/           Phase 97 — Assembly animation timeline (4-phase)
│   ├── export/              Phase 99 — Multi-format export (SVG, DXF, STL, OBJ, glTF, STEP, JSON)
│   ├── demonstration/       Phase 100 — 23-stage autonomous pipeline demonstrator
│   ├── graph/               PuzzleAssemblyGraph (topology, BFS, degree analysis)
│   ├── framesystem/         CoordinateFrame3D, RigidTransform3D
│   ├── geometry/            Quaternion, Box3D, math utilities
│   └── docs/                All architecture markdown docs (68 files)
│
├── ui/
│   ├── preview3d/           Phase 94 — Puzzle3DViewerController + Puzzle3DPreview.tsx
│   │   ├── Puzzle3DViewerController.ts
│   │   ├── Puzzle3DPreview.tsx
│   │   ├── threeSceneBridge.ts
│   │   └── types.ts
│   ├── panels/
│   │   ├── AiAssistantPanel.tsx    — AI chat + model generation UI
│   │   ├── ExportPreviewPanel.tsx  — In-browser 2D SVG + 3D WebGL preview modal
│   │   ├── useThreeGLTFViewer.ts   — Three.js hook for GLTF/OBJ loading
│   │   ├── Inspector.tsx
│   │   ├── JointsPanel.tsx
│   │   ├── LayersPanel.tsx
│   │   └── PartsPanel.tsx
│   ├── shell/               TopBar.tsx, StatusBar.tsx
│   ├── board/               CanvasBoard.tsx (2D workspace)
│   ├── canvas2d/            2D canvas rendering
│   └── canvas3d/            3D canvas rendering
│
└── __smoke__/               All integration tests (101 files)
```

---

## Phases Implemented (Summary)

| Phase | Name | Status |
|---|---|---|
| 82 | Boundary Partition Engine | ✅ |
| 83 | Automatic Connector Engine | ✅ |
| 84 | Connector Placement Engine | ✅ |
| 85 | Automatic 2D Generation Engine | ✅ |
| 86 | 3D Piece Conversion Engine | ✅ |
| 87 | 3D Assembly Generator | ✅ |
| 88 | Automatic Joining Angle Engine | ✅ |
| 89 | Automatic Assembly Solver | ✅ |
| 90 | Connector & Assembly Validation Pass | ✅ |
| 91 | Autonomous Repair System | ✅ |
| 92 | High-Level `generatePuzzle()` API | ✅ |
| 93 | Renderer-Independent 3D Scene | ✅ |
| 94 | Interactive 3D Preview (Three.js viewer) | ✅ |
| 95 | Connection Angle Inspection & Manipulation | ✅ |
| 96 | Exploded Assembly Visualization | ✅ |
| 97 | Assembly Animation System | ✅ |
| 99 | Comprehensive Puzzle Export Subsystem | ✅ |
| 100 | End-to-End Autonomous Demonstration (23 stages) | ✅ |

---

## Current Test Suite Status

```
Test Files: 105 passed
Tests:      598 passed
Failures:   0
Duration:   ~30s
```

Command to run: `npx vitest run`
Single file: `npx vitest run src/__smoke__/phase100AutonomousDemonstration.test.ts`

---

## Key Architectural Rules

1. **CAD immutability**: The authoritative CAD model must never be mutated by the renderer or viewer. `Puzzle3DViewerController` operates on deep-cloned rendering geometry only.
2. **No raw mesh editing**: All geometry modifications must go through parametric engines (never mutate triangle arrays directly).
3. **Validation gating**: `PuzzleExportEngine.exportPuzzle()` throws `PuzzleExportValidationError` if `validationReport.isValid === false`. Never bypass this.
4. **Local repair before global**: `AutonomousRepairEngine` attempts connector-local repair before full regeneration.
5. **No hard-coded geometry**: All piece shapes and connector placements are derived dynamically from the design specification.
6. **Piece ID preservation**: Every exported file must preserve `pieceId` and `connectionId` exactly.

---

## Known Gotchas & Bugs to Watch

| Gotcha | Detail |
|---|---|
| `vitest` must include `run` | `npx vitest run ...` — without `run` it enters interactive watch mode and hangs in CI |
| `getAllPieceNodes()` not `getPieceIds()` | `PuzzleAssemblyGraph` exposes `getAllPieceNodes()` returning `PuzzlePieceNode[]`. There is no `getPieceIds()` method. |
| `validationReport.failures` not `.issues` | `AssemblyValidationReport` uses `failures: ValidationFailureItem[]`, not `issues`. |
| `AngleManipulationEngine.inspectConnection()` arg order | Signature is `inspectConnection(puzzle, connectionId, currentAngles)` — puzzle is first. |
| `Puzzle3DViewerController.getVisualState()` | Was added in Phase 100. Older versions won't have it. |
| Three.js loaders import path | Import from `three/examples/jsm/loaders/GLTFLoader.js` (with `.js` extension for Vite ESM) |
| `ExportPreviewPanel` SVG endpoint | Backend must expose `GET /models/{model_id}/svg`. If it doesn't, the 2D tab shows an error gracefully. |

---

## Entry Points for Common Tasks

| Task | File/Function |
|---|---|
| Generate a puzzle from a prompt | `src/core/puzzle/highlevelapi/highLevelPuzzleGenerator.ts` → `generatePuzzle()` |
| Run the full 23-stage demonstration | `src/core/puzzle/demonstration/autonomousDemonstrator.ts` → `AutonomousDemonstrator.runCompletePipeline()` |
| Validate an assembly | `src/core/puzzle/assemblyvalidation/assemblyValidationEngine.ts` |
| Export a finished puzzle | `src/core/puzzle/export/puzzleExportEngine.ts` → `PuzzleExportEngine.exportPuzzle()` |
| Build a scene for rendering | `src/core/puzzle/scene/sceneBuilder.ts` → `SceneBuilder.buildFromPuzzle()` |
| Show 3D preview | `src/ui/preview3d/Puzzle3DPreview.tsx` |
| Open in-browser export preview | `src/ui/panels/ExportPreviewPanel.tsx` |

---

## Next Steps for Incoming Agent

The following are open areas where work can continue:

1. **Backend SVG endpoint** — The Python backend (`http://localhost:8000`) needs a `GET /models/{model_id}/svg` route that returns the 2D cut-sheet SVG. Without it, the 2D tab in `ExportPreviewPanel` shows a fetch error (gracefully).
2. **OBJ download endpoint** — `GET /models/{model_id}/obj` for the "Save OBJ" secondary button in the 3D viewer tab.
3. **Phase 101+** — No next phase has been specified yet. Await user requirement.
4. **ML Training Pipeline** — Phases 60–80 implemented data collection/ML infrastructure. The actual ML model training (against real puzzle data) has not been executed.

---

*Generated: 2026-09-05. Maintained by AI agent. Update after each major phase completion.*
