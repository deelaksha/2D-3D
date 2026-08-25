import json

from generators.house.house import list_template_ids
from generators.house.sample import generate_sample
from schemas.dataset_config import DatasetYamlConfig
from schemas.dataset_sample import DatasetSample
from schemas.scene import Scene


def _config(tmp_path):
    raw = DatasetYamlConfig.load("configs/dataset_house.yaml")
    return raw.model_copy(update={"paths": raw.paths.model_copy(update={"root": str(tmp_path)})})


def test_generate_sample_writes_every_configured_view(tmp_path):
    config = _config(tmp_path)
    samples = generate_sample(config, sample_id="house_test_1", template_id=list_template_ids()[0], seed=0)

    assert len(samples) == len(config.generation.views)
    for s in samples:
        assert (tmp_path / s.image).is_file()
        assert (tmp_path / s.depth).is_file()
        assert (tmp_path / s.segmentation).is_file()
        assert (tmp_path / s.camera).is_file()
        assert (tmp_path / s.mesh).is_file()
        assert (tmp_path / s.scene).is_file()


def test_scene_json_round_trips_and_mesh_is_nonempty(tmp_path):
    config = _config(tmp_path)
    samples = generate_sample(config, sample_id="house_test_2", template_id=list_template_ids()[0], seed=0)

    scene = Scene.model_validate_json((tmp_path / samples[0].scene).read_text())
    assert len(scene.components) > 0
    assert (tmp_path / samples[0].mesh).stat().st_size > 0


def test_all_views_share_one_split_and_rows_validate(tmp_path):
    config = _config(tmp_path)
    samples = generate_sample(config, sample_id="house_test_3", template_id=list_template_ids()[0], seed=0)

    splits = {s.split for s in samples}
    assert len(splits) == 1
    for s in samples:
        assert s.quality is not None
        assert 0.0 <= s.quality.overall_quality <= 1.0
        DatasetSample.model_validate(json.loads(s.model_dump_json()))


def test_index_jsonl_gets_one_row_per_view(tmp_path):
    config = _config(tmp_path)
    samples = generate_sample(config, sample_id="house_test_4", template_id=list_template_ids()[0], seed=0)

    lines = (tmp_path / "metadata" / "index.jsonl").read_text().splitlines()
    assert len(lines) == len(samples)
    for line in lines:
        DatasetSample.model_validate(json.loads(line))


def test_metadata_json_has_component_counts(tmp_path):
    config = _config(tmp_path)
    generate_sample(config, sample_id="house_test_5", template_id=list_template_ids()[0], seed=0)

    meta = json.loads((tmp_path / "scenes" / "house_test_5" / "metadata.json").read_text())
    assert meta["component_counts"]["wall"] == 4
    assert meta["component_counts"]["door"] == 1
    assert meta["mesh"]["vertex_count"] > 0
