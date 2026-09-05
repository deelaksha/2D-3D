import React, { useRef, useState, useEffect } from "react";
import { useThreeGLTFViewer } from "./useThreeGLTFViewer";

interface ExportPreviewPanelProps {
  modelId: string;
  filePath: string;          // relative path, e.g. "models/abc.glb"
  backendUrl: string;
  exportFormat: "glb" | "obj" | "fbx";
  onClose: () => void;
}

/** Helper: trigger a browser download from a URL. */
function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * ExportPreviewPanel — in-browser 2D + 3D preview of generated models.
 *
 * Two tabs:
 *  - "2D" — fetches and renders the SVG cut-sheet inline (zoom/pan)
 *  - "3D" — renders the GLB/OBJ in an embedded WebGL Three.js canvas
 *
 * Download buttons are opt-in only, no automatic download occurs.
 */
export default function ExportPreviewPanel({
  modelId,
  filePath,
  backendUrl,
  exportFormat,
  onClose,
}: ExportPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<"2d" | "3d">("3d");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [svgLoading, setSvgLoading] = useState(false);
  const [svgError, setSvgError] = useState<string | null>(null);
  const [svgScale, setSvgScale] = useState(1.0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelUrl = filePath ? `${backendUrl}/${filePath}` : null;
  const glbFormat = exportFormat === "fbx" ? "glb" : exportFormat;

  const { loading: modelLoading, error: modelError, wireframe, showGrid, toggleWireframe, toggleGrid, resetCamera } =
    useThreeGLTFViewer(canvasRef, activeTab === "3d" ? modelUrl : null, glbFormat === "obj" ? "obj" : "glb");

  // Fetch SVG when 2D tab is activated
  useEffect(() => {
    if (activeTab !== "2d" || svgContent !== null) return;
    setSvgLoading(true);
    setSvgError(null);
    fetch(`${backendUrl}/models/${modelId}/svg`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        setSvgContent(text);
        setSvgLoading(false);
      })
      .catch((e) => {
        setSvgError(`Could not load SVG: ${e.message}`);
        setSvgLoading(false);
      });
  }, [activeTab, svgContent, backendUrl, modelId]);

  const modelFilename = filePath.split("/").pop() || `model.${exportFormat}`;
  const svgFilename = `${modelId}_layout.svg`;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const panelStyle: React.CSSProperties = {
    background: "#1a1d23",
    border: "1px solid #3a3f4d",
    borderRadius: "12px",
    width: "min(90vw, 860px)",
    height: "min(88vh, 640px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: active ? 700 : 400,
    color: active ? "#ffffff" : "#9ca3af",
    background: active ? "#2563eb" : "transparent",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const toolbarBtnStyle = (active = false): React.CSSProperties => ({
    padding: "5px 10px",
    fontSize: "11px",
    background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.07)",
    border: `1px solid ${active ? "#3b82f6" : "#4b5563"}`,
    borderRadius: "5px",
    color: "#e5e7eb",
    cursor: "pointer",
  });

  const downloadBtnStyle: React.CSSProperties = {
    padding: "6px 14px",
    fontSize: "12px",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "5px",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #2d3139",
            gap: "10px",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "14px", color: "#f3f4f6" }}>
            👁 Model Preview — <span style={{ color: "#9ca3af", fontWeight: 400 }}>{modelId}</span>
          </span>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: "4px", background: "#111216", borderRadius: "8px", padding: "3px" }}>
            <button style={tabStyle(activeTab === "3d")} onClick={() => setActiveTab("3d")}>
              🧊 3D Viewer
            </button>
            <button style={tabStyle(activeTab === "2d")} onClick={() => setActiveTab("2d")}>
              📐 2D Layout
            </button>
          </div>

          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}
            title="Close preview"
          >
            ✕
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderBottom: "1px solid #2d3139",
            background: "#13161b",
          }}
        >
          {activeTab === "3d" ? (
            <>
              <button style={toolbarBtnStyle()} onClick={resetCamera} title="Reset camera to fit model">
                🎯 Reset Camera
              </button>
              <button style={toolbarBtnStyle(wireframe)} onClick={toggleWireframe} title="Toggle wireframe mode">
                {wireframe ? "◆ Solid" : "◇ Wireframe"}
              </button>
              <button style={toolbarBtnStyle(showGrid)} onClick={toggleGrid} title="Toggle floor grid">
                {showGrid ? "▦ Hide Grid" : "▦ Show Grid"}
              </button>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                {modelUrl && (
                  <>
                    <button
                      style={downloadBtnStyle}
                      onClick={() => triggerDownload(modelUrl, modelFilename)}
                      title="Download 3D model file"
                    >
                      ⬇ Save {exportFormat.toUpperCase()}
                    </button>
                    {exportFormat !== "obj" && (
                      <button
                        style={{ ...downloadBtnStyle, background: "linear-gradient(135deg,#16a34a,#15803d)" }}
                        onClick={() => triggerDownload(`${backendUrl}/models/${modelId}/obj`, `${modelId}.obj`)}
                        title="Download OBJ version"
                      >
                        ⬇ Save OBJ
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <button style={toolbarBtnStyle()} onClick={() => setSvgScale((s) => Math.min(4, s + 0.25))} title="Zoom in">
                🔍+
              </button>
              <button style={toolbarBtnStyle()} onClick={() => setSvgScale((s) => Math.max(0.25, s - 0.25))} title="Zoom out">
                🔍−
              </button>
              <button style={toolbarBtnStyle()} onClick={() => setSvgScale(1)} title="Reset zoom">
                ↺ Fit
              </button>
              <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "4px" }}>
                {Math.round(svgScale * 100)}%
              </span>
              <div style={{ marginLeft: "auto" }}>
                {svgContent && (
                  <button
                    style={downloadBtnStyle}
                    onClick={() => {
                      const blob = new Blob([svgContent], { type: "image/svg+xml" });
                      triggerDownload(URL.createObjectURL(blob), svgFilename);
                    }}
                    title="Download SVG file"
                  >
                    ⬇ Save SVG
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Content area ── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* 3D WebGL canvas */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: activeTab === "3d" ? "block" : "none",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
            {modelLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  gap: "12px",
                  background: "rgba(26,29,35,0.8)",
                }}
              >
                <div style={{ fontSize: "32px" }}>⏳</div>
                <div style={{ fontSize: "14px" }}>Loading 3D model…</div>
              </div>
            )}
            {modelError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f87171",
                  gap: "8px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px" }}>⚠️</div>
                <div style={{ fontSize: "13px" }}>{modelError}</div>
              </div>
            )}
            {/* Orbit hint */}
            {!modelLoading && !modelError && (
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "11px",
                  color: "#4b5563",
                  background: "rgba(0,0,0,0.5)",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  pointerEvents: "none",
                }}
              >
                Drag to rotate · Scroll to zoom · Right-drag to pan
              </div>
            )}
          </div>

          {/* 2D SVG viewer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: activeTab === "2d" ? "flex" : "none",
              alignItems: "flex-start",
              justifyContent: "center",
              overflow: "auto",
              background: "#0f1014",
              padding: "16px",
            }}
          >
            {svgLoading && (
              <div style={{ color: "#9ca3af", margin: "auto", fontSize: "14px" }}>
                ⏳ Loading SVG layout…
              </div>
            )}
            {svgError && (
              <div style={{ color: "#f87171", margin: "auto", fontSize: "13px", textAlign: "center" }}>
                ⚠️ {svgError}
                <br />
                <span style={{ color: "#6b7280", fontSize: "11px" }}>
                  Make sure the backend exposes <code>/models/{"{id}"}/svg</code>
                </span>
              </div>
            )}
            {svgContent && !svgLoading && (
              <div
                style={{
                  transform: `scale(${svgScale})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s",
                  maxWidth: "100%",
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
