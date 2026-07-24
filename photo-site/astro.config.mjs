import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// 나중에 커스텀 도메인(예: eunhookim.com)을 붙이면 이 값과 robots.txt만 바꾸면 된다.
export default defineConfig({
  site: "https://mono-9214.vercel.app",
  integrations: [sitemap()],
});
