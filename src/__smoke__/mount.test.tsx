/**
 * @vitest-environment happy-dom
 *
 * Mounts the real <App/> (in default 2D mode) with the House demo loaded and
 * all tools registered — proving the full UI tree renders without throwing.
 * (3D mode is not entered here because jsdom has no WebGL.)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { store } from "@/core/store/store";
import { makeProject } from "@/core/model/defaults";
import { registerAllTools } from "@/tools";
import { registry } from "@/tools/registry";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  registerAllTools();
  store.loadProject(makeProject());
});

describe("App mounts", () => {
  it("registers a substantial tool library", () => {
    expect(registry.size).toBeGreaterThan(40);
  });

  it("renders the whole 2D workspace without errors", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(<App />);
    });
    // Shell + panels are present.
    expect(host.querySelector(".wk-app")).toBeTruthy();
    expect(host.querySelector(".wk-topbar")).toBeTruthy();
    expect(host.querySelector(".wk-status")).toBeTruthy();
    expect(host.querySelector(".wk-panel")).toBeTruthy();
    act(() => root.unmount());
  });

  it("opens the command palette via store state", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<App />));
    act(() => store.setUI({ commandPaletteOpen: true }));
    expect(host.querySelector(".wk-palette")).toBeTruthy();
    act(() => root.unmount());
  });
});
