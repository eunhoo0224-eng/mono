"""분류체계 문서의 숫자·문자열 상수. 값이 바뀌면 이 파일과 문서를 같이 고친다."""

import re

TRACKS = ("C", "P")

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
FOLDER_RE = re.compile(r"^(?P<date>\d{8})_(?P<track>[CP])_(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$")
FILE_RE = re.compile(
    r"^(?P<date>\d{8})_(?P<track>[CP])_(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)_(?P<seq>\d{3})\.(?P<ext>[A-Za-z0-9]+)$"
)

RAW_DIR = "00_raw"
SELECT_DIR = "10_select"
WEB_DIR = "20_web"

INDEX_CSV_NAME = "index.csv"
INDEX_FIELDS = [
    "id", "date", "track", "slug", "place", "tags",
    "count", "status", "title_ko", "title_en", "note",
]
STATUS_ORDER = ["raw", "selected", "web", "published"]

# ingest가 원본으로 인정하는 확장자. 분류체계 문서는 jpg 예시만 들지만
# "사진 원본"에는 흔한 RAW 포맷도 포함되므로 실무에서 쓰는 확장자를 넣는다.
IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif",
    ".cr2", ".cr3", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2",
}

# export가 그대로 열어 리사이즈할 수 있는(=Pillow가 디코드 가능한) 확장자.
# RAW는 여기 안 들어간다 — 07_select 단계에는 이미 편집이 끝난 파일이 온다고 가정.
EXPORTABLE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}

WEB_LONG_EDGE = 2560
WEB_LONG_EDGE_HERO = 3840
WEB_JPEG_QUALITY = 80

MULTI_DAY_THRESHOLD_DAYS = 3
