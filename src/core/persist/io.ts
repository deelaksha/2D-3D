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
import { makeProject } from "@/core/model/defaults";
import { store } from "@/core/store/store";
import { normalizeConnectorFeatures } from "@/core/store/actions";

const STORAGE_KEY = "woodkit.project";
const FILE_DB = "woodkit-file-access";
const FILE_STORE = "handles";
const FILE_HANDLE_KEY = "active-project";
type ProjectFileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};
let activeFileHandle: ProjectFileHandle | null = null;
let fileWriteInFlight = false;


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
  const project = structuredClone(store.getState().project);
  project.meta.updatedAt = new Date().toISOString();
  return JSON.stringify(project, null, 2);
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

function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileHandle(handle: ProjectFileHandle | null): Promise<void> {
  try {
    const db = await openFileDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, "readwrite");
      tx.objectStore(FILE_STORE).put(handle, FILE_HANDLE_KEY);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* IndexedDB is optional; the current session can still autosave. */ }
}

async function loadFileHandle(): Promise<ProjectFileHandle | null> {
  try {
    const db = await openFileDatabase();
    const handle = await new Promise<ProjectFileHandle | null>((resolve, reject) => {
      const request = db.transaction(FILE_STORE, "readonly").objectStore(FILE_STORE).get(FILE_HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as ProjectFileHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch { return null; }
}

async function hasReadWritePermission(handle: ProjectFileHandle, prompt: boolean): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const options = { mode: "readwrite" as const };
  if (await handle.queryPermission(options) === "granted") return true;
  return prompt && (await handle.requestPermission(options) === "granted");
}

async function writeActiveProjectFile(): Promise<void> {
  if (!activeFileHandle || fileWriteInFlight || !(await hasReadWritePermission(activeFileHandle, false))) return;
  fileWriteInFlight = true;
  try {
    const writable = await activeFileHandle.createWritable();
    await writable.write(exportProjectJSON());
    await writable.close();
  } catch (error) {
    console.warn("WoodKit file autosave failed", error);
    store.status("Project file could not be saved; browser permission may have changed", "warning");
  } finally { fileWriteInFlight = false; }
}

function suggestedFileName(): string {
  const name = store.getState().project.meta.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "project";
  return `${name}.woodkit.json`;
}

/** Ask the user for browser file access and bind autosave to the selected file. */
export async function enableProjectFileAutosave(): Promise<void> {
  const picker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle> }).showSaveFilePicker;
  if (!picker) { store.status("File autosave needs a Chromium browser. Local autosave is still active.", "warning"); return; }
  if (!window.confirm("Allow WoodKit to write this project file automatically after each edit? You can revoke this browser permission at any time.")) return;
  try {
    const handle = await picker({ suggestedName: suggestedFileName(), types: [{ description: "WoodKit project", accept: { "application/json": [".woodkit.json", ".json"] } }] });
    if (!(await hasReadWritePermission(handle, true))) { store.status("File write permission was not granted", "warning"); return; }
    activeFileHandle = handle;
    await saveFileHandle(handle);
    await writeActiveProjectFile();
    store.status(`Autosaving to ${handle.name}`, "ok");
  } catch (error) {
    if ((error as DOMException)?.name !== "AbortError") store.status("Could not enable project-file autosave", "error");
  }
}

/** Begin a new document and, when supported, let the user choose its folder
 * before any work is created. A file picker can only be opened from a click,
 * so this is intentionally called by File → New project. */
export async function createNewProjectWithSaveLocation(): Promise<void> {
  const picker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle> }).showSaveFilePicker;
  if (!picker) {
    activeFileHandle = null;
    await saveFileHandle(null);
    store.loadProject(makeProject(), "New project");
    return;
  }
  if (!window.confirm("Choose a folder and project file now? WoodKit will autosave every edit to that file.")) {
    activeFileHandle = null;
    await saveFileHandle(null);
    store.loadProject(makeProject(), "New project (browser autosave)");
    return;
  }
  try {
    const handle = await picker({ suggestedName: "untitled-kit.woodkit.json", types: [{ description: "WoodKit project", accept: { "application/json": [".woodkit.json", ".json"] } }] });
    if (!(await hasReadWritePermission(handle, true))) { store.status("File write permission was not granted", "warning"); return; }
    store.loadProject(makeProject(), "New project");
    activeFileHandle = handle;
    await saveFileHandle(handle);
    await writeActiveProjectFile();
    store.status(`New project created in ${handle.name}; autosave is enabled`, "ok");
  } catch (error) {
    if ((error as DOMException)?.name !== "AbortError") store.status("Could not create the project file", "error");
  }
}

/** Open a project file with explicit read/write permission, then keep it autosaved. */
export async function openProjectFile(): Promise<void> {
  const picker = (window as Window & { showOpenFilePicker?: (options: unknown) => Promise<ProjectFileHandle[]> }).showOpenFilePicker;
  if (!picker) { openImportDialog(); return; }
  try {
    const [handle] = await picker({ multiple: false, types: [{ description: "WoodKit project", accept: { "application/json": [".woodkit.json", ".json"] } }] });
    if (!handle || !(await hasReadWritePermission(handle, true))) { store.status("Read/write permission was not granted", "warning"); return; }
    const file = await handle.getFile();
    if (!importProjectFromText(await file.text())) return;
    activeFileHandle = handle;
    await saveFileHandle(handle);
    store.status(`Opened ${handle.name}; autosave is enabled`, "ok");
  } catch (error) {
    if ((error as DOMException)?.name !== "AbortError") store.status("Could not open project file", "error");
  }
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
    void writeActiveProjectFile();
  }, 400);
}

/**
 * App entry point: restore the last autosaved project, or fall back to the
 * House demo, then wire up throttled autosave on every future store change.
 */
export function bootstrapProject(): void {
  try {
    const restored = loadFromLocalStorage();
    if (restored) {
      store.loadProject(restored, "Restored project");
      seedIdCounter(maxIdOrdinal(restored));
    } else {
      store.loadProject(makeProject(), "New project");
    }
  } catch (err) {
    console.warn("Could not restore project from localStorage, resetting to new project:", err);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    store.loadProject(makeProject(), "New project");
  }

  normalizeConnectorFeatures();

  if (typeof window !== "undefined") {
    store.subscribe(scheduleAutosave);
    // Restore the explicit project file when permission persists. No permission
    // prompt appears at startup; the user retains control over that decision.
    void (async () => {
      const handle = await loadFileHandle();
      if (!handle || !(await hasReadWritePermission(handle, false))) return;
      try {
        const file = await handle.getFile();
        if (importProjectFromText(await file.text())) {
          activeFileHandle = handle;
          store.status(`Opened ${handle.name}; autosave is enabled`, "ok");
        }
      } catch { store.status("Saved project file could not be reopened", "warning"); }
    })();
  }
}
