"""`ingest` 명령 (작업지시서 3-1절).

원본은 읽고 복사만 한다. 실제 쓰기는 apply=True일 때만 일어난다.
"""

from __future__ import annotations

import datetime as dt
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from archive_tool import exif_utils, index_csv, naming
from archive_tool.constants import (
    IMAGE_EXTENSIONS, INDEX_CSV_NAME, MULTI_DAY_THRESHOLD_DAYS, RAW_DIR, SELECT_DIR, WEB_DIR,
)


class NeedsHumanDecision(RuntimeError):
    """트랙 미지정, 여러 날 촬영 등 — 문서 6절에 따라 추측하지 않고 멈추는 상황."""


@dataclass
class PlannedFile:
    source: Path
    dest_name: str
    exists_at_dest: bool


@dataclass
class IngestPlan:
    archive_root: Path
    folder_name: str
    raw_dir: Path
    date: str
    track: str
    slug: str
    files: list[PlannedFile]
    ignored: list[Path]
    multi_day_span_days: int | None
    index_row: dict | None  # None이면 이미 같은 slug 행이 있어 추가하지 않음
    warnings: list[str] = field(default_factory=list)

    @property
    def to_copy(self) -> list[PlannedFile]:
        return [f for f in self.files if not f.exists_at_dest]

    @property
    def to_skip(self) -> list[PlannedFile]:
        return [f for f in self.files if f.exists_at_dest]


def _scan_input(input_dir: Path) -> tuple[list[Path], list[Path]]:
    images, ignored = [], []
    for p in sorted(input_dir.iterdir()):
        if not p.is_file() or p.name.startswith("."):
            continue
        if p.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(p)
        else:
            ignored.append(p)
    return images, ignored


def _order_files(images: list[Path], dates: dict[Path, dt.datetime | None]) -> list[Path]:
    dated = sorted((p for p in images if dates[p] is not None), key=lambda p: dates[p])
    undated = sorted((p for p in images if dates[p] is None), key=lambda p: p.name)
    return dated + undated


def plan_ingest(
    input_dir: Path,
    archive_root: Path,
    track: str,
    slug: str,
    date: str | None = None,
    place: str = "",
    tags: str = "",
    allow_multi_day: bool = False,
) -> IngestPlan:
    if not track:
        raise NeedsHumanDecision("트랙(C/P)이 지정되지 않았다. --track C 또는 --track P를 넘겨라.")
    naming.validate_track(track)
    naming.validate_slug(slug)

    if not input_dir.is_dir():
        raise FileNotFoundError(f"입력 폴더가 없다: {input_dir}")

    images, ignored = _scan_input(input_dir)
    dates = exif_utils.read_capture_datetimes(images)

    warnings: list[str] = []
    multi_day_span_days = None

    if date:
        resolved_date = date
    else:
        known_dates = [d for d in dates.values() if d is not None]
        if not known_dates:
            raise NeedsHumanDecision(
                "EXIF 촬영일시를 읽은 파일이 하나도 없다. --date YYYYMMDD로 날짜를 직접 지정하라."
            )
        earliest, latest = min(known_dates), max(known_dates)
        span_days = (latest.date() - earliest.date()).days
        if span_days >= MULTI_DAY_THRESHOLD_DAYS and not allow_multi_day:
            raise NeedsHumanDecision(
                f"EXIF 날짜가 {earliest.date()} ~ {latest.date()} ({span_days}일)에 걸쳐 있다. "
                "한 건으로 볼지 나눌지 정하고, 한 건이 맞으면 --allow-multi-day를 붙여 다시 실행하라."
            )
        if span_days > 0:
            multi_day_span_days = span_days
            warnings.append(
                f"촬영일시가 {earliest.date()} ~ {latest.date()}에 걸쳐 있다. 시작일 {earliest.date()}을 쓴다."
            )
        resolved_date = earliest.strftime("%Y%m%d")

    ordered = _order_files(images, dates)
    folder = naming.folder_name(resolved_date, track, slug)
    raw_dir = archive_root / folder / RAW_DIR

    existing_names = {p.name for p in raw_dir.iterdir()} if raw_dir.is_dir() else set()

    planned_files = []
    for seq, src in enumerate(ordered, start=1):
        dest_name = naming.file_name(resolved_date, track, slug, seq, src.suffix)
        planned_files.append(
            PlannedFile(source=src, dest_name=dest_name, exists_at_dest=dest_name in existing_names)
        )

    index_path = archive_root / INDEX_CSV_NAME
    rows = index_csv.read_rows(index_path)
    existing_row = index_csv.find_by_slug(rows, slug)
    index_row = None
    if existing_row is None:
        index_row = {
            "id": index_csv.next_id(rows),
            "date": f"{resolved_date[0:4]}-{resolved_date[4:6]}-{resolved_date[6:8]}",
            "track": track,
            "slug": slug,
            "place": place,
            "tags": tags,
            "count": str(len([f for f in planned_files if not f.exists_at_dest])),
            "status": "raw",
            "title_ko": "",
            "title_en": "",
            "note": "",
        }
    else:
        warnings.append(
            f"index.csv에 slug={slug!r} 행이 이미 있다. 기존 행은 고치지 않으므로 새 행을 추가하지 않는다. "
            "count가 달라졌으면 check로 확인하고 note에 사유를 남겨 직접 반영하라."
        )

    return IngestPlan(
        archive_root=archive_root,
        folder_name=folder,
        raw_dir=raw_dir,
        date=resolved_date,
        track=track,
        slug=slug,
        files=planned_files,
        ignored=ignored,
        multi_day_span_days=multi_day_span_days,
        index_row=index_row,
        warnings=warnings,
    )


def apply_ingest(plan: IngestPlan) -> None:
    plan.raw_dir.mkdir(parents=True, exist_ok=True)
    # 분류체계 문서의 폴더 구조(00_raw/10_select/20_web 세 층)를 갖춰 둔다.
    shoot_dir = plan.raw_dir.parent
    (shoot_dir / SELECT_DIR).mkdir(exist_ok=True)
    (shoot_dir / WEB_DIR).mkdir(exist_ok=True)
    for f in plan.to_copy:
        shutil.copy2(f.source, plan.raw_dir / f.dest_name)
    if plan.index_row is not None:
        index_csv.append_row(plan.archive_root / INDEX_CSV_NAME, plan.index_row)
