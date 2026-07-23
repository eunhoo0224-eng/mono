import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// 배포 도메인이 정해지면 site 값을 실제 주소로 바꾸세요.
// (robots.txt의 Sitemap 줄도 같이 바꿔주면 됩니다.)
export default defineConfig({
  site: "https://example.com",
  integrations: [sitemap()],
});
