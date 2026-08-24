# Local LLM Integration (Qwen via Ollama)

This document details the configuration and architecture for the local LLM integration in the 3D Model Generator application.

## Overview

The application relies on a locally hosted LLM via **Ollama** to parse natural language user prompts into structured 3D specifications and tool plans without cloud dependencies.

- **Selected Model**: `qwen3:8b` (Qwen3 8B parameter model)
- **Quantization**: `Q4_K_M` GGUF
- **Provider**: Ollama Local HTTP API
- **Endpoint**: `http://localhost:11434`

## Hardware & Resource Requirements

- **Model Size on Disk**: ~5.2 GB
- **VRAM / RAM Requirement**: ~6–8 GB system RAM or GPU VRAM for optimal inference latency.
- **Capabilities**: Structured output JSON generation, tool calling, multi-turn reasoning.

## Installation & Setup

1. **Install Ollama**: Download and install Ollama from [https://ollama.com](https://ollama.com).
2. **Pull the Qwen Model**:
   ```bash
   ollama pull qwen3:8b
   ```
3. **Verify Ollama Status**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

## Application Configuration

The backend reads configuration from `.env` or `app/config.py`:

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen3:8b
LLM_BASE_URL=http://localhost:11434
LLM_TIMEOUT_SECONDS=60
```

## Python Integration Architecture

```
User Prompt -> FastAPI Backend -> LLMClient (OllamaClient) -> HTTP POST http://localhost:11434/api/generate -> Qwen3:8b Model
```

- If Ollama daemon is offline or unreachable, `get_llm_client()` automatically falls back to `MockLLMClient` to ensure continuous frontend and API development without hard crashes.
