import { Fragment, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useProject, useUI } from "@/core/store/store";
import {
  deletePart,
  duplicatePart,
  renamePart,
  reorderPart,
  selectConnector,
  selectOne,
  setPartLock,
  setPartVisibility,
  toggleSelect,
} from "@/core/store/actions";
import type { Part } from "@/core/model/types";

/** Left-panel layer list: parts ordered by `order`, with visibility/lock/rename/reorder + connector children. */
export default function LayersPanel() {
  const project = useProject();
  const ui = useUI();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const parts = [...project.parts].sort((a, b) => a.order - b.order);
  const groupById = new Map(project.groups.map((group) => [group.id, group]));

  function startRename(part: Part) {
    setRenamingId(part.id);
    setDraftName(part.name);
  }

  function commitRename(id: string) {
    const name = draftName.trim();
    if (name) renamePart(id, name);
    setRenamingId(null);
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setRenamingId(null);
    }
  }

  function handleRowClick(e: MouseEvent, id: string) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelect(id);
    else selectOne(id);
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, part: Part) {
    setDragId(part.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", part.id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, target: Part) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id || id === target.id) return;
    reorderPart(id, target.order);
  }

  return (
    <div className="wk-panel">
      <div className="wk-panel__head">Layers</div>
      <div className="wk-panel__body">
        {parts.map((part) => {
          const active = ui.selection.includes(part.id);
          const isRenaming = renamingId === part.id;
          const group = part.groupId ? groupById.get(part.groupId) : undefined;
          const isFirstInGroup = !!group && !parts.some((candidate) => candidate.groupId === group.id && candidate.order < part.order);
          return (
            <Fragment key={part.id}>
              {isFirstInGroup && <div className="wk-row" style={{ marginTop: 7, background: "rgba(245, 158, 11, .10)", color: "var(--wk-accent)", fontWeight: 700, fontSize: 11 }} title="Grouped parts move and select together"><span className="wk-row__icon">▣</span><span className="wk-row__name">{group.name}</span><span className="wk-chip">{parts.filter((candidate) => candidate.groupId === group.id).length} parts</span></div>}
              <div
                className={`wk-row${active ? " wk-row--active" : ""}${part.locked ? " wk-row--locked" : ""}${part.visible ? "" : " wk-row--hidden"}`}
                style={group ? { marginLeft: 14 } : undefined}
                draggable
                onDragStart={(e) => handleDragStart(e, part)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, part)}
                onClick={(e) => handleRowClick(e, part.id)}
              >
                <span className="wk-row__icon">{part.visible ? "■" : "□"}</span>
                {/* persistent state indicator (visible at rest, not just on hover) */}
                {part.locked && (
                  <span className="wk-row__state" title="Locked" aria-label="Locked">
                    {"\u{1F512}"}
                  </span>
                )}
                {isRenaming ? (
                  <span className="wk-row__name">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => commitRename(part.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, part.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                ) : (
                  <span
                    className="wk-row__name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(part);
                    }}
                  >
                    {part.name}
                  </span>
                )}
                <span className="wk-row__actions">
                  <button
                    className="wk-icon-btn"
                    title={part.visible ? "Hide" : "Show"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPartVisibility(part.id, !part.visible);
                    }}
                  >
                    {part.visible ? "\u{1F441}" : "\u{1F576}"}
                  </button>
                  <button
                    className={`wk-icon-btn${part.locked ? " wk-icon-btn--active" : ""}`}
                    title={part.locked ? "Unlock" : "Lock"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPartLock(part.id, !part.locked);
                    }}
                  >
                    {part.locked ? "\u{1F512}" : "\u{1F513}"}
                  </button>
                  <button
                    className="wk-icon-btn"
                    title="Duplicate"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePart(part.id);
                    }}
                  >
                    {"⎘"}
                  </button>
                  <button
                    className="wk-icon-btn"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePart(part.id);
                    }}
                  >
                    {"✕"}
                  </button>
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
