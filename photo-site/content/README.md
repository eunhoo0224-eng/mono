# content/

이 사이트가 읽는 데이터 원본이다. `../photo-archive/`(archive-tool로 정리한 원본 아카이브)와는
별개의 저장소/폴더다 — 원본은 절대 이 사이트로 들어오지 않는다.

## 촬영 건 추가하는 법

### 쉬운 방법 — 관리자 업로드 폼 (권장)

```bash
npm run admin      # http://localhost:4322
```

사진을 끌어다 놓고 정보만 채우면 웹용 변환·파일 저장·`index.csv` 기록까지 자동으로
됩니다. 그 뒤 `git commit && git push`. 자세한 건 [`../admin/README.md`](../admin/README.md).

### 손으로 하는 방법

1. 이미지 파일들을 `public/photos/<slug>/`에 넣는다 (웹용으로 축소해서 — 긴 변 2560px 권장).
   photo-archive의 `archive-tool export`가 만든 `20_web/` 결과물을 복사해 오면 딱 맞다.
2. `content/index.csv`에 그 촬영 건의 행을 추가한다. `title_ko`/`title_en`을 채우고
   `status`를 `published`로 바꾼다.
3. `npm run dev`로 로컬에서 확인한 뒤 배포한다.

`status`가 `published`가 아니거나 `public/photos/<slug>/`에 이미지가 하나도 없으면
사이트에 나타나지 않는다 (src/lib/shoots.ts 참고).

지금 들어있는 4건(`*-sample`)은 전부 자리 표시자다. 진짜 사진으로 교체하면서 지워라.
