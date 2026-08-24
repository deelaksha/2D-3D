/**
 * CanvasBoard — The dedicated Board View (Print Board & Sheet Nesting page).
 *
 * Features:
 * - Fits all project parts onto standard stock wooden sheets (A4 297x210 mm, A3, Laser Bed).
 * - Automatic Nesting / Packing algorithm + Interactive manual dragging & 90° rotation.
 * - Annotated blueprint detailing sheet size (297 mm A4), part counts (e.g. 2 pcs Wall with Window),
 *   material thickness (3 mm THICKNESS), and tab/slot close-up diagrams.
 * - Perforated lines / tearable sheet lines generator.
 * - Direct Printout (`window.print()`) & SVG Cut-Sheet Export.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useProject, store } from "@/core/store/store";
import { formatLength } from "@/core/units";
import { packPartsOnSheets, STANDARD_SHEETS, type PackedItem, type SheetPreset } from "./nesting";
import { boundsOfPoints, shapeOutline } from "@/core/geometry/outline";

export default function CanvasBoard(): JSX.Element {
  const project = useProject();

  // Sheet configuration state
  const [selectedSheetId, setSelectedSheetId] = useState<string>("a4");
  const [customWidth, setCustomWidth] = useState<number>(297);
  const [customHeight, setCustomHeight] = useState<number>(210);
  const [margin, setMargin] = useState<number>(8);
  const [gap, setGap] = useState<number>(4);
  // Production defaults: only black cut paths are sent to print/SVG. Guides
  // are optional because a laser must not interpret them as additional cuts.
  const [showPerforations, setShowPerforations] = useState<boolean>(false);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Quantities per part (defaults to 1, or 2 for walls/roof if matching house kit)
  const [partQuantities, setPartQuantities] = useState<Record<string, number>>({});

  // Initialize default quantities whenever parts change
  useEffect(() => {
    setPartQuantities((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const p of project.parts) {
        if (next[p.id] === undefined) {
          // Default: 2 for walls/roof/floor if duplicate needed, else 1
          const lower = p.name.toLowerCase();
          if (lower.includes("wall") || lower.includes("roof") || lower.includes("floor")) {
            next[p.id] = 2;
          } else {
            next[p.id] = 1;
          }
        }
      }
      return next;
    });
  }, [project.parts]);

  // Current effective sheet dimensions
  const activePreset = STANDARD_SHEETS.find((s) => s.id === selectedSheetId);
  const sheetWidth = activePreset ? activePreset.width : customWidth;
  const sheetHeight = activePreset ? activePreset.height : customHeight;

  // Manual placements override (partInstanceId -> { x, y, rotated })
  const [manualOverrides, setManualOverrides] = useState<Record<string, { x: number; y: number; rotated: boolean }>>({});

  // Auto-nesting execution
  const nestingResult = useMemo(() => {
    const itemsToPack = project.parts.map((p) => ({
      part: p,
      quantity: partQuantities[p.id] ?? 1,
    }));

    return packPartsOnSheets(itemsToPack, sheetWidth, sheetHeight, margin, gap);
  }, [project.parts, partQuantities, sheetWidth, sheetHeight, margin, gap]);

  // Combined final packed items (auto-nested + manual overrides)
  const displayItems = useMemo(() => {
    return nestingResult.packed.map((item) => {
      const override = manualOverrides[item.id];
      if (override) {
        return {
          ...item,
          x: override.x,
          y: override.y,
          rotated: override.rotated,
          width: override.rotated ? item.originalHeight : item.originalWidth,
          height: override.rotated ? item.originalWidth : item.originalHeight,
        };
      }
      return item;
    });
  }, [nestingResult.packed, manualOverrides]);

  // Items on currently active sheet index
  const activeSheetItems = displayItems.filter((it) => it.sheetIndex === activeSheetIndex);

  // Dragging state for manual layout on sheet
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  const handlePointerDownItem = (e: React.PointerEvent, item: PackedItem) => {
    e.stopPropagation();
    setDraggingItemId(item.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerMoveSheet = (e: React.PointerEvent) => {
    if (!draggingItemId || !sheetContainerRef.current) return;
    const sheetRect = sheetContainerRef.current.getBoundingClientRect();
    const scale = sheetRect.width / sheetWidth; // px per mm

    const rawX = (e.clientX - sheetRect.left - dragOffset.x) / scale;
    const rawY = (e.clientY - sheetRect.top - dragOffset.y) / scale;

    // Snap to grid (1mm)
    const newX = Math.max(0, Math.min(sheetWidth - 10, Math.round(rawX)));
    const newY = Math.max(0, Math.min(sheetHeight - 10, Math.round(rawY)));

    const curItem = displayItems.find((it) => it.id === draggingItemId);
    if (!curItem) return;

    setManualOverrides((prev) => ({
      ...prev,
      [draggingItemId]: {
        x: newX,
        y: newY,
        rotated: curItem.rotated,
      },
    }));
  };

  const handlePointerUp = () => {
    setDraggingItemId(null);
  };

  const handleRotateItem = (itemId: string) => {
    const curItem = displayItems.find((it) => it.id === itemId);
    if (!curItem) return;
    setManualOverrides((prev) => ({
      ...prev,
      [itemId]: {
        x: curItem.x,
        y: curItem.y,
        rotated: !curItem.rotated,
      },
    }));
  };

  const handleAutoNest = () => {
    setManualOverrides({});
    store.status("Auto-nested all parts onto sheet board!", "ok");
  };

  const handleQuantityChange = (partId: string, delta: number) => {
    setPartQuantities((prev) => ({
      ...prev,
      [partId]: Math.max(1, (prev[partId] ?? 1) + delta),
    }));
  };

  // Direct Printout
  const handlePrint = () => {
    window.print();
  };

  // SVG Export
  const handleExportSVG = () => {
    const svgEl = sheetContainerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `WoodKit_Board_Sheet_${activeSheetIndex + 1}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    store.status("Exported sheet vector SVG for laser cutting!", "ok");
  };

  const outlinePath = (part: typeof project.parts[number], item: PackedItem, shape = part.shape) => {
    // Canvas parts are drawn in world-sized coordinates, whereas the packing
    // board starts every packed item at (0,0). Normalize all paths against the
    // base outline bounds so Board, 2D and 3D show the same physical geometry.
    const baseBounds = boundsOfPoints(shapeOutline(part.shape).flat());
    const sx = item.width / Math.max(1, baseBounds.maxX - baseBounds.minX);
    const sy = item.height / Math.max(1, baseBounds.maxY - baseBounds.minY);
    return shapeOutline(shape).map((loop) => loop.map((point, index) => `${index ? "L" : "M"} ${((point.x - baseBounds.minX) * sx).toFixed(3)} ${((point.y - baseBounds.minY) * sy).toFixed(3)}`).join(" ") + " Z").join(" ");
  };

  return (
    <div
      className="wk-board-page"
      onPointerMove={handlePointerMoveSheet}
      onPointerUp={handlePointerUp}
    >
      {/* ---- TOP CONTROL BAR ---- */}
      <div className="wk-board-topbar no-print">
        <div className="wk-board-title-group">
          <span className="wk-board-badge">BOARD PAGE</span>
          <h2>Joinable Wooden Sheet Layout</h2>
        </div>

        <div className="wk-board-controls">
          {/* Sheet Selector */}
          <div className="wk-board-field">
            <label>Sheet Size:</label>
            <select
              value={selectedSheetId}
              onChange={(e) => {
                setSelectedSheetId(e.target.value);
                setManualOverrides({});
              }}
            >
              {STANDARD_SHEETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.width} × {s.height} mm)
                </option>
              ))}
              <option value="custom">Custom Size</option>
            </select>
          </div>

          {selectedSheetId === "custom" && (
            <div className="wk-board-field-group">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                style={{ width: 60 }}
              />
              <span>×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                style={{ width: 60 }}
              />
              <span>mm</span>
            </div>
          )}

          {/* Margin & Spacing */}
          <div className="wk-board-field">
            <label>Margin:</label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(Math.max(0, Number(e.target.value)))}
              style={{ width: 45 }}
            />
            <span>mm</span>
          </div>

          <div className="wk-board-field">
            <label>Gap:</label>
            <input
              type="number"
              value={gap}
              onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
              style={{ width: 45 }}
            />
            <span>mm</span>
          </div>

          {/* Display Toggles */}
          <button
            type="button"
            className={`wk-btn wk-btn--sm ${showPerforations ? "wk-btn--active" : ""}`}
            onClick={() => setShowPerforations(!showPerforations)}
            title="Toggle tearable perforation lines"
          >
            ✂ Perforations
          </button>

          <button
            type="button"
            className={`wk-btn wk-btn--sm ${showDimensions ? "wk-btn--active" : ""}`}
            onClick={() => setShowDimensions(!showDimensions)}
          >
            📏 Dimensions
          </button>

          <button
            type="button"
            className="wk-btn wk-btn--secondary"
            onClick={handleAutoNest}
            title="Auto-pack parts onto sheet"
          >
            🧩 Auto-Nest
          </button>

          {/* Print & Export Actions */}
          <button type="button" className="wk-btn wk-btn--primary" onClick={handlePrint}>
            🖨 Take Printout
          </button>
          <button type="button" className="wk-btn wk-btn--accent" onClick={handleExportSVG}>
            ⚡ Export SVG (Laser Cut)
          </button>
        </div>
      </div>

      {/* ---- MAIN CONTENT LAYOUT ---- */}
      <div className="wk-board-body">
        {/* SIDEBAR: PARTS BREAKDOWN & QUANTITY MANAGER */}
        <div className="wk-board-sidebar no-print">
          <div className="wk-board-card">
            <h3>Parts Required & Quantity</h3>
            <p className="wk-card-subtitle">Set quantities to fit all pieces on your printout sheet.</p>

            <div className="wk-parts-qty-list">
              {project.parts.map((p) => {
                const qty = partQuantities[p.id] ?? 1;
                return (
                  <div key={p.id} className="wk-part-qty-row">
                    <div className="wk-part-qty-info">
                      <span className="wk-part-qty-name">{p.name}</span>
                      <span className="wk-part-qty-dim">
                        {p.width} × {p.height} mm (THK: {p.thickness} mm)
                      </span>
                    </div>

                    <div className="wk-qty-counter">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(p.id, -1)}
                        disabled={qty <= 1}
                      >
                        -
                      </button>
                      <span>{qty} pcs</span>
                      <button type="button" onClick={() => handleQuantityChange(p.id, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NESTING METRICS CARD */}
          <div className="wk-board-card">
            <h3>Sheet Utilization</h3>
            <div className="wk-metric-row">
              <span>Total Sheets Needed:</span>
              <strong>{nestingResult.totalSheets} Sheet(s)</strong>
            </div>
            <div className="wk-metric-row">
              <span>Sheet Packing Efficiency:</span>
              <strong style={{ color: nestingResult.efficiency > 70 ? "var(--wk-green)" : "var(--wk-accent)" }}>
                {nestingResult.efficiency}%
              </strong>
            </div>

            {nestingResult.totalSheets > 1 && (
              <div className="wk-sheet-tabs">
                <span>View Sheet:</span>
                {Array.from({ length: nestingResult.totalSheets }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`wk-sheet-tab ${activeSheetIndex === i ? "active" : ""}`}
                    onClick={() => setActiveSheetIndex(i)}
                  >
                    Sheet {i + 1}
                  </button>
                ))}
              </div>
            )}

            {nestingResult.unpacked.length > 0 && (
              <div className="wk-warning-box">
                ⚠️ {nestingResult.unpacked.length} part(s) could not fit. Try selecting a larger sheet (A3/Laser Bed) or reducing margins.
              </div>
            )}
          </div>

          {/* TAB & SLOT CLOSE-UP DIAGRAM */}
          <div className="wk-board-card">
            <h3>Tab & Slot Joint Detail</h3>
            <div className="wk-joint-detail-box">
              <div className="wk-joint-item">
                <svg width="70" height="40" viewBox="0 0 70 40">
                  <path d="M 5 35 L 25 35 L 25 15 L 45 15 L 45 35 L 65 35" fill="#e2ab6b" stroke="#7c4e20" strokeWidth="2" />
                </svg>
                <span>TAB (OUTWARD)</span>
              </div>
              <div className="wk-joint-item">
                <svg width="70" height="40" viewBox="0 0 70 40">
                  <path d="M 5 15 L 25 15 L 25 35 L 45 35 L 45 15 L 65 15" fill="#e2ab6b" stroke="#7c4e20" strokeWidth="2" />
                </svg>
                <span>SLOT (INWARD)</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER VIEWPORT: THE PRINTABLE BOARD CANVAS */}
        <div className="wk-board-viewport">
          <div className="wk-sheet-canvas-container" ref={sheetContainerRef}>
            {/* Sheet Dimension Header */}
            {showDimensions && (
              <div className="wk-sheet-dim-header">
                <span>← {sheetWidth} mm ({activePreset?.name || "Full Sheet"}) →</span>
              </div>
            )}

            {/* THE SVG BOARD SHEET */}
            <svg
              width={`${sheetWidth}mm`}
              height={`${sheetHeight}mm`}
              viewBox={`-30 -30 ${sheetWidth + 60} ${sheetHeight + 70}`}
              style={{ aspectRatio: `${sheetWidth} / ${sheetHeight}` }}
              className="wk-printable-svg"
            >
              <defs>
                {/* Wood Grain Texture Pattern */}
                <pattern id="wood-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="#f2cb9b" />
                  <path d="M 0 10 Q 20 15 40 10 M 0 25 Q 20 20 40 25 M 0 35 Q 20 38 40 35" fill="none" stroke="#e0b27b" strokeWidth="1.2" />
                </pattern>

                <filter id="sheet-shadow" x="-5%" y="-5%" width="110%" height="110%">
                  <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000000" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* SHEET BACKGROUND (Full Sheet 297mm x 210mm) */}
              <rect
                x={0}
                y={0}
                width={sheetWidth}
                height={sheetHeight}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="0.5"
              />

              {/* SHEET INNER MARGIN BOUNDARY */}
              <rect
                x={margin}
                y={margin}
                width={sheetWidth - margin * 2}
                height={sheetHeight - margin * 2}
                fill="none"
                stroke="#777777"
                strokeWidth="0.3"
                strokeDasharray="4 3"
              />

              {/* SHEET DIMENSION ANNOTATIONS */}
              {showDimensions && (
                <g className="wk-dim-annotations">
                  {/* Bottom Horizontal Dimension Line */}
                  <line x1={0} y1={sheetHeight + 18} x2={sheetWidth} y2={sheetHeight + 18} stroke="#1e293b" strokeWidth="1.5" />
                  <line x1={0} y1={sheetHeight + 12} x2={0} y2={sheetHeight + 24} stroke="#1e293b" strokeWidth="1.5" />
                  <line x1={sheetWidth} y1={sheetHeight + 12} x2={sheetWidth} y2={sheetHeight + 24} stroke="#1e293b" strokeWidth="1.5" />
                  <text x={sheetWidth / 2} y={sheetHeight + 34} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">
                    {sheetWidth} mm ({selectedSheetId === "a4" ? "A4 SIZE" : "SHEET WIDTH"})
                  </text>

                  {/* Left Vertical Dimension Line */}
                  <line x1={-18} y1={0} x2={-18} y2={sheetHeight} stroke="#1e293b" strokeWidth="1.5" />
                  <line x1={-24} y1={0} x2={-12} y2={0} stroke="#1e293b" strokeWidth="1.5" />
                  <line x1={-24} y1={sheetHeight} x2={-12} y2={sheetHeight} stroke="#1e293b" strokeWidth="1.5" />
                  <text
                    x={-26}
                    y={sheetHeight / 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#1e293b"
                    transform={`rotate(-90 ${-26} ${sheetHeight / 2})`}
                  >
                    {sheetHeight} mm
                  </text>
                </g>
              )}

              {/* TEARABLE PERFORATION GRID LINES */}
              {showPerforations && (
                <g className="wk-perforations">
                  {activeSheetItems.map((item) => (
                    <g key={`perf-${item.id}`}>
                      {/* Dashed Tear Lines around individual piece footprints */}
                      <rect
                        x={item.x - gap / 2}
                        y={item.y - gap / 2}
                        width={item.width + gap}
                        height={item.height + gap}
                        fill="none"
                        stroke="#555555"
                        strokeWidth="0.25"
                        strokeDasharray="3 3"
                      />
                    </g>
                  ))}
                </g>
              )}

              {/* PACKED PARTS PLACED ON THE SHEET */}
              {activeSheetItems.map((item) => {
                const part = project.parts.find((p) => p.id === item.partId);
                if (!part) return null;

                const isDragging = draggingItemId === item.id;

                return (
                  <g
                    key={item.id}
                    transform={`translate(${item.x}, ${item.y})`}
                    onPointerDown={(e) => handlePointerDownItem(e, item)}
                    onDoubleClick={() => handleRotateItem(item.id)}
                    style={{ cursor: isDragging ? "grabbing" : "grab" }}
                  >
                    {/* Production cut paths: black vector outlines on white stock. */}
                    <path d={outlinePath(part, item)} fill="none" stroke="#000000" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />

                    {/* Render Modifiers (e.g. Window Cutout) */}
                    {part.modifiers.map((mod) => {
                      if (mod.op === "subtract" && mod.shape) {
                        return (
                          <path
                            key={mod.id}
                            d={outlinePath(part, item, mod.shape)}
                            fill="#ffffff"
                            stroke="#000000"
                            strokeWidth="0.35"
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      }
                      return null;
                    })}

                    {/* Union features are also emitted as black vectors for the laser. */}
                    {part.modifiers.filter((mod) => mod.op === "union").map((mod) => <path key={mod.id} d={outlinePath(part, item, mod.shape)} fill="none" stroke="#000000" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />)}

                    {/* Part Title Label & Dimensions */}
                    {showLabels && (
                      <g transform={`translate(${item.width / 2}, ${item.height / 2})`}>
                        <rect
                          x={-item.width / 2 + 4}
                          y={-12}
                          width={item.width - 8}
                          height="24"
                          fill="rgba(255,255,255,0.85)"
                          rx="4"
                        />
                        <text
                          x={0}
                          y={-1}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#0f172a"
                        >
                          {part.name}
                        </text>
                        <text
                          x={0}
                          y={9}
                          textAnchor="middle"
                          fontSize="7.5"
                          fontWeight="600"
                          fill="#475569"
                        >
                          {item.originalWidth}×{item.originalHeight}mm ({part.thickness}mm THK)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
