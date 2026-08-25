"""Writes FrameBuffer contents to disk. Depth ground truth is float32 .npy
(meters, lossless) -- see docs/ARCHITECTURE.md for why not .exr."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from generators.render.rasterizer import FrameBuffer

BACKGROUND_COLOR = (0.85, 0.87, 0.90)


def save_rgb(fb: FrameBuffer, path: str | Path) -> None:
    color = fb.color.copy()
    color[fb.background_mask] = BACKGROUND_COLOR
    img = (np.clip(color, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
    Image.fromarray(img, mode="RGB").save(path)


def save_depth(fb: FrameBuffer, npy_path: str | Path, preview_path: str | Path | None = None) -> None:
    depth = fb.depth.copy()
    depth[fb.background_mask] = 0.0  # 0.0 = no geometry (background)
    np.save(npy_path, depth.astype(np.float32))

    if preview_path is not None:
        valid = ~fb.background_mask
        if np.any(valid):
            lo, hi = float(depth[valid].min()), float(depth[valid].max())
        else:
            lo, hi = 0.0, 1.0
        span = max(hi - lo, 1e-6)
        norm = np.zeros_like(depth)
        norm[valid] = 1.0 - (depth[valid] - lo) / span  # nearer = brighter
        preview = (norm * 255.0 + 0.5).astype(np.uint8)
        Image.fromarray(preview, mode="L").save(preview_path)


def save_segmentation(fb: FrameBuffer, semantic_path: str | Path, instance_path: str | Path) -> None:
    Image.fromarray(fb.semantic, mode="I;16").save(semantic_path)
    Image.fromarray(fb.instance, mode="I;16").save(instance_path)
