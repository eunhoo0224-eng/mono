"""index.csv 읽기/추가.

기존 행은 절대 고치거나 지우지 않는다 (작업지시서 2절). 이 모듈에는
행을 수정하거나 삭제하는 함수가 의도적으로 없다.
"""

from __future__ import annotations

import csv
from pathlib import Path

from archive_tool.constants import INDEX_FIELDS


class IndexMissing(RuntimeError):
    pass


def read_rows(index_path: Path) -> list[dict]:
    if not index_path.exists():
        raise IndexMissing(
            f"{index_path}가 없다. 경로가 맞는지 확인하거나, 새로 시작하는 것이면 "
            "`archive-tool init-index`로 빈 색인을 만들어라."
        )
    with index_path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def init_index(index_path: Path) -> None:
    if index_path.exists():
        raise FileExistsError(f"{index_path}가 이미 있다.")
    with index_path.open("w", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=INDEX_FIELDS).writeheader()


def next_id(rows: list[dict]) -> str:
    existing = [int(r["id"]) for r in rows if r.get("id", "").isdigit()]
    return f"{(max(existing) + 1) if existing else 1:03d}"


def find_by_slug(rows: list[dict], slug: str) -> dict | None:
    for r in rows:
        if r.get("slug") == slug:
            return r
    return None


def append_row(index_path: Path, row: dict) -> None:
    """새 행을 파일 끝에 추가한다. row는 INDEX_FIELDS를 모두 채워야 한다."""
    missing = set(INDEX_FIELDS) - set(row)
    if missing:
        raise ValueError(f"row에 빠진 칸: {sorted(missing)}")
    with index_path.open("a", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=INDEX_FIELDS).writerow(row)
