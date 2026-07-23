"""photo-archive/ 정리 CLI 진입점."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from archive_tool import check, export_cmd, index_csv, ingest, status_cmd
from archive_tool.constants import INDEX_CSV_NAME
from archive_tool.exif_utils import ExifToolNotFound


def _add_archive_root(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--archive-root", type=Path, default=Path.cwd(),
        help="photo-archive/ 경로 (기본값: 현재 디렉터리)",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="archive-tool", description="photo-archive/ 정리 도구")
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="원본 폴더를 촬영 건 폴더로 옮겨 담는다")
    p_ingest.add_argument("input_dir", type=Path, help="원본 사진이 든 폴더")
    p_ingest.add_argument("--track", choices=["C", "P"], help="C(수주) 또는 P(개인)")
    p_ingest.add_argument("--slug", required=True, help="영문 소문자+하이픈 slug")
    p_ingest.add_argument("--date", help="YYYYMMDD. 안 주면 EXIF에서 읽는다")
    p_ingest.add_argument("--place", default="", help="장소 (index.csv의 place 칸)")
    p_ingest.add_argument("--tags", default="", help="세미콜론으로 구분한 태그")
    p_ingest.add_argument(
        "--allow-multi-day", action="store_true",
        help="EXIF 날짜가 3일 이상 걸쳐 있어도 한 건으로 보고 진행한다",
    )
    p_ingest.add_argument("--apply", action="store_true", help="실제로 복사·기록한다 (기본은 dry-run)")
    _add_archive_root(p_ingest)

    p_export = sub.add_parser("export", help="10_select/를 웹용으로 20_web/에 내보낸다")
    p_export.add_argument("shoot_dir", type=Path, help="촬영 건 폴더 경로")
    p_export.add_argument("--hero", action="store_true", help="긴 변 3840px로 내보낸다 (기본 2560px)")
    p_export.add_argument("--apply", action="store_true", help="실제로 내보낸다 (기본은 dry-run)")

    p_check = sub.add_parser("check", help="규칙 위반을 찾는다 (고치지 않음)")
    _add_archive_root(p_check)

    p_status = sub.add_parser("status", help="촬영 건 목록을 status 기준으로 요약한다")
    _add_archive_root(p_status)

    p_init = sub.add_parser("init-index", help="빈 index.csv를 새로 만든다")
    _add_archive_root(p_init)

    return parser


def _cmd_ingest(args: argparse.Namespace) -> int:
    try:
        plan = ingest.plan_ingest(
            input_dir=args.input_dir,
            archive_root=args.archive_root,
            track=args.track,
            slug=args.slug,
            date=args.date,
            place=args.place,
            tags=args.tags,
            allow_multi_day=args.allow_multi_day,
        )
    except (ingest.NeedsHumanDecision, index_csv.IndexMissing) as e:
        print(f"멈춤: {e}", file=sys.stderr)
        return 2

    prefix = "[적용]" if args.apply else "[dry-run]"
    print(f"{prefix} 대상: {plan.raw_dir}")
    for f in plan.to_copy:
        print(f"  복사: {f.source.name} -> {f.dest_name}")
    for f in plan.to_skip:
        print(f"  건너뜀(이미 있음): {f.dest_name}")
    if plan.ignored:
        print(f"  무시(이미지 아님): {[p.name for p in plan.ignored]}")
    if plan.index_row is not None:
        print(f"  index.csv: id={plan.index_row['id']} 행 추가 예정")
    for w in plan.warnings:
        print(f"  주의: {w}")
    print(
        f"  요약: 복사 {len(plan.to_copy)}장 / 건너뜀 {len(plan.to_skip)}장 / "
        f"무시 {len(plan.ignored)}개"
    )

    if args.apply:
        ingest.apply_ingest(plan)
        print("적용 완료.")
    return 0


def _cmd_export(args: argparse.Namespace) -> int:
    plan = export_cmd.plan_export(args.shoot_dir, hero=args.hero)
    if plan.empty:
        print(plan.warnings[0])
        return 0

    prefix = "[적용]" if args.apply else "[dry-run]"
    print(f"{prefix} 대상: {plan.web_dir} (긴 변 {plan.max_long_edge}px)")
    for f in plan.to_copy:
        print(f"  내보냄: {f.dest_name}")
    for f in plan.to_skip:
        print(f"  건너뜀(이미 있음): {f.dest_name}")
    if plan.ignored:
        print(f"  무시(대상 아님): {[p.name for p in plan.ignored]}")
    print(f"  요약: 내보냄 {len(plan.to_copy)}장 / 건너뜀 {len(plan.to_skip)}장")

    if args.apply:
        export_cmd.apply_export(plan)
        print("적용 완료.")
    return 0


def _cmd_check(args: argparse.Namespace) -> int:
    violations = check.run_check(args.archive_root)
    if not violations:
        print("위반 0건.")
        return 0
    for v in violations:
        print(f"[{v.category}] {v.message}")
    print(f"총 {len(violations)}건.")
    return 1


def _cmd_status(args: argparse.Namespace) -> int:
    grouped = status_cmd.run_status(args.archive_root)
    for status_name, rows in grouped.items():
        print(f"{status_name or '(빈 값)'} ({len(rows)}건)")
        for r in rows:
            print(f"  id={r['id']} slug={r['slug']} date={r['date']} track={r['track']}")
    return 0


def _cmd_init_index(args: argparse.Namespace) -> int:
    index_path = args.archive_root / INDEX_CSV_NAME
    try:
        index_csv.init_index(index_path)
    except FileExistsError as e:
        print(f"멈춤: {e}", file=sys.stderr)
        return 2
    print(f"{index_path} 생성됨.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "ingest":
            return _cmd_ingest(args)
        if args.command == "export":
            return _cmd_export(args)
        if args.command == "check":
            return _cmd_check(args)
        if args.command == "status":
            return _cmd_status(args)
        if args.command == "init-index":
            return _cmd_init_index(args)
    except ExifToolNotFound as e:
        print(f"멈춤: {e}", file=sys.stderr)
        return 2
    parser.error("알 수 없는 명령")
    return 2


if __name__ == "__main__":
    sys.exit(main())
