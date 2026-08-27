#!/usr/bin/env python
"""Dataset Converter: Converts house-3d procedural scene datasets into Qwen ChatML JSONL format.

Produces instruction-tuning datasets with step-by-step spatial reasoning for fine-tuning
Qwen models (e.g. Qwen2.5-Coder / Qwen3) to generate 3D specifications and tool plans.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("qwen_formatter")

SYSTEM_PROMPT = (
    "You are a 3D Architectural AI assistant specialized in translating natural language prompts "
    "into accurate 3D scene graphs, specifications, and spatial layouts. "
    "First perform step-by-step spatial reasoning inside <think> tags, then return the JSON specification."
)


def extract_scene_summary(scene_data: dict[str, Any]) -> dict[str, Any]:
    """Extract key metrics and structure from scene.json."""
    scene_id = scene_data.get("scene_id", "unknown_scene")
    scene_type = scene_data.get("scene_type", "room")
    components = scene_data.get("components", [])

    comp_counts: dict[str, int] = {}
    materials: set[str] = set()
    total_area = 0.0

    comp_summaries = []
    for c in components:
        ctype = c.get("type", "component")
        comp_counts[ctype] = comp_counts.get(ctype, 0) + 1
        mat = c.get("material", {}).get("name")
        if mat:
            materials.add(mat)
        
        dims = c.get("dimensions", {})
        pos = c.get("transform", {}).get("position", {})
        comp_summaries.append({
            "id": c.get("id"),
            "type": ctype,
            "dimensions": f"{dims.get('width', 0):.2f}m x {dims.get('height', 0):.2f}m x {dims.get('depth', 0):.2f}m",
            "position": f"({pos.get('x', 0):.2f}, {pos.get('y', 0):.2f}, {pos.get('z', 0):.2f})",
            "material": mat or "standard"
        })

    return {
        "scene_id": scene_id,
        "scene_type": scene_type,
        "component_count": len(components),
        "counts_by_type": comp_counts,
        "materials": list(materials),
        "components": comp_summaries
    }


def generate_qwen_dialogue(scene_summary: dict[str, Any]) -> dict[str, Any]:
    """Build a Qwen ChatML sample with system, user, and assistant reasoning dialogue."""
    counts = scene_summary["counts_by_type"]
    comp_desc_parts = [f"{count} {ctype}(s)" for ctype, count in counts.items()]
    comp_str = ", ".join(comp_desc_parts) or "architectural structure"
    mats_str = ", ".join(scene_summary["materials"]) or "standard materials"

    # Synthetic user query
    user_prompt = f"Design a 3D architectural {scene_summary['scene_type']} model with {comp_str} using {mats_str}."

    # Reasoning generation
    reasoning_lines = [
        f"1. Analyzing request: User wants a {scene_summary['scene_type']} with {scene_summary['component_count']} total components.",
        f"2. Component breakdown: {comp_str}.",
        f"3. Material assignment: {mats_str}.",
        "4. Layout strategy: Orienting floor at center (0,0,0) and placing structural walls and openings along bounding boundaries.",
        "5. Formulating structured 3D Specification JSON."
    ]
    reasoning_text = "\n".join(reasoning_lines)

    # Structured 3D spec target output
    spec_output = {
        "object": f"{scene_summary['scene_type']}_architectural_model",
        "style": "procedural_architectural",
        "materials": scene_summary["materials"],
        "colors": ["#cccccc", "#888888"],
        "parts": list(counts.keys()),
        "complexity": "medium" if scene_summary["component_count"] > 5 else "low",
        "scene_summary": {
            "scene_id": scene_summary["scene_id"],
            "component_count": scene_summary["component_count"],
            "components": scene_summary["components"]
        }
    }

    assistant_response = f"<think>\n{reasoning_text}\n</think>\n\n{json.dumps(spec_output, indent=2)}"

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": assistant_response}
        ]
    }


def convert_dataset_to_qwen(root: Path, output_dir: Path) -> dict[str, int]:
    """Convert dataset index and scene.json files into split-based JSONL files."""
    index_path = root / "metadata" / "index.jsonl"
    if not index_path.is_file():
        raise FileNotFoundError(f"Index file not found at {index_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    samples_by_split: dict[str, list[dict]] = {"train": [], "validation": [], "test": [], "rejected": []}
    processed_scenes: set[str] = set()

    for line in index_path.read_text().splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        split = record.get("split", "train")
        scene_rel_path = record.get("scene")
        if not scene_rel_path:
            continue

        scene_path = root / scene_rel_path
        if not scene_path.is_file() or str(scene_path) in processed_scenes:
            continue
        processed_scenes.add(str(scene_path))

        try:
            scene_data = json.loads(scene_path.read_text())
            summary = extract_scene_summary(scene_data)
            qwen_dialogue = generate_qwen_dialogue(summary)
            samples_by_split.setdefault(split, []).append(qwen_dialogue)
        except Exception as exc:
            logger.warning(f"Skipping scene {scene_path}: {exc}")

    counts = {}
    for split, samples in samples_by_split.items():
        out_file = output_dir / f"qwen_reasoning_{split}.jsonl"
        with out_file.open("w", encoding="utf-8") as f:
            for sample in samples:
                f.write(json.dumps(sample, ensure_ascii=False) + "\n")
        counts[split] = len(samples)
        logger.info(f"Wrote {len(samples)} Qwen reasoning samples to {out_file}")

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="datasets/house", help="Path to dataset root directory")
    parser.add_argument("--output", default="datasets/house/processed", help="Path to output directory for Qwen JSONL")
    args = parser.parse_args()

    root_path = Path(args.root).resolve()
    out_path = Path(args.output).resolve()

    logger.info(f"Converting dataset at {root_path} -> Qwen JSONL at {out_path}")
    counts = convert_dataset_to_qwen(root_path, out_path)
    for split, count in counts.items():
        print(f"  - {split}: {count} reasoning samples")


if __name__ == "__main__":
    main()
