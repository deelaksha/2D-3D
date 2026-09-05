# Interactive 3D Preview Subsystem (Phase 94)

## Overview

The **Interactive 3D Preview** provides a real-time, renderer-independent visualization of generated 3D puzzles. It consumes the renderer-independent `Scene` model from Phase 93 (or accepts any `PuzzleGenerationResult` from Phase 92) and renders it using WebGL / Three.js without coupling the core puzzle engine to a specific frontend.

---

## Architecture

```
PuzzleGenerationResult (Phase 92) / Scene (Phase 93)
                     │
                     ▼
             [ThreeSceneBridge]
          (BufferGeometries + PBR)
                     │
                     ▼
       [Puzzle3DViewerController]
    (Orbit, Pan, Zoom, Reset, Raycast,
      Isolate, Hide, Visual States)
                     │
                     ▼
             <Puzzle3DPreview />
   (Interactive Canvas + Glassmorphic HUD)
```

---

## User Controls

| Control | Action | Keyboard / Mouse |
|---|---|---|
| **Orbit** | Rotates camera around assembly centroid | Left-click drag |
| **Pan** | Translates camera in viewport plane | Right-click drag / Shift+drag / Middle click |
| **Zoom** | Moves camera closer / farther | Mouse wheel / Pinch / `+` / `-` buttons |
| **Reset Camera** | Smoothly frames entire puzzle bounding box | "Reset" button |
| **Presets** | Sets standard view angles | "ISO", "Top", "Front", "Side" buttons |
| **Select Piece** | Selects piece and displays Inspector card | Click 3D mesh or Pieces Drawer item |
| **Hide / Show** | Toggles piece visibility | Eye icon (`👁`) in Pieces Drawer |
| **Isolate** | Hides all other pieces to focus on one | Star icon (`★`) in Pieces Drawer |
| **Highlight Connection** | Highlights joined pieces and junction line | Click connection in Connections Drawer |

---

## Diagnostic Visual States

The viewer automatically reflects the assembly validation status:

| Visual State | Color Code | Description |
|---|---|---|
| `VALID` | `#2ECC71` (Green) | Fully verified assembly with zero errors |
| `WARNING` | `#F39C12` (Amber) | Clearance or tight tolerance warnings |
| `COLLISION` | `#E74C3C` (Red) | Rigid-body penetration or collision detected |
| `INVALID_CONNECTION` | `#E91E63` (Magenta) | Unmatched interface or failed connection |
| `SELECTED_PIECE` | `#00E5FF` (Cyan) | Highlighted active piece selection |

---

## Usage Example

```tsx
import React, { useState, useEffect } from "react";
import { generatePuzzle, type PuzzleGenerationResult } from "@/core/puzzle";
import { Puzzle3DPreview } from "@/ui/preview3d";

export const PuzzlePreviewPage: React.FC = () => {
  const [result, setResult] = useState<PuzzleGenerationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generatePuzzle("Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections.")
      .then((res) => {
        setResult(res);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Puzzle3DPreview
        puzzleResult={result}
        isLoading={loading}
        onPieceSelect={(id) => console.log("Selected piece:", id)}
      />
    </div>
  );
};
```
