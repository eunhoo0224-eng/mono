"""`check` 명령 (작업지시서 3-3절). 위반을 찾아 보고할 뿐 고치지 않는다."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from archive_tool import index_csv, naming
from archive_tool.constants import INDEX_CSV_NAME, RAW_DIR, SELECT_DIR, WEB_DIR


@dataclass
class Violation:
    category: str
    message: str


def _list_files(d: Path) -> list[Path]:
    if not d.is_dir():
        return []
    return [p for p in sorted(d.iterdir()) if p.is_file() and not p.name.startswith(".")]


def run_check(archive_root: Path) -> list[Violation]:
    violations: list[Violation] = []

    index_path = archive_root / INDEX_CSV_NAME
    rows: list[dict] = []
    if index_path.exists():
        rows = index_csv.read_rows(index_path)
    else:
        violations.append(Violation("index-missing", f"{index_path}가 없다."))

    ids_seen: dict[str, list[dict]] = {}
    rows_by_slug: dict[str, list[dict]] = {}
    for r in rows:
        ids_seen.setdefault(r.get("id", ""), []).append(r)
        rows_by_slug.setdefault(r.get("slug", ""), []).append(r)

    for id_, rs in ids_seen.items():
        if len(rs) > 1:
            slugs = [r.get("slug") for r in rs]
            violations.append(Violation("duplicate-id", f"id={id_}가 {len(rs)}번 등장한다 (slug: {slugs})"))

    folder_slugs: set[str] = set()

    for entry in sorted(archive_root.iterdir()):
        if not entry.is_dir():
            continue
        parsed = naming.parse_folder_name(entry.name)
        if parsed is None:
            violations.append(Violation("bad-folder-name", f"이름 규칙에 안 맞는 폴더: {entry.name}"))
            continue
        folder_slugs.add(parsed.slug)

        for sub in (RAW_DIR, SELECT_DIR, WEB_DIR):
            for fp in _list_files(entry / sub):
                pf = naming.parse_file_name(fp.name)
                if pf is None:
                    violations.append(Violation("bad-file-name", f"이름 규칙에 안 맞는 파일: {fp}"))
                elif (pf.date, pf.track, pf.slug) != (parsed.date, parsed.track, parsed.slug):
                    violations.append(
                        Violation("file-folder-mismatch", f"{fp}의 이름이 폴더 {entry.name}와 어긋난다")
                    )

        matching_rows = rows_by_slug.get(parsed.slug, [])
        if not matching_rows:
            violations.append(Violation("folder-without-index", f"폴더는 있으나 index.csv에 없는 건: {entry.name}"))
        else:
            raw_count = len(_list_files(entry / RAW_DIR))
            for r in matching_rows:
                row_date = r.get("date", "").replace("-", "")
                if row_date != parsed.date or r.get("track") != parsed.track:
                    violations.append(
                        Violation(
                            "slug-mismatch",
                            f"폴더 {entry.name}의 slug={parsed.slug!r}는 index.csv 행(id={r.get('id')})과 "
                            f"이름은 맞지만 date/track이 어긋난다: 폴더={parsed.date}_{parsed.track} "
                            f"vs. 색인={row_date}_{r.get('track')}",
                        )
                    )
                count_str = r.get("count", "")
                if count_str.isdigit() and int(count_str) != raw_count:
                    violations.append(
                        Violation(
                            "count-mismatch",
                            f"{entry.name}: index.csv count={count_str}, 00_raw 실제 파일 수={raw_count}",
                        )
                    )

        select_names = {p.name for p in _list_files(entry / SELECT_DIR)}
        for p in _list_files(entry / WEB_DIR):
            if p.name not in select_names:
                violations.append(Violation("web-without-select", f"{p}가 10_select에는 없다"))

    for slug, rs in rows_by_slug.items():
        if slug and slug not in folder_slugs:
            for r in rs:
                violations.append(
                    Violation(
                        "index-without-folder",
                        f"index.csv에 slug={slug!r} (id={r.get('id')}) 행이 있으나 폴더가 없다",
                    )
                )

    return violations
