import datetime as dt

import pytest

from archive_tool import index_csv, ingest
from tests.conftest import make_jpeg, set_exif_datetime


def test_dry_run_creates_nothing(sample_input_dir, archive_root):
    input_files_before = sorted(p.name for p in sample_input_dir.iterdir())

    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")

    assert not plan.raw_dir.exists()
    assert list(archive_root.iterdir()) == [archive_root / "index.csv"]
    assert (archive_root / "index.csv").read_text(encoding="utf-8").count("\n") == 1  # 헤더만
    assert sorted(p.name for p in sample_input_dir.iterdir()) == input_files_before
    assert len(plan.to_copy) == 5


def test_apply_copies_files_and_preserves_input(sample_input_dir, archive_root):
    input_files_before = sorted(p.name for p in sample_input_dir.iterdir())

    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    ingest.apply_ingest(plan)

    copied = sorted(p.name for p in plan.raw_dir.iterdir())
    assert copied == [
        "20260710_C_studio-group_001.jpg",
        "20260710_C_studio-group_002.jpg",
        "20260710_C_studio-group_003.jpg",
        "20260710_C_studio-group_004.jpg",
        "20260710_C_studio-group_005.jpg",
    ]
    # 입력 폴더는 그대로여야 한다.
    assert sorted(p.name for p in sample_input_dir.iterdir()) == input_files_before

    rows = index_csv.read_rows(archive_root / "index.csv")
    assert len(rows) == 1
    assert rows[0]["slug"] == "studio-group"
    assert rows[0]["count"] == "5"
    assert rows[0]["id"] == "001"


def test_rerun_apply_skips_all_and_adds_no_row(sample_input_dir, archive_root):
    plan1 = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    ingest.apply_ingest(plan1)

    plan2 = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    assert len(plan2.to_skip) == 5
    assert len(plan2.to_copy) == 0
    assert plan2.index_row is None

    ingest.apply_ingest(plan2)
    rows = index_csv.read_rows(archive_root / "index.csv")
    assert len(rows) == 1


def test_exif_ascending_order_ignores_filename_order(sample_input_dir, archive_root):
    # IMG_0000..0004는 EXIF 분(minute) 순서가 3,1,4,0,2 였다 (conftest 참고).
    # 오름차순으로 정렬하면 IMG_0003(0분) 이 001, IMG_0001(1분) 이 002, ... 가 되어야 한다.
    plan = ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="studio-group")
    dest_by_seq = {f.dest_name.split("_")[-1]: f.source.name for f in plan.files}
    assert dest_by_seq["001.jpg"] == "IMG_0003.jpg"
    assert dest_by_seq["002.jpg"] == "IMG_0001.jpg"
    assert dest_by_seq["003.jpg"] == "IMG_0004.jpg"
    assert dest_by_seq["004.jpg"] == "IMG_0000.jpg"
    assert dest_by_seq["005.jpg"] == "IMG_0002.jpg"


def test_missing_track_stops_and_asks(sample_input_dir, archive_root):
    with pytest.raises(ingest.NeedsHumanDecision):
        ingest.plan_ingest(sample_input_dir, archive_root, track=None, slug="studio-group")


def test_multi_day_spread_stops_without_flag(tmp_path, archive_root):
    input_dir = tmp_path / "spread"
    input_dir.mkdir()
    make_jpeg(input_dir / "a.jpg")
    set_exif_datetime(input_dir / "a.jpg", dt.datetime(2026, 7, 1, 9, 0, 0))
    make_jpeg(input_dir / "b.jpg")
    set_exif_datetime(input_dir / "b.jpg", dt.datetime(2026, 7, 5, 9, 0, 0))

    with pytest.raises(ingest.NeedsHumanDecision):
        ingest.plan_ingest(input_dir, archive_root, track="P", slug="trip")

    plan = ingest.plan_ingest(input_dir, archive_root, track="P", slug="trip", allow_multi_day=True)
    assert plan.date == "20260701"


def test_missing_index_csv_stops_and_asks(sample_input_dir, tmp_path):
    empty_root = tmp_path / "no-index"
    empty_root.mkdir()
    with pytest.raises(index_csv.IndexMissing):
        ingest.plan_ingest(sample_input_dir, empty_root, track="C", slug="studio-group")


def test_invalid_slug_rejected(sample_input_dir, archive_root):
    with pytest.raises(Exception):
        ingest.plan_ingest(sample_input_dir, archive_root, track="C", slug="Studio Group")
