# archive-tool

`photo-archive/` 정리 CLI. 규칙의 원본은 [`사진아카이브_분류체계.md`](./사진아카이브_분류체계.md), 도구의 계약과 금지 사항의 원본은 [`작업지시서_아카이브도구.md`](./작업지시서_아카이브도구.md)이다. 여기서는 사용법만 다룬다.

## 설치

```bash
# 외부 의존성 (메타데이터 처리)
sudo apt install libimage-exiftool-perl   # 또는 macOS: brew install exiftool

pip install -e .
```

## 사용

```bash
# photo-archive/ 안에서 실행한다고 가정 (--archive-root로 다른 경로 지정 가능)

archive-tool init-index                                    # 처음 한 번, 빈 index.csv 생성

archive-tool ingest ~/카메라/DCIM/100CANON --track C --slug studio-group
# 위는 dry-run이다. 실제로 반영하려면:
archive-tool ingest ~/카메라/DCIM/100CANON --track C --slug studio-group --apply

# 00_raw/에서 고른 사진을 10_select/로 직접 복사한 뒤:
archive-tool export 20260710_C_studio-group --apply
archive-tool export 20260710_C_studio-group --hero --apply   # 대표작만 3840px로

archive-tool check                                          # 규칙 위반 검사 (고치지 않음)
archive-tool status                                         # status 칸 기준 요약
```

## 개발

```bash
pip install -e ".[dev]"
pytest
```
