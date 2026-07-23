# photo-site

사진 포트폴리오 웹사이트. [Astro](https://astro.build)로 만든 정적 사이트다. 원본 사진은
절대 이 저장소에 들어오지 않는다 — `../photo-archive/`(archive-tool로 정리)에서 웹용으로
내보낸(`20_web/`) 사본만 `public/photos/`에 들어간다.

## 개발

```bash
npm install
npm run dev       # http://localhost:4321
```

## 콘텐츠 추가/수정

[`content/README.md`](./content/README.md) 참고. 요약하면:

1. `photo-archive/`에서 `archive-tool export`로 `20_web/`을 만든다.
2. 그 이미지들을 `public/photos/<slug>/`에 복사한다.
3. `content/index.csv`에 해당 행을 추가하고 `status`를 `published`로 바꾼다.

## 편집이 필요한 자리 표시자

- `src/layouts/Layout.astro`의 "사진가 이름" — 실제 이름/상호로 바꿀 것
- `src/pages/about.astro` — 소개 글
- `src/pages/contact.astro` — 이메일/SNS 링크
- `content/index.csv`와 `public/photos/`의 `*-sample` 4건 — 실제 사진으로 교체 후 삭제
- `astro.config.mjs`의 `site` 값 — 실제 배포 도메인으로 교체

## 배포 (무료)

**Vercel** 기준:

1. 이 저장소를 GitHub에 올린 상태에서 [vercel.com](https://vercel.com)에 가입하고 저장소를 연결한다.
2. Root Directory를 `photo-site`로 지정한다 (모노레포이므로).
3. Framework Preset은 Astro로 자동 인식된다. Build Command `npm run build`, Output
   Directory `dist` — 기본값 그대로 두면 된다.
4. 배포 후 나오는 도메인을 `astro.config.mjs`의 `site`에 넣고 다시 배포한다.

Netlify도 동일한 방식(Base directory: `photo-site`, Build command: `npm run build`,
Publish directory: `photo-site/dist`)으로 가능하다.
