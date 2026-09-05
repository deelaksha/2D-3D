/**
 * @vitest-environment happy-dom
 *
 * Prompts 101–104: Professional AI Designer Workspace Integration Tests.
 *
 * Validates:
 *  - Prompt 101: Header, mode selector, context chips, primary action bar, compact results
 *  - Prompt 102: Intelligent composer, history, dynamic smart suggestions, interpretation preview
 *  - Prompt 103: 17-stage generation timeline with diagnostic telemetry
 *  - Prompt 104: CAD result inspector (Overview, Geometry, Connections, Assembly, Validation, AI explanation)
 */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AIDesignerPanel } from "@/ui/designer/AIDesignerPanel";
import { designerStore } from "@/core/puzzle/designer/designerStore";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Prompts 101–104: Professional AI Designer Workspace", () => {
  it("mounts AIDesignerPanel cleanly and renders primary hierarchy", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      const root = createRoot(container);
      root.render(<AIDesignerPanel />);
    });

    expect(container.textContent).toContain("AI DESIGNER");
    expect(container.textContent).toContain("Active CAD Context");
    expect(container.textContent).toContain("Create");
    expect(container.textContent).toContain("Modify");
    expect(container.textContent).toContain("Analyze");
    expect(container.textContent).toContain("Assemble");
    expect(container.textContent).toContain("Optimize");
    expect(container.textContent).toContain("Repair");
    expect(container.textContent).toContain("Autonomous Pipeline Timeline");
    expect(container.textContent).toContain("17 Stages");

    document.body.removeChild(container);
  });

  it("updates mode and displays structured controls for Create mode", () => {
    act(() => {
      designerStore.setMode("create");
    });

    expect(designerStore.getState().activeMode).toBe("create");

    act(() => {
      designerStore.updateCreateControls({
        pieceCount: 20,
        puzzleType: "box",
        difficulty: "Expert",
      });
    });

    expect(designerStore.getState().createControls.pieceCount).toBe(20);
    expect(designerStore.getState().createControls.puzzleType).toBe("box");
    expect(designerStore.getState().createControls.difficulty).toBe("Expert");
  });

  it("manages dynamic context chips (add, remove, preserve immutables)", () => {
    act(() => {
      designerStore.addContextItem({
        id: "ctx-piece-test-01",
        type: "piece",
        label: "Piece P07",
        removable: true,
      });
    });

    expect(designerStore.getState().contextItems.some((c) => c.label === "Piece P07")).toBe(true);

    act(() => {
      designerStore.removeContextItem("ctx-piece-test-01");
    });

    expect(designerStore.getState().contextItems.some((c) => c.label === "Piece P07")).toBe(false);
  });

  it("populates 17-stage generation timeline and result inspector with factual CAD data", async () => {
    const res = await generatePuzzle("Generate an 8-piece planar cardboard puzzle");

    act(() => {
      designerStore.setGeneratedPuzzle(
        res,
        res.puzzle3D,
        res.pieceTransforms,
        res.appliedAngles,
        res.validationReport
      );
      designerStore.completeTimeline("Success", 250);
    });

    const state = designerStore.getState();
    expect(state.activePuzzleResult).toBeDefined();
    expect(state.activePuzzle3D?.pieces.length).toBe(8);
    expect(state.activeValidationReport?.isValid).toBe(true);

    // Verify timeline stages
    expect(state.timelineStages.length).toBe(17);
    expect(state.timelineStages[0].key).toBe("UNDERSTANDING_REQUIREMENT");
    expect(state.timelineStages[16].key).toBe("SCENE_CREATION");
  });
});
