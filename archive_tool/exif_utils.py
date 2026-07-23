"""exiftool 래퍼.

이 모듈만 EXIF를 건드린다. exiftool 바이너리가 PATH에 있어야 한다
(Debian/Ubuntu: `apt install libimage-exiftool-perl`).
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
import subprocess
from pathlib import Path


class ExifToolNotFound(RuntimeError):
    pass


def _require_exiftool() -> str:
    path = shutil.which("exiftool")
    if not path:
        raise ExifToolNotFound(
            "exiftool을 찾을 수 없다. 설치 후 다시 실행하라 "
            "(Debian/Ubuntu: sudo apt install libimage-exiftool-perl, "
            "macOS: brew install exiftool)."
        )
    return path


_DATE_TAGS = ("DateTimeOriginal", "CreateDate")


def _parse_exif_datetime(value: str) -> dt.datetime | None:
    """"YYYY:MM:DD HH:MM:SS[+TZ]" 앞부분만 쓴다 — 순서·날짜 판정에는 시간대가 필요 없다."""
    try:
        return dt.datetime.strptime(value.strip()[:19], "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def read_capture_datetimes(paths: list[Path]) -> dict[Path, dt.datetime | None]:
    """각 파일의 촬영일시를 읽는다. 없으면 None.

    DateTimeOriginal을 우선하고 없으면 CreateDate를 쓴다.
    """
    if not paths:
        return {}
    _require_exiftool()
    result: dict[Path, dt.datetime | None] = {p: None for p in paths}
    proc = subprocess.run(
        ["exiftool", "-json", "-DateTimeOriginal", "-CreateDate", *[str(p) for p in paths]],
        capture_output=True, text=True, check=True,
    )
    records = json.loads(proc.stdout or "[]")
    by_path = {Path(r["SourceFile"]): r for r in records}
    for p in paths:
        r = by_path.get(p) or by_path.get(Path(str(p)))
        if not r:
            continue
        for tag in _DATE_TAGS:
            if tag in r:
                parsed = _parse_exif_datetime(str(r[tag]))
                if parsed:
                    result[p] = parsed
                    break
    return result


def copy_metadata_strip_gps(source: Path, dest: Path) -> None:
    """dest에 source의 메타데이터를 복사하되 GPS만 뺀다.

    저작권·작가 등 나머지 태그는 그대로 유지한다 (작업지시서 4절).
    dest는 이미 리사이즈·색공간 변환이 끝난 이미지 파일이어야 한다.
    """
    _require_exiftool()
    subprocess.run(
        [
            "exiftool",
            "-TagsFromFile", str(source),
            "-all:all",
            "--gps:all",
            "-overwrite_original",
            str(dest),
        ],
        capture_output=True, text=True, check=True,
    )
