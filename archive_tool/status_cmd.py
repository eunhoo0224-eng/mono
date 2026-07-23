"""`status` 명령 (작업지시서 3-4절)."""

from __future__ import annotations

from pathlib import Path

from archive_tool import index_csv
from archive_tool.constants import INDEX_CSV_NAME, STATUS_ORDER


def run_status(archive_root: Path) -> dict[str, list[dict]]:
    rows = index_csv.read_rows(archive_root / INDEX_CSV_NAME)
    grouped: dict[str, list[dict]] = {s: [] for s in STATUS_ORDER}
    for r in rows:
        grouped.setdefault(r.get("status", ""), []).append(r)
    # STATUS_ORDER에 없는 값(오타 등)도 뒤에 붙여 보이게 한다.
    ordered = {k: grouped[k] for k in STATUS_ORDER}
    for k, v in grouped.items():
        if k not in STATUS_ORDER:
            ordered[k] = v
    return ordered
