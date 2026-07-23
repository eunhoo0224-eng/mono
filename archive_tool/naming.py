"""폴더·파일 이름 규칙 (사진아카이브_분류체계.md 2절)."""

from __future__ import annotations

from dataclasses import dataclass

from archive_tool.constants import FILE_RE, FOLDER_RE, SLUG_RE, TRACKS


class NamingError(ValueError):
    pass


def validate_track(track: str) -> str:
    if track not in TRACKS:
        raise NamingError(f"트랙은 {TRACKS} 중 하나여야 한다: {track!r}")
    return track


def validate_slug(slug: str) -> str:
    if not SLUG_RE.match(slug):
        raise NamingError(
            f"slug는 영문 소문자·숫자·하이픈만 쓸 수 있다 (한글/대문자/밑줄 불가): {slug!r}"
        )
    return slug


def folder_name(date: str, track: str, slug: str) -> str:
    """date는 YYYYMMDD 8자리 문자열."""
    validate_track(track)
    validate_slug(slug)
    if len(date) != 8 or not date.isdigit():
        raise NamingError(f"날짜는 YYYYMMDD 8자리여야 한다: {date!r}")
    return f"{date}_{track}_{slug}"


def file_name(date: str, track: str, slug: str, seq: int, ext: str) -> str:
    base = folder_name(date, track, slug)
    ext = ext.lower().lstrip(".")
    return f"{base}_{seq:03d}.{ext}"


@dataclass(frozen=True)
class ParsedFolder:
    date: str
    track: str
    slug: str


@dataclass(frozen=True)
class ParsedFile:
    date: str
    track: str
    slug: str
    seq: int
    ext: str


def parse_folder_name(name: str) -> ParsedFolder | None:
    m = FOLDER_RE.match(name)
    if not m:
        return None
    return ParsedFolder(date=m["date"], track=m["track"], slug=m["slug"])


def parse_file_name(name: str) -> ParsedFile | None:
    m = FILE_RE.match(name)
    if not m:
        return None
    return ParsedFile(
        date=m["date"], track=m["track"], slug=m["slug"],
        seq=int(m["seq"]), ext=m["ext"],
    )
