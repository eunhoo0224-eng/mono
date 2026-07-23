import json
import subprocess

from PIL import Image

from archive_tool import export_cmd
from tests.conftest import make_jpeg, set_exif_datetime
import datetime as dt


def _exiftool_json(path):
    proc = subprocess.run(
        ["exiftool", "-json", "-GPSLatitude", "-Copyright", "-Artist", str(path)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(proc.stdout)[0]


def _make_shoot(tmp_path):
    shoot_dir = tmp_path / "20260710_C_studio-group"
    (shoot_dir / "10_select").mkdir(parents=True)
    return shoot_dir


def test_export_empty_select_is_noop(tmp_path):
    shoot_dir = _make_shoot(tmp_path)
    plan = export_cmd.plan_export(shoot_dir)
    assert plan.empty
    assert not (shoot_dir / "20_web").exists()


def test_export_resizes_strips_gps_keeps_copyright(tmp_path):
    shoot_dir = _make_shoot(tmp_path)
    src = shoot_dir / "10_select" / "20260710_C_studio-group_001.jpg"
    make_jpeg(src, size=(4000, 3000))
    set_exif_datetime(src, dt.datetime(2026, 7, 10, 9, 0, 0))

    plan = export_cmd.plan_export(shoot_dir)
    assert len(plan.to_copy) == 1
    export_cmd.apply_export(plan)

    dest = shoot_dir / "20_web" / "20260710_C_studio-group_001.jpg"
    assert dest.exists()

    with Image.open(dest) as img:
        assert max(img.size) <= 2560

    meta = _exiftool_json(dest)
    assert "GPSLatitude" not in meta
    assert meta["Copyright"] == "Eunhoo Kim"
    assert meta["Artist"] == "Eunhoo Kim"


def test_export_does_not_upscale_small_images(tmp_path):
    shoot_dir = _make_shoot(tmp_path)
    src = shoot_dir / "10_select" / "20260710_C_studio-group_001.jpg"
    make_jpeg(src, size=(800, 600))
    set_exif_datetime(src, dt.datetime(2026, 7, 10, 9, 0, 0))

    plan = export_cmd.plan_export(shoot_dir)
    export_cmd.apply_export(plan)

    dest = shoot_dir / "20_web" / "20260710_C_studio-group_001.jpg"
    with Image.open(dest) as img:
        assert img.size == (800, 600)


def test_export_hero_uses_larger_long_edge(tmp_path):
    shoot_dir = _make_shoot(tmp_path)
    src = shoot_dir / "10_select" / "20260710_C_studio-group_001.jpg"
    make_jpeg(src, size=(5000, 3750))
    set_exif_datetime(src, dt.datetime(2026, 7, 10, 9, 0, 0))

    plan = export_cmd.plan_export(shoot_dir, hero=True)
    export_cmd.apply_export(plan)

    dest = shoot_dir / "20_web" / "20260710_C_studio-group_001.jpg"
    with Image.open(dest) as img:
        assert max(img.size) <= 3840
        assert max(img.size) > 2560


def test_export_skips_existing_and_does_not_overwrite(tmp_path):
    shoot_dir = _make_shoot(tmp_path)
    src = shoot_dir / "10_select" / "20260710_C_studio-group_001.jpg"
    make_jpeg(src, size=(4000, 3000))
    set_exif_datetime(src, dt.datetime(2026, 7, 10, 9, 0, 0))

    plan = export_cmd.plan_export(shoot_dir)
    export_cmd.apply_export(plan)

    dest = shoot_dir / "20_web" / "20260710_C_studio-group_001.jpg"
    before = dest.stat().st_mtime_ns

    plan2 = export_cmd.plan_export(shoot_dir)
    assert len(plan2.to_skip) == 1
    assert len(plan2.to_copy) == 0
    export_cmd.apply_export(plan2)

    assert dest.stat().st_mtime_ns == before
