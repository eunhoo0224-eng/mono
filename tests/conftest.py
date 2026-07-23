from __future__ import annotations

import datetime as dt
import subprocess
from pathlib import Path

import pytest
from PIL import Image


def make_jpeg(path: Path, size: tuple[int, int] = (4000, 3000), color=(120, 180, 90)) -> None:
    Image.new("RGB", size, color).save(path, format="JPEG", quality=90)


def set_exif_datetime(path: Path, when: dt.datetime) -> None:
    stamp = when.strftime("%Y:%m:%d %H:%M:%S")
    subprocess.run(
        [
            "exiftool", f"-DateTimeOriginal={stamp}", f"-CreateDate={stamp}",
            "-Copyright=Eunhoo Kim", "-Artist=Eunhoo Kim",
            "-GPSLatitude=37.5", "-GPSLongitude=127.0",
            "-overwrite_original", str(path),
        ],
        check=True, capture_output=True,
    )


@pytest.fixture
def sample_input_dir(tmp_path: Path) -> Path:
    input_dir = tmp_path / "raw_dump"
    input_dir.mkdir()
    base = dt.datetime(2026, 7, 10, 9, 0, 0)
    # 일부러 뒤죽박죽 순서로 만든다 — EXIF 오름차순 정렬이 실제로 되는지 보려고.
    order = [3, 1, 4, 0, 2]
    for i, slot in enumerate(order):
        make_jpeg(input_dir / f"IMG_{i:04d}.jpg")
        set_exif_datetime(input_dir / f"IMG_{i:04d}.jpg", base + dt.timedelta(minutes=slot))
    return input_dir


@pytest.fixture
def archive_root(tmp_path: Path) -> Path:
    root = tmp_path / "photo-archive"
    root.mkdir()
    from archive_tool import index_csv
    index_csv.init_index(root / "index.csv")
    return root
