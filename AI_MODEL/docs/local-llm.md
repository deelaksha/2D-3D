# Local LLM Integration (Qwen via Ollama)

This document details the configuration and architecture for the local LLM integration in the 3D Model Generator application.

## Overview

The application relies on a locally hosted LLM via **Ollama** to parse natural language user prompts into structured 3D specifications and tool plans without cloud dependencies.

- **Selected Text Model**: `qwen3:8b` (Qwen3 8B parameter model)
- **Selected Vision Model**: `qwen2.5vl:7b` (Qwen2.5-VL 7B Vision-Language model for reading uploaded images)
- **Quantization**: `Q4_K_M` GGUF
- **Provider**: Ollama Local HTTP API
- **Endpoint**: `http://localhost:11434`

## Hardware & Resource Requirements

- **Model Size on Disk**: ~5.2 GB (text) + ~5.5 GB (vision)
- **VRAM / RAM Requirement**: ~6–8 GB system RAM or GPU VRAM for optimal inference latency.
- **Capabilities**: Image analysis & feature extraction, structured output JSON generation, tool calling, multi-turn reasoning.

## Installation & Setup

1. **Install Ollama**: Download and install Ollama from [https://ollama.com](https://ollama.com).
2. **Pull the Qwen & Vision Models**:
   ```bash
   ollama pull qwen3:8b
   ollama pull qwen2.5vl:7b
   ```
3. **Verify Ollama Models**:
   ```bash
   ollama run qwen2.5vl:7b
   ```

## Application Configuration

The backend reads configuration from `.env` or `app/config.py`:

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen3:8b
LLM_VISION_MODEL=qwen2.5vl:7b
LLM_BASE_URL=http://localhost:11434
LLM_TIMEOUT_SECONDS=300
```

## Vision & 3D Integration Architecture

```
Uploaded Image -> FastAPI Backend -> LLMClient.generate_vision() -> Ollama /api/generate (qwen2.5vl:7b)
                                                                           │
                                                                           ▼
3D Spec Extraction & Mesh Generation <- LLMClient.generate() (qwen3:8b) <- Vision Features Output
```

- If Ollama daemon is offline or unreachable, `get_llm_client()` automatically falls back to `MockLLMClient` to ensure continuous frontend and API development without hard crashes.
