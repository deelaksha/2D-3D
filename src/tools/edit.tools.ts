/**
 * Edit tools: undo/redo, duplicate, delete, grouping, and selection helpers.
 * All state changes go through @/core/store/actions or the store itself.
 */
import { store } from "../core/store/store";
import {
  groupParts,
  deleteParts,
  duplicatePart,
  select,
  selectOne,
  ungroupParts,
} from "../core/store/actions";
import type { ToolContext, ToolDefinition } from "./toolTypes";

export const editTools: ToolDefinition[] = [
  {
    id: "edit.undo",
    name: "Undo",
    category: "edit",
    icon: "↶",
    description: "Step back to your last change.",
    hint: "Reverses the most recent action.",
    shortcut: "Ctrl+Z",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["back", "revert"],
    undoable: false,
    execute: () => {
      store.undo();
    },
    isEnabled: () => store.canUndo(),
  },
  {
    id: "edit.redo",
    name: "Redo",
    category: "edit",
    icon: "↷",
    description: "Bring back the change you undid.",
    hint: "Re-applies the most recently undone action.",
    shortcut: "Ctrl+Shift+Z",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["forward", "reapply"],
    undoable: false,
    execute: () => {
      store.redo();
    },
    isEnabled: () => store.canRedo(),
  },
  {
    id: "edit.duplicate",
    name: "Duplicate",
    category: "edit",
    icon: "⧉",
    description: "Make a copy of the selected part(s).",
    hint: "Clones each selected part, offset slightly so you can see it.",
    shortcut: "Ctrl+D",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["copy", "clone"],
    undoable: true,
    execute: (ctx: ToolContext) => {
      if (ctx.selection.length === 0) {
        store.status("Select a part to duplicate first", "warning");
        return;
      }
      const newIds: string[] = [];
      for (const id of ctx.selection) {
        const copyId = duplicatePart(id);
        if (copyId) newIds.push(copyId);
      }
      if (newIds.length > 0) select(newIds);
    },
    isEnabled: (ctx: ToolContext) => ctx.selection.length > 0,
  },
  {
    id: "edit.deleteSel",
    name: "Delete",
    category: "edit",
    icon: "🗑",
    description: "Delete the selected part(s).",
    hint: "Removes the selected parts and any connections attached to them.",
    shortcut: "Delete",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["remove", "erase", "trash"],
    undoable: true,
    execute: (ctx: ToolContext) => {
      if (ctx.selection.length === 0) {
        store.status("Nothing selected to delete", "warning");
        return;
      }
      deleteParts(ctx.selection);
    },
    isEnabled: (ctx: ToolContext) => ctx.selection.length > 0,
  },
  {
    id: "edit.group",
    name: "Group",
    category: "edit",
    icon: "⛓",
    description: "Combine the selected parts into one physical object.",
    hint: "Merges the shapes into one part that moves as one object in 2D and 3D.",
    shortcut: "Ctrl+G",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["combine", "bundle"],
    undoable: true,
    execute: (ctx: ToolContext) => {
      if (ctx.selection.length < 2) {
        store.status("Select at least two parts to group", "warning");
        return;
      }
      groupParts(ctx.selection);
    },
    isEnabled: (ctx: ToolContext) => ctx.selection.length >= 2,
  },
  {
    id: "edit.ungroup",
    name: "Ungroup",
    category: "edit",
    icon: "⛓️‍💥",
    description: "Remove selected parts from their group.",
    hint: "Clears the group assignment for each selected part.",
    shortcut: "Ctrl+Shift+G",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["split", "release"],
    undoable: true,
    execute: (ctx: ToolContext) => {
      if (ctx.selection.length === 0) {
        store.status("Nothing selected to ungroup", "warning");
        return;
      }
      ungroupParts(ctx.selection);
    },
    isEnabled: (ctx: ToolContext) => ctx.selection.length > 0,
  },
  {
    id: "edit.selectAll",
    name: "Select All",
    category: "edit",
    icon: "▤",
    description: "Select every part in the project.",
    hint: "Adds all parts in the current project to the selection.",
    shortcut: "Ctrl+A",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["all", "everything"],
    undoable: false,
    execute: (ctx: ToolContext) => {
      select(ctx.project.parts.map((p) => p.id));
    },
  },
  {
    id: "edit.deselect",
    name: "Deselect",
    category: "edit",
    icon: "▢",
    description: "Clear the current selection.",
    hint: "Deselects all parts and connectors.",
    shortcut: "Escape",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["clear", "none"],
    undoable: false,
    execute: () => {
      selectOne(null);
    },
    isEnabled: (ctx: ToolContext) => ctx.selection.length > 0,
  },
  {
    id: "edit.isolate",
    name: "Isolate",
    category: "edit",
    icon: "◎",
    description: "Focus on just the active part.",
    hint: "Narrows the selection down to only the currently active part.",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["focus", "solo"],
    undoable: false,
    execute: (ctx: ToolContext) => {
      if (!ctx.activePartId) {
        store.status("Select a part to isolate first", "warning");
        return;
      }
      selectOne(ctx.activePartId);
    },
    isEnabled: (ctx: ToolContext) => ctx.activePartId != null,
  },
];
