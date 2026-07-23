# content/

이 사이트가 읽는 데이터 원본이다. `../photo-archive/`(archive-tool로 정리한 원본 아카이브)와는
별개의 저장소/폴더다 — 원본은 절대 이 사이트로 들어오지 않는다.

## 촬영 건 하나를 공개하는 절차

1. `archive-tool export <촬영 건 폴더> --apply`로 `20_web/`을 만든다 (photo-archive 쪽에서).
2. `20_web/` 안의 이미지 파일들을 이 폴더의 형제인 `public/photos/<slug>/`에 그대로 복사한다.
3. `content/index.csv`에 그 촬영 건의 행을 추가한다 (photo-archive의 index.csv에서 그대로
   복사해 오면 된다). `title_ko`/`title_en`을 채우고 `status`를 `published`로 바꾼다.
4. `npm run dev`로 로컬에서 확인한 뒤 배포한다.

`status`가 `published`가 아니거나 `public/photos/<slug>/`에 이미지가 하나도 없으면
사이트에 나타나지 않는다 (src/lib/shoots.ts 참고).

지금 들어있는 4건(`*-sample`)은 전부 자리 표시자다. 진짜 사진으로 교체하면서 지워라.
