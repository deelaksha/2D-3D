import React, { useState, useEffect, useRef } from "react";
import ExportPreviewPanel from "./ExportPreviewPanel";

interface ToolCall {
  tool: string;
  arguments: Record<string, any>;
}

interface Message {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  imageBase64?: string;
  visionAnalysis?: string;
  toolCalls?: ToolCall[];
  modelId?: string;
  timestamp: string;
}

interface ModelDetails {
  model_id: string;
  version: number;
  object: string;
  style: string;
  materials: string[];
  colors: string[];
  parts: string[];
  complexity: string;
  status: string;
  file_path?: string;
}

const BACKEND_URL = "http://localhost:8000";

import AIDesignerPanel from "../designer/AIDesignerPanel";

export { AIDesignerPanel };

export default function AiAssistantPanel() {
  return <AIDesignerPanel />;
}

function LegacyAiAssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "👋 Hi! I am your Local AI 3D Model Generator powered by Qwen. Upload an image to extract 3D specs with qwen2.5vl:7b or type a prompt!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<"connecting" | "healthy" | "error">("connecting");
  const [llmProvider, setLlmProvider] = useState<"ollama" | "mock">("ollama");
  const [llmAwake, setLlmAwake] = useState<boolean>(false);
  const [isAwakening, setIsAwakening] = useState<boolean>(false);
  const [llmModelName, setLlmModelName] = useState<string>("qwen3:8b");
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [activeModelDetails, setActiveModelDetails] = useState<ModelDetails | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"glb" | "obj" | "fbx">("glb");
  const [progressPercent, setProgressPercent] = useState(0);
  const [thinkingStage, setThinkingStage] = useState("Analyzing prompt...");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic progress & stage animation when AI is thinking
  useEffect(() => {
    if (!loading) {
      setProgressPercent(0);
      setElapsedMs(0);
      return;
    }

    const startTime = Date.now();
    const hasImage = Boolean(selectedImageBase64);
    
    const stages = hasImage
      ? [
          { threshold: 0, text: "👁️ qwen2.5vl:7b reading & analyzing uploaded image..." },
          { threshold: 22, text: "🧠 Feeding visual analysis into local text LLM agent..." },
          { threshold: 48, text: "🛠️ Synthesizing 3D specs & parameters from image..." },
          { threshold: 72, text: "⚡ Executing 3D mesh generator tools..." },
          { threshold: 88, text: "📦 Compiling & exporting 3D GLB model..." },
        ]
      : [
          { threshold: 0, text: "🧠 Analyzing natural language prompt..." },
          { threshold: 20, text: "🔮 Querying local LLM agent..." },
          { threshold: 45, text: "🛠️ Synthesizing 3D spec & tool parameters..." },
          { threshold: 70, text: "⚡ Executing 3D mesh generator tools..." },
          { threshold: 88, text: "📦 Finalizing & compiling 3D GLB export..." },
        ];

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      const calculatedProgress = Math.min(94, Math.floor((1 - Math.exp(-elapsed / 2200)) * 96));
      setProgressPercent(calculatedProgress);

      const matchedStage = stages.reduce((prev, curr) =>
        calculatedProgress >= curr.threshold ? curr : prev
      );
      setThinkingStage(matchedStage.text);
    }, 80);

    return () => clearInterval(interval);
  }, [loading, selectedImageBase64]);

  // Awaken local AI model into VRAM/RAM
  const handleAwakenModel = async (silent = false) => {
    if (isAwakening) return;
    setIsAwakening(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ai/awaken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_alive: "60m" }),
      });
      const data = await res.json();
      if (data.is_awake || data.success) {
        setLlmAwake(true);
        if (!silent) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: "system",
              text: `⚡ Local AI Model (${data.model || llmModelName}) is now AWAKE and preloaded into VRAM! Ready for fast generation.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      }
    } catch (err: any) {
      console.warn("Awaken error:", err);
    } finally {
      setIsAwakening(false);
    }
  };

  // Switch between Ollama and Mock AI
  const handleToggleProvider = async () => {
    const nextProvider = llmProvider === "ollama" ? "mock" : "ollama";
    try {
      const res = await fetch(`${BACKEND_URL}/ai/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: nextProvider }),
      });
      const data = await res.json();
      if (data.success) {
        setLlmProvider(nextProvider);
        setLlmAwake(Boolean(data.llm_awake));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "system",
            text: `🔄 Active AI Engine changed to: ${nextProvider === "mock" ? "Mock AI (Instant Mock Engine)" : "Local Qwen (Ollama Engine)"}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      console.error("Mode toggle error:", err);
    }
  };

  // Health check polling
  useEffect(() => {
    let timer: any;
    const checkHealth = () => {
      fetch(`${BACKEND_URL}/health`)
        .then((res) => res.json())
        .then((data) => {
          setBackendHealth(data.status === "healthy" ? "healthy" : "error");
          if (data.llm_provider) setLlmProvider(data.llm_provider);
          if (typeof data.llm_awake === "boolean") setLlmAwake(data.llm_awake);
          if (data.llm_model) setLlmModelName(data.llm_model);
        })
        .catch(() => {
          setBackendHealth("error");
          setLlmAwake(false);
        });
    };

    checkHealth();
    timer = setInterval(checkHealth, 4000);
    return () => clearInterval(timer);
  }, []);

  // Background auto-awaken on mount if backend is healthy
  useEffect(() => {
    if (backendHealth === "healthy" && !llmAwake && llmProvider === "ollama") {
      handleAwakenModel(true);
    }
  }, [backendHealth, llmAwake, llmProvider]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, thinkingStage]);

  // Fetch model details on model change
  useEffect(() => {
    if (!currentModelId) return;
    fetch(`${BACKEND_URL}/models/${currentModelId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setActiveModelDetails(data);
      })
      .catch((err) => console.error("Error fetching model details:", err));
  }, [currentModelId, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendPrompt = async (promptText?: string) => {
    const promptToSend = promptText || inputPrompt;
    const imageToSend = selectedImageBase64;

    if ((!promptToSend.trim() && !imageToSend) || loading) return;

    const userText = promptToSend.trim() || (imageToSend ? "Build a 3D model based on this uploaded image." : "");

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      imageBase64: imageToSend || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setSelectedImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          image_base64: imageToSend || undefined,
          conversation_id: conversationId || undefined,
        }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errData = await response.json();
          if (errData.detail) errorDetail = errData.detail;
        } catch {}
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      const data = await response.json();
      if (data.conversation_id) setConversationId(data.conversation_id);
      if (data.model_id) setCurrentModelId(data.model_id);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.reply,
        visionAnalysis: data.vision_analysis || undefined,
        toolCalls: data.tool_calls,
        modelId: data.model_id,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "system",
          text: `⚠️ Error communicating with Local AI Backend: ${err.message}. Hint: ensure 'python start_services.py' is running, or switch to Mock Mode above.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToolAction = async (endpoint: string, payload: object, actionName: string) => {
    if (!currentModelId || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/models/${currentModelId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Action failed: ${res.statusText}`);
      const result = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "ai",
          text: `✅ ${actionName} executed successfully!`,
          toolCalls: [{ tool: endpoint, arguments: result }],
          modelId: currentModelId,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      const modelRes = await fetch(`${BACKEND_URL}/models/${currentModelId}`);
      if (modelRes.ok) {
        const updated = await modelRes.json();
        setActiveModelDetails(updated);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          text: `❌ ${actionName} failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "📷 Upload image & build 3D model",
    "Create a futuristic black and red gaming chair",
    "Create a low-poly wooden dining table",
    "Export model as OBJ",
  ];

  return (
    <div className="wk-panel wk-ai-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        className="wk-panel__head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px",
          padding: "8px 10px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "12px" }}>🤖 AI 3D Generator</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Mode Switcher */}
          <button
            onClick={handleToggleProvider}
            title="Click to toggle between Local Qwen (Ollama) and Instant Mock AI"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid var(--wk-border, #4b5563)",
              background: llmProvider === "mock" ? "#6366f1" : "rgba(255,255,255,0.08)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {llmProvider === "mock" ? "⚡ Mock Mode" : "🦙 Ollama Qwen"}
          </button>

          {/* Model Status Badge & Awaken Action */}
          {backendHealth === "healthy" ? (
            llmProvider === "mock" ? (
              <span
                className="wk-badge"
                style={{ backgroundColor: "#8b5cf6", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
              >
                Mock Ready
              </span>
            ) : isAwakening ? (
              <span
                className="wk-badge"
                style={{ backgroundColor: "#3b82f6", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
              >
                🔄 Awakening...
              </span>
            ) : llmAwake ? (
              <span
                className="wk-badge"
                style={{ backgroundColor: "#10b981", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
              >
                🟢 Awake & Ready
              </span>
            ) : (
              <button
                onClick={() => handleAwakenModel(false)}
                title="AI model is sleeping. Click to awaken & preload into VRAM."
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#000",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ⚡ Awaken AI
              </button>
            )
          ) : backendHealth === "connecting" ? (
            <span
              className="wk-badge"
              style={{ backgroundColor: "#f59e0b", color: "#000", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
            >
              Connecting...
            </span>
          ) : (
            <span
              className="wk-badge"
              style={{ backgroundColor: "#ef4444", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
            >
              Backend Offline
            </span>
          )}
        </div>
      </div>

      {/* Offline Alert Banner */}
      {backendHealth === "error" && (
        <div
          style={{
            margin: "8px",
            padding: "8px 10px",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#fca5a5",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "3px" }}>⚠️ Local AI Backend is Offline</div>
          <div>To awaken the AI, start the service by running:</div>
          <code style={{ display: "block", marginTop: "4px", padding: "4px", background: "rgba(0,0,0,0.3)", borderRadius: "3px" }}>
            python start_services.py
          </code>
        </div>
      )}

      {/* Sleeping Model Alert Banner */}
      {backendHealth === "healthy" && !llmAwake && llmProvider === "ollama" && (
        <div
          style={{
            margin: "8px",
            padding: "8px 10px",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#fde68a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>AI Model Sleeping</strong>
            <div style={{ fontSize: "10px", opacity: 0.9 }}>Preload {llmModelName} into VRAM for fast generation.</div>
          </div>
          <button
            disabled={isAwakening}
            onClick={() => handleAwakenModel(false)}
            style={{
              padding: "4px 8px",
              backgroundColor: "#f59e0b",
              color: "#000",
              fontWeight: "bold",
              fontSize: "11px",
              border: "none",
              borderRadius: "4px",
              cursor: isAwakening ? "wait" : "pointer",
            }}
          >
            {isAwakening ? "Awakening..." : "⚡ Awaken"}
          </button>
        </div>
      )}

      {/* Active Model Status Card */}
      {activeModelDetails && (
        <div
          style={{
            padding: "10px",
            margin: "8px",
            backgroundColor: "var(--wk-surface-raised, #252830)",
            borderRadius: "6px",
            border: "1px solid var(--wk-border, #3a3f4d)",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: "bold", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>📦 Model: {activeModelDetails.model_id}</span>
            <span style={{ color: "var(--wk-primary, #3b82f6)" }}>v{activeModelDetails.version}</span>
          </div>
          <div>Object: {activeModelDetails.object} ({activeModelDetails.style})</div>
          {activeModelDetails.colors?.length > 0 && (
            <div>Colors: {activeModelDetails.colors.join(", ")}</div>
          )}
          {activeModelDetails.file_path && (
            <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                onClick={() => setPreviewOpen(true)}
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  border: "none",
                  borderRadius: "5px",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Preview the generated model inside the browser"
              >
                👁 Preview {exportFormat.toUpperCase()}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              backgroundColor:
                msg.sender === "user"
                  ? "#2563eb"
                  : msg.sender === "system"
                  ? "#7f1d1d"
                  : "var(--wk-surface-raised, #2d3139)",
              color: "#ffffff",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              lineHeight: "1.4",
            }}
          >
            {/* User Uploaded Image Thumbnail */}
            {msg.imageBase64 && (
              <div style={{ marginBottom: "6px" }}>
                <img
                  src={msg.imageBase64}
                  alt="Uploaded target"
                  style={{
                    maxHeight: "120px",
                    maxWidth: "100%",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    objectFit: "cover",
                  }}
                />
              </div>
            )}

            <div>{msg.text}</div>

            {/* Qwen2.5-VL Vision Reading Analysis Card */}
            {msg.visionAnalysis && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  borderLeft: "3px solid #3b82f6",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>👁️ Qwen2.5-VL Vision Analysis</span>
                </div>
                <div style={{ opacity: 0.95, whiteSpace: "pre-wrap" }}>{msg.visionAnalysis}</div>
              </div>
            )}

            {/* Executed Tools */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                <span style={{ fontSize: "10px", opacity: 0.8 }}>Tools executed:</span>
                {msg.toolCalls.map((tc, idx) => (
                  <div key={idx} style={{ fontSize: "10px", fontFamily: "monospace", color: "#60a5fa" }}>
                    ⚙️ {tc.tool}({JSON.stringify(tc.arguments)})
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: "9px", opacity: 0.5, textAlign: "right", marginTop: "4px" }}>
              {msg.timestamp}
            </div>
          </div>
        ))}

        {/* AI Progress Card */}
        {loading && (
          <div className="wk-ai-thinking-card">
            <div className="wk-ai-avatar-container">
              <div className="wk-ai-avatar-pulse">{selectedImageBase64 ? "👁️" : "🤖"}</div>
              <div style={{ flex: 1 }}>
                <div className="wk-ai-status-text">
                  <span>
                    {selectedImageBase64 ? "Qwen2.5-VL Reading Image" : "AI Thinking"}
                    <span className="wk-ai-thinking-dots">
                      <span className="wk-ai-dot"></span>
                      <span className="wk-ai-dot"></span>
                      <span className="wk-ai-dot"></span>
                    </span>
                  </span>
                  <span className="wk-ai-stage-badge">{(elapsedMs / 1000).toFixed(1)}s • {progressPercent}%</span>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px", fontWeight: 500 }}>
                  {thinkingStage}
                </div>
              </div>
            </div>
            <div className="wk-ai-progress-track">
              <div
                className="wk-ai-progress-bar"
                style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected Image Preview Thumbnail */}
      {selectedImageBase64 && (
        <div
          style={{
            padding: "6px 10px",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderTop: "1px solid var(--wk-border, #3a3f4d)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <img
            src={selectedImageBase64}
            alt="Preview"
            style={{ width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover", border: "1px solid #3b82f6" }}
          />
          <div style={{ flex: 1, fontSize: "11px", color: "#93c5fd" }}>
            Image selected for Qwen2.5-VL Vision Reading
          </div>
          <button
            type="button"
            onClick={handleClearImage}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              fontSize: "14px",
              cursor: "pointer",
              padding: "2px 6px",
            }}
            title="Remove image"
          >
            ✖
          </button>
        </div>
      )}

      {/* Suggested Prompt Chips */}
      <div style={{ padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            className="wk-chip"
            style={{ cursor: "pointer", fontSize: "10px", background: "var(--wk-surface-raised, #252830)", border: "1px solid var(--wk-border, #3a3f4d)", color: "#e2e8f0" }}
            onClick={() => {
              if (s.startsWith("📷")) {
                fileInputRef.current?.click();
              } else {
                handleSendPrompt(s);
              }
            }}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Manual Tool Quick Actions */}
      {currentModelId && (
        <div style={{ padding: "6px 10px", borderTop: "1px solid var(--wk-border, #3a3f4d)", display: "flex", gap: "4px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="wk-btn"
            style={{ fontSize: "10px", padding: "3px 6px" }}
            onClick={() => handleToolAction("validate", {}, "Validate Model")}
            disabled={loading}
          >
            🔍 Validate
          </button>
          <button
            type="button"
            className="wk-btn"
            style={{ fontSize: "10px", padding: "3px 6px" }}
            onClick={() => handleToolAction("optimize", { operations: ["make_game_ready"] }, "Optimize Model")}
            disabled={loading}
          >
            ⚡ Optimize
          </button>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            style={{ fontSize: "10px", background: "var(--wk-surface-raised)", color: "#fff", border: "1px solid var(--wk-border)", borderRadius: "4px", padding: "2px" }}
          >
            <option value="glb">GLB</option>
            <option value="obj">OBJ</option>
            <option value="fbx">FBX</option>
          </select>
          <button
            type="button"
            className="wk-btn"
            style={{ fontSize: "10px", padding: "3px 6px" }}
            onClick={() => handleToolAction("export", { format: exportFormat }, `Export ${exportFormat.toUpperCase()}`)}
            disabled={loading}
          >
            📤 Export
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageSelect}
        style={{ display: "none" }}
      />

      {/* Input Box */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--wk-border, #3a3f4d)", display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            background: selectedImageBase64 ? "#3b82f6" : "var(--wk-surface-raised, #252830)",
            color: "#ffffff",
            border: "1px solid var(--wk-border, #3a3f4d)",
            borderRadius: "6px",
            padding: "8px 10px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Upload image for Qwen2.5-VL vision analysis"
        >
          🖼️
        </button>

        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendPrompt()}
          placeholder={selectedImageBase64 ? "Describe extra details for image or press Send..." : "Type prompt or click 🖼️ to upload image..."}
          disabled={loading}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid var(--wk-border, #3a3f4d)",
            backgroundColor: "var(--wk-bg, #1a1d23)",
            color: "#ffffff",
            fontSize: "12px",
            outline: "none",
          }}
        />
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          onClick={() => handleSendPrompt()}
          disabled={loading || (!inputPrompt.trim() && !selectedImageBase64)}
          style={{ padding: "8px 14px", fontSize: "12px" }}
        >
          Send
        </button>
      </div>

      {/* ── In-browser Export Preview Modal ── */}
      {previewOpen && activeModelDetails?.file_path && (
        <ExportPreviewPanel
          modelId={activeModelDetails.model_id}
          filePath={activeModelDetails.file_path}
          backendUrl={BACKEND_URL}
          exportFormat={exportFormat}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
