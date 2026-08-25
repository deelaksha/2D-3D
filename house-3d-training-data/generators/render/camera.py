"""Pinhole camera: world space -> camera space -> screen pixels.

No projection-matrix / clip-space machinery -- for a from-scratch renderer
that only needs screen coordinates and linear depth, computing them directly
is simpler and just as correct.
"""

from __future__ import annotations

import numpy as np


class RenderCamera:
    def __init__(
        self,
        position: tuple[float, float, float],
        look_at: tuple[float, float, float],
        up: tuple[float, float, float],
        fov_degrees: float,
        near: float,
        far: float,
        width: int,
        height: int,
    ) -> None:
        self.position = np.array(position, dtype=np.float64)
        self.look_at = np.array(look_at, dtype=np.float64)
        self.fov_degrees = fov_degrees
        self.near = near
        self.far = far
        self.width = width
        self.height = height

        forward = self.look_at - self.position
        norm = np.linalg.norm(forward)
        if norm < 1e-9:
            raise ValueError("camera position and look_at must differ")
        forward = forward / norm

        up_hint = np.array(up, dtype=np.float64)
        right = np.cross(forward, up_hint)
        right_norm = np.linalg.norm(right)
        if right_norm < 1e-9:
            # forward is parallel to the up hint (e.g. looking straight down):
            # fall back to a different hint so `right` is well defined.
            up_hint = np.array([0.0, 1.0, 0.0]) if abs(forward[2]) > 0.9 else np.array([0.0, 0.0, 1.0])
            right = np.cross(forward, up_hint)
            right_norm = np.linalg.norm(right)
        right = right / right_norm
        true_up = np.cross(right, forward)

        self.forward = forward
        self.right = right
        self.up = true_up
        self.aspect = width / height
        self._focal = 1.0 / np.tan(np.radians(fov_degrees) / 2.0)

    def view_space(self, points_world: np.ndarray) -> np.ndarray:
        """(...,3) world points -> (...,3) camera-space (x=right, y=up, z=forward distance)."""
        rel = points_world - self.position
        x = rel @ self.right
        y = rel @ self.up
        z = rel @ self.forward
        return np.stack([x, y, z], axis=-1)

    def project(self, points_world: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (screen_xy (...,2) pixels, depth (...,) meters, valid (...,) bool)."""
        pts = np.asarray(points_world, dtype=np.float64).reshape(-1, 3)
        vs = self.view_space(pts)
        x, y, z = vs[..., 0], vs[..., 1], vs[..., 2]
        z_safe = np.where(np.abs(z) < 1e-9, 1e-9, z)
        ndc_x = (x / z_safe) * self._focal / self.aspect
        ndc_y = (y / z_safe) * self._focal
        px = (ndc_x * 0.5 + 0.5) * self.width
        py = (1.0 - (ndc_y * 0.5 + 0.5)) * self.height
        screen = np.stack([px, py], axis=-1)
        valid = (z > self.near) & (z < self.far)
        return screen, z, valid
