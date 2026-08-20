/**
 * Persistence: JSON export/import (file + clipboard-free download) and
 * localStorage autosave/restore, plus app bootstrap (restore-or-demo).
 *
 * Storage is always the full `Project` document (mm-based, see core/model).
 * Imported/restored documents reseed the id generator so newly created
 * elements never collide with ids already present in the loaded project.
 */
import { SCHEMA_VERSION, type Project } from "@/core/model/types";
import { idOrdinal, seedIdCounter } from "@/core/model/ids";
import { store } from "@/core/store/store";
import { normalizeConnectorFeatures } from "@/core/store/actions";
import { houseDemo } from "@/data/houseDemo";

const STORAGE_KEY = "woodkit.project";

/** Whether `window`/DOM APIs are available (guards against SSR/non-browser). */
function hasDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Loose structural check that an unknown value looks like a Project we made. */
function isValidProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Project>;
  return (
    typeof p.schemaVersion === "number" &&
    p.schemaVersion === SCHEMA_VERSION &&
    !!p.meta &&
    typeof p.meta === "object" &&
    Array.isArray(p.parts) &&
    Array.isArray(p.materials) &&
    Array.isArray(p.groups) &&
    Array.isArray(p.dimensions) &&
    !!p.assembly &&
    typeof p.assembly === "object" &&
    Array.isArray((p.assembly as Project["assembly"]).placements) &&
    Array.isArray((p.assembly as Project["assembly"]).connections)
  );
}

/** Scan every id in a project and return the highest ordinal found. */
function maxIdOrdinal(project: Project): number {
  let max = 0;
  const bump = (id: string | null | undefined) => {
    if (!id) return;
    const n = idOrdinal(id);
    if (n > max) max = n;
  };
  bump(project.meta.id);
  for (const m of project.materials) bump(m.id);
  for (const g of project.groups) bump(g.id);
  for (const part of project.parts) {
    bump(part.id);
    for (const c of part.connectors) bump(c.id);
    for (const c of part.constraints) bump(c.id);
  }
  for (const d of project.dimensions) bump(d.id);
  bump(project.assembly.id);
  for (const c of project.assembly.connections) bump(c.id);
  return max;
}

/** Stringify the current project (pretty-printed, mm units, as stored). */
export function exportProjectJSON(): string {
  return JSON.stringify(store.getState().project, null, 2);
}

/** Trigger a browser download of the current project as a .json file. */
export function downloadProject(): void {
  if (!hasDom()) return;
  const project = store.getState().project;
  const json = exportProjectJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safeName =
    (project.meta.name || "project")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.woodkit.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  store.status(`Exported ${a.download}`, "ok");
}

/** Parse text as a Project and load it into the store. Returns success. */
export function importProjectFromText(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    store.status("Import failed: file is not valid JSON", "error");
    return false;
  }
  if (!isValidProject(parsed)) {
    store.status("Import failed: not a WoodKit project file", "error");
    return false;
  }
  store.loadProject(parsed, "Import project");
  seedIdCounter(maxIdOrdinal(parsed));
  store.status(`Imported "${parsed.meta.name}"`, "ok");
  return true;
}

/** Open a native file picker, read the chosen .json file, and import it. */
export function openImportDialog(): void {
  if (!hasDom()) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.position = "fixed";
  input.style.left = "-9999px";

  const cleanup = () => {
    if (input.parentNode) document.body.removeChild(input);
  };

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) {
      cleanup();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      importProjectFromText(text);
      cleanup();
    };
    reader.onerror = () => {
      store.status("Import failed: could not read file", "error");
      cleanup();
    };
    reader.readAsText(file);
  });

  document.body.appendChild(input);
  input.click();
}

/** Persist the current project to localStorage (best-effort, non-fatal). */
export function saveToLocalStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, exportProjectJSON());
  } catch {
    // Quota exceeded / private-mode storage denial — autosave is best-effort.
  }
}

/** Read + validate a previously autosaved project, or null if absent/bad. */
export function loadFromLocalStorage(): Project | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

let autosavePending = false;

/** Coalesce bursts of store changes into a single deferred save. */
function scheduleAutosave(): void {
  if (autosavePending || typeof window === "undefined") return;
  autosavePending = true;
  window.setTimeout(() => {
    autosavePending = false;
    saveToLocalStorage();
  }, 400);
}

/**
 * App entry point: restore the last autosaved project, or fall back to the
 * House demo, then wire up throttled autosave on every future store change.
 */
export function bootstrapProject(): void {
  const restored = loadFromLocalStorage();
  if (restored) {
    store.loadProject(restored, "Restored project");
    seedIdCounter(maxIdOrdinal(restored));
  } else {
    store.loadProject(houseDemo(), "House demo");
  }
  // Materialize connector plug/socket geometry for projects authored before the
  // role system (idempotent, no undo entry).
  normalizeConnectorFeatures();

  if (typeof window !== "undefined") {
    store.subscribe(scheduleAutosave);
  }
}
