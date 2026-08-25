"""A from-scratch, dependency-free (numpy only) perspective-correct
z-buffer triangle rasterizer. See docs/ARCHITECTURE.md for why this exists
instead of a Blender/OpenGL render path.

RGB, depth and segmentation all come from the *same* rasterization pass over
the *same* triangles, so they are pixel-aligned by construction.
"""

from __future__ import annotations

import numpy as np

from generators.render.camera import RenderCamera
from generators.render.shading import face_normal, lambert_intensity


class FrameBuffer:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.color = np.zeros((height, width, 3), dtype=np.float64)
        self.depth = np.full((height, width), np.inf, dtype=np.float64)
        self.semantic = np.zeros((height, width), dtype=np.uint16)
        self.instance = np.zeros((height, width), dtype=np.uint16)

    @property
    def background_mask(self) -> np.ndarray:
        return np.isinf(self.depth)


def rasterize(
    camera: RenderCamera,
    triangles: np.ndarray,  # (M, 3, 3) world-space vertex positions
    base_colors: np.ndarray,  # (M, 3) float in [0, 1]
    semantic_ids: np.ndarray,  # (M,) uint16
    instance_ids: np.ndarray,  # (M,) uint16
    light_direction: tuple[float, float, float],
    ambient: float,
) -> FrameBuffer:
    fb = FrameBuffer(camera.width, camera.height)
    if triangles.shape[0] == 0:
        return fb
    light = np.asarray(light_direction, dtype=np.float64)

    for i in range(triangles.shape[0]):
        tri = triangles[i]
        screen, depth, valid = camera.project(tri)
        if not np.all(valid):
            # Simple near/far cull: skip triangles with any vertex outside
            # [near, far]. No clipping against the frustum -- adequate for
            # exterior architectural views where the camera sits well back
            # from the geometry (see docs/TROUBLESHOOTING.md).
            continue

        x_min = max(int(np.floor(screen[:, 0].min())), 0)
        x_max = min(int(np.ceil(screen[:, 0].max())), camera.width)
        y_min = max(int(np.floor(screen[:, 1].min())), 0)
        y_max = min(int(np.ceil(screen[:, 1].max())), camera.height)
        if x_min >= x_max or y_min >= y_max:
            continue

        x0, y0 = screen[0]
        x1, y1 = screen[1]
        x2, y2 = screen[2]
        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denom) < 1e-9:
            continue  # degenerate / edge-on in screen space

        xs, ys = np.meshgrid(
            np.arange(x_min, x_max) + 0.5, np.arange(y_min, y_max) + 0.5
        )
        w0 = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / denom
        w1 = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / denom
        w2 = 1.0 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not np.any(inside):
            continue

        # Perspective-correct depth: interpolate 1/z linearly in screen
        # space, then invert -- this is exact, not an approximation, for a
        # quantity that is linear in view space but not in screen space.
        z0, z1, z2 = depth[0], depth[1], depth[2]
        inv_z = w0 / z0 + w1 / z1 + w2 / z2
        tri_depth = np.where(inside, 1.0 / np.where(inv_z != 0, inv_z, 1e-9), np.inf)

        region_depth = fb.depth[y_min:y_max, x_min:x_max]
        closer = inside & (tri_depth < region_depth)
        if not np.any(closer):
            continue

        normal = face_normal(tri[0], tri[1], tri[2])
        intensity = lambert_intensity(normal, light, ambient)
        color = np.clip(base_colors[i] * intensity, 0.0, 1.0)

        region_depth[closer] = tri_depth[closer]
        fb.color[y_min:y_max, x_min:x_max][closer] = color
        fb.semantic[y_min:y_max, x_min:x_max][closer] = semantic_ids[i]
        fb.instance[y_min:y_max, x_min:x_max][closer] = instance_ids[i]

    return fb


def _block_reshape(arr2d: np.ndarray, factor: int) -> np.ndarray:
    h, w = arr2d.shape[0] // factor, arr2d.shape[1] // factor
    return (
        arr2d.reshape(h, factor, w, factor)
        .transpose(0, 2, 1, 3)
        .reshape(h, w, factor * factor)
    )


def downsample(fb: FrameBuffer, factor: int) -> FrameBuffer:
    """factor:1 supersampled buffer -> target resolution.
    RGB is box-filter averaged (antialiasing). depth/semantic/instance are
    never blended -- each output pixel takes the nearest-surface sub-pixel's
    exact value, so ground truth stays a real sampled value everywhere."""
    if factor == 1:
        return fb
    h, w = fb.height // factor, fb.width // factor
    out = FrameBuffer(w, h)
    out.color = fb.color.reshape(h, factor, w, factor, 3).mean(axis=(1, 3))

    depth_blocks = _block_reshape(fb.depth, factor)
    nearest = np.argmin(depth_blocks, axis=-1)
    out.depth = np.take_along_axis(depth_blocks, nearest[..., None], axis=-1)[..., 0]

    sem_blocks = _block_reshape(fb.semantic.astype(np.float64), factor)
    inst_blocks = _block_reshape(fb.instance.astype(np.float64), factor)
    out.semantic = np.take_along_axis(sem_blocks, nearest[..., None], axis=-1)[..., 0].astype(
        np.uint16
    )
    out.instance = np.take_along_axis(inst_blocks, nearest[..., None], axis=-1)[..., 0].astype(
        np.uint16
    )
    return out
