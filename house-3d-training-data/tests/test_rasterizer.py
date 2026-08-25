import numpy as np
import trimesh

from generators.render.camera import RenderCamera
from generators.render.rasterizer import downsample, rasterize


def _cube_triangles(center, half_extent):
    box = trimesh.creation.box(extents=[half_extent * 2] * 3)
    box.apply_translation(center)
    verts = box.vertices[box.faces]  # (F, 3, 3)
    return np.asarray(verts, dtype=np.float64)


def test_camera_project_center_pixel_is_image_center():
    cam = RenderCamera(
        position=(5, 0, 0), look_at=(0, 0, 0), up=(0, 0, 1),
        fov_degrees=40, near=0.1, far=100, width=64, height=64,
    )
    screen, depth, valid = cam.project(np.array([[0.0, 0.0, 0.0]]))
    assert valid[0]
    assert screen[0, 0] == 32.0
    assert screen[0, 1] == 32.0
    assert depth[0] == 5.0


def test_rasterize_cube_front_face_depth_and_segmentation():
    tris = _cube_triangles(center=(0, 0, 0), half_extent=0.5)
    n = tris.shape[0]
    cam = RenderCamera(
        position=(5, 0, 0), look_at=(0, 0, 0), up=(0, 0, 1),
        fov_degrees=40, near=0.1, far=100, width=128, height=128,
    )
    fb = rasterize(
        cam, tris,
        base_colors=np.tile([1.0, 0.0, 0.0], (n, 1)),
        semantic_ids=np.full(n, 7, dtype=np.uint16),
        instance_ids=np.full(n, 3, dtype=np.uint16),
        light_direction=(-1.0, 0.0, 0.0),
        ambient=0.3,
    )
    cy, cx = 64, 64
    # front face of the cube (facing the camera) is 4.5m away
    assert abs(fb.depth[cy, cx] - 4.5) < 0.05
    assert fb.semantic[cy, cx] == 7
    assert fb.instance[cy, cx] == 3
    # a corner of the image sees no geometry
    assert np.isinf(fb.depth[0, 0])
    assert fb.semantic[0, 0] == 0
    # front face directly faces the light -> near-full intensity, red channel high
    assert fb.color[cy, cx, 0] > 0.9
    assert fb.color[cy, cx, 1] == 0.0


def test_downsample_never_blends_depth_or_ids():
    tris = _cube_triangles(center=(0, 0, 0), half_extent=0.5)
    n = tris.shape[0]
    cam = RenderCamera(
        position=(5, 0, 0), look_at=(0, 0, 0), up=(0, 0, 1),
        fov_degrees=40, near=0.1, far=100, width=128, height=128,
    )
    fb = rasterize(
        cam, tris,
        base_colors=np.tile([0.2, 0.6, 0.9], (n, 1)),
        semantic_ids=np.full(n, 1, dtype=np.uint16),
        instance_ids=np.full(n, 1, dtype=np.uint16),
        light_direction=(-1.0, 0.0, 0.0),
        ambient=0.3,
    )
    small = downsample(fb, factor=2)
    assert small.width == 64 and small.height == 64
    # every finite depth value in the downsampled buffer must equal some
    # value present in the source buffer (nearest-sample, never averaged)
    finite = small.depth[~np.isinf(small.depth)]
    source_values = set(np.round(fb.depth[~np.isinf(fb.depth)], 6).tolist())
    for v in np.round(finite, 6).tolist():
        assert v in source_values
