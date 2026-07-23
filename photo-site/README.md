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

가장 쉬운 방법은 로컬 관리자 업로드 폼이다:

```bash
npm run admin     # http://localhost:4322 — 드래그드롭 업로드 → 저장소에 저장
```

자세한 절차는 [`content/README.md`](./content/README.md), [`admin/README.md`](./admin/README.md) 참고.
손으로 할 경우: 이미지를 `public/photos/<slug>/`에 넣고 `content/index.csv`에 행을 추가한 뒤
`status`를 `published`로 바꾼다.

## 편집이 필요한 자리 표시자

- `src/layouts/Layout.astro`의 "사진가 이름" — 실제 이름/상호로 바꿀 것
- `src/pages/about.astro` — 소개 글
- `src/pages/contact.astro` — 이메일/SNS 링크
- `content/index.csv`와 `public/photos/`의 `*-sample` 4건 — 실제 사진으로 교체 후 삭제
- `astro.config.mjs`의 `site` 값 — 실제 배포 도메인으로 교체

## 배포 (전부 무료 — 서버·유료 인프라 불필요)

정적 사이트라 무료 호스팅으로 충분하다. 전부 **HTTPS + CDN + 무료 서브도메인**을 준다.

**Vercel** 기준:

1. 이 저장소를 GitHub에 올린 상태에서 [vercel.com](https://vercel.com)에 가입하고 저장소를 연결한다.
2. Root Directory를 `photo-site`로 지정한다 (모노레포이므로).
3. Framework Preset은 Astro로 자동 인식된다. Build Command `npm run build`, Output
   Directory `dist` — 기본값 그대로 두면 된다.
4. 배포 후 나오는 도메인(예: `이름.vercel.app`)을 `astro.config.mjs`의 `site`와
   `public/robots.txt`의 Sitemap 줄에 넣고 다시 배포한다.

Netlify(Base directory `photo-site`), Cloudflare Pages, GitHub Pages도 같은 방식으로 가능하다.

### "진짜 개인 사이트처럼" 보이게 하기

- **무료 서브도메인** `이름.vercel.app` / `이름.pages.dev` — 이것만으로도 충분히 봐줄 만하다.
- **커스텀 도메인** `이름.com` — 유일한 소액 비용(연 ~1.5만원). 가장 "산 사이트" 느낌.
  구입 후 호스팅의 Domains 설정에 연결하면 된다. 무료 대안: `is-a.dev`, `eu.org`.
- **소셜 공유 카드**(OG 이미지) — 이미 적용됨(`public/og.png`). 링크를 카톡·트위터 등에
  붙이면 미리보기 카드가 뜬다. 도메인을 바꾸면 `astro.config.mjs`의 `site`만 맞추면 된다.
- **HTTPS 자물쇠·파비콘** — 위 호스팅에서 자동 + `public/favicon.svg` 적용됨.
