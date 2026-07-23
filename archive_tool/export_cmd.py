"""`export` 명령 (작업지시서 3-2절, 4절)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from archive_tool import exif_utils, image_export
from archive_tool.constants import (
    EXPORTABLE_EXTENSIONS, SELECT_DIR, WEB_DIR, WEB_JPEG_QUALITY,
    WEB_LONG_EDGE, WEB_LONG_EDGE_HERO,
)


@dataclass
class PlannedExport:
    source: Path
    dest_name: str
    exists_at_dest: bool


@dataclass
class ExportPlan:
    shoot_dir: Path
    select_dir: Path
    web_dir: Path
    files: list[PlannedExport]
    ignored: list[Path]
    max_long_edge: int
    empty: bool
    warnings: list[str] = field(default_factory=list)

    @property
    def to_copy(self) -> list[PlannedExport]:
        return [f for f in self.files if not f.exists_at_dest]

    @property
    def to_skip(self) -> list[PlannedExport]:
        return [f for f in self.files if f.exists_at_dest]


def plan_export(shoot_dir: Path, hero: bool = False) -> ExportPlan:
    select_dir = shoot_dir / SELECT_DIR
    web_dir = shoot_dir / WEB_DIR

    if not select_dir.is_dir() or not any(select_dir.iterdir()):
        return ExportPlan(
            shoot_dir=shoot_dir, select_dir=select_dir, web_dir=web_dir,
            files=[], ignored=[], max_long_edge=WEB_LONG_EDGE_HERO if hero else WEB_LONG_EDGE,
            empty=True, warnings=[f"{select_dir}가 비어 있다. export할 것이 없다."],
        )

    images, ignored = [], []
    for p in sorted(select_dir.iterdir()):
        if not p.is_file() or p.name.startswith("."):
            continue
        (images if p.suffix.lower() in EXPORTABLE_EXTENSIONS else ignored).append(p)

    existing_names = {p.name for p in web_dir.iterdir()} if web_dir.is_dir() else set()
    files = [
        PlannedExport(source=p, dest_name=p.name, exists_at_dest=p.name in existing_names)
        for p in images
    ]

    return ExportPlan(
        shoot_dir=shoot_dir, select_dir=select_dir, web_dir=web_dir,
        files=files, ignored=ignored,
        max_long_edge=WEB_LONG_EDGE_HERO if hero else WEB_LONG_EDGE,
        empty=False,
    )


def apply_export(plan: ExportPlan) -> None:
    plan.web_dir.mkdir(parents=True, exist_ok=True)
    for f in plan.to_copy:
        dest = plan.web_dir / f.dest_name
        image_export.export_image(f.source, dest, plan.max_long_edge, WEB_JPEG_QUALITY)
        exif_utils.copy_metadata_strip_gps(f.source, dest)
