#!/usr/bin/env python
"""Ollama Exporter: Generates an Ollama Modelfile and registers qwen-house-3d with local Ollama daemon.

Constructs an optimized Modelfile with spatial reasoning system prompt, GGUF/base model reference,
and custom parameters (temperature, top_p, num_ctx).
"""

from __future__ import annotations

import argparse
import logging
import subprocess

from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("export_ollama")

MODELFILE_TEMPLATE = """# Ollama Modelfile for 3D Architectural Spatial Reasoning Model
FROM {from_model}

# System prompt for structured 3D spec generation
SYSTEM \"\"\"You are a specialized 3D Architectural AI Assistant for the 3D Model Generator system.
Given user messages, analyze requirements using step-by-step spatial reasoning inside <think> tags,
and return strict 3D JSON specifications and tool call plans matching required schemas.

Output ONLY valid JSON after reasoning. No additional prose.\"\"\"

# Context size and hyperparameter tuning
PARAMETER num_ctx 8192
PARAMETER temperature 0.2
PARAMETER top_p 0.95
"""


def create_modelfile(from_model: str, output_path: Path) -> Path:
    """Generate the Modelfile on disk."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = MODELFILE_TEMPLATE.format(from_model=from_model)
    output_path.write_text(content, encoding="utf-8")
    logger.info(f"Wrote Ollama Modelfile to {output_path}")
    return output_path


def register_with_ollama(modelfile_path: Path, model_name: str = "qwen-house-3d") -> bool:
    """Invoke `ollama create <model_name> -f <modelfile>`."""
    cmd = ["ollama", "create", model_name, "-f", str(modelfile_path)]
    logger.info(f"Registering model with Ollama: {' '.join(cmd)}")
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            logger.info(f"Successfully registered model '{model_name}' in Ollama!")
            return True
        else:
            logger.warning(f"Ollama CLI registration output: {res.stderr or res.stdout}")
            return False
    except FileNotFoundError:
        logger.warning("Ollama executable not found in system PATH. Ensure Ollama is installed.")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from_model", default="qwen2.5-coder:7b", help="Base model tag in Ollama or GGUF path")
    parser.add_argument("--model_name", default="qwen-house-3d", help="Ollama model tag to create")
    parser.add_argument("--output_file", default="training/checkpoints/Modelfile")
    parser.add_argument("--register", action="store_true", help="Run 'ollama create' automatically")
    args = parser.parse_args()

    modelfile_p = Path(args.output_file).resolve()
    create_modelfile(args.from_model, modelfile_p)

    if args.register:
        register_with_ollama(modelfile_p, args.model_name)
    else:
        print("\nTo register with Ollama manually, run:")
        print(f"  ollama create {args.model_name} -f {modelfile_p}\n")


if __name__ == "__main__":
    main()
