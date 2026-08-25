from __future__ import annotations

import numpy as np


def face_normal(v0: np.ndarray, v1: np.ndarray, v2: np.ndarray) -> np.ndarray:
    n = np.cross(v1 - v0, v2 - v0)
    norm = np.linalg.norm(n)
    if norm < 1e-12:
        return np.zeros(3)
    return n / norm


def lambert_intensity(normal: np.ndarray, light_direction: np.ndarray, ambient: float) -> float:
    """light_direction is the direction light travels (points from the light
    toward the scene), so a surface facing the light has dot(normal, -light) > 0."""
    light_dir = light_direction / np.linalg.norm(light_direction)
    diffuse = max(0.0, float(np.dot(normal, -light_dir)))
    return ambient + (1.0 - ambient) * diffuse
