// 사진 정리(Organizer) — 로컬 웹앱.
//
// 실행: npm run organize  →  http://localhost:4323
//
// 흐름:
//  1) admin/library/ 폴더에 사진을 넣는다 (구글 드라이브에서 맥으로 내려받은 것).
//  2) 브라우저에서 "미분류" 사진들을 다중선택·드래그로 카테고리(컬렉션)에 분류한다.
//  3) [게시]를 누르면 각 컬렉션의 사진을 웹용으로 변환해 public/photos/<slug>/ 에 넣고
//     content/index.csv 를 다시 쓴다 → 그 뒤 git commit/push 하면 사이트에 반영된다.
//
// 분류 상태는 admin/organize-state.json 에 저장되어 작업이 중간에 끊겨도 이어진다.
// 이 서버는 로컬 저작 전용 — 공개 배포하지 않는다(배포 사이트엔 admin/ 미포함).

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN = path.join(ROOT, "admin");
const LIBRARY = path.join(ADMIN, "library");
const STATE_FILE = path.join(ADMIN, "organize-state.json");
const PHOTOS_DIR = path.join(ROOT, "public", "photos");
const INDEX_CSV = path.join(ROOT, "content", "index.csv");
const PAGE = path.join(ADMIN, "organizer.html");

const PORT = process.env.ORGANIZE_PORT || 4323;

// 전시(디스플레이)용 스펙 — 저장소가 무거워지지 않게 2000px로 줄인다.
const DISPLAY_LONG_EDGE = 2000;
const DISPLAY_QUALITY = 82;
const COPYRIGHT = process.env.PHOTO_COPYRIGHT || "© Eunhoo Kim";

const IMG_RE = /\.(jpe?g|png|webp|tif?f|heic|heif)$/i;

fs.mkdirSync(LIBRARY, { recursive: true });

// ── state ────────────────────────────────────────────
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch {
      /* fall through */
    }
  }
  return { collections: [], updatedAt: null };
}
function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function libraryFiles() {
  if (!fs.existsSync(LIBRARY)) return [];
  return fs
    .readdirSync(LIBRARY)
    .filter((f) => IMG_RE.test(f) && !f.startsWith("."))
    .sort();
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── thumbnail cache ──────────────────────────────────
const thumbCache = new Map();
async function thumb(name, size) {
  const key = name + "@" + size;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const buf = await sharp(path.join(LIBRARY, name))
    .rotate()
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
  if (thumbCache.size > 2000) thumbCache.clear();
  thumbCache.set(key, buf);
  return buf;
}

// ── app ──────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/", (_req, res) => res.type("html").send(fs.readFileSync(PAGE, "utf-8")));

app.get("/api/data", (_req, res) => {
  const files = libraryFiles();
  const state = loadState();
  const assigned = new Set(state.collections.flatMap((c) => c.photos));
  const unassigned = files.filter((f) => !assigned.has(f));
  // 라이브러리에서 사라진 파일은 컬렉션에서도 정리
  const present = new Set(files);
  for (const c of state.collections) {
    c.photos = c.photos.filter((p) => present.has(p));
    if (c.cover && !present.has(c.cover)) c.cover = null;
  }
  res.json({ files, unassigned, state, libraryCount: files.length });
});

app.get("/thumb", async (req, res) => {
  const name = path.basename(String(req.query.name || ""));
  const size = Math.min(1200, Math.max(80, parseInt(req.query.size) || 360));
  if (!fs.existsSync(path.join(LIBRARY, name))) return res.status(404).end();
  try {
    res.type("jpeg").set("Cache-Control", "no-store").send(await thumb(name, size));
  } catch (e) {
    res.status(500).end(String(e));
  }
});

app.post("/api/state", (req, res) => {
  const state = req.body;
  if (!state || !Array.isArray(state.collections))
    return res.status(400).json({ ok: false, error: "잘못된 상태" });
  saveState(state);
  res.json({ ok: true });
});

app.post("/api/publish", async (req, res) => {
  try {
    const state = loadState();
    const present = new Set(libraryFiles());
    const collections = state.collections.filter((c) => c.photos.length > 0);

    const header = [
      "id","date","track","slug","place","tags","count","status","title_ko","title_en","note",
    ];
    const rows = [header.join(",")];
    const summary = [];
    const skipped = [];

    let idNum = 0;
    for (const c of collections) {
      const slug = c.slug || slugify(c.titleEn || c.titleKo || `collection-${idNum + 1}`);
      const track = c.track === "C" ? "C" : "P";
      const dir = path.join(PHOTOS_DIR, slug);
      fs.rmSync(dir, { recursive: true, force: true }); // 이 컬렉션은 상태 기준으로 새로 씀
      fs.mkdirSync(dir, { recursive: true });

      // 대표사진을 맨 앞으로
      const ordered = [...c.photos].filter((p) => present.has(p));
      if (c.cover && ordered.includes(c.cover)) {
        ordered.splice(ordered.indexOf(c.cover), 1);
        ordered.unshift(c.cover);
      }

      let seq = 0;
      for (const name of ordered) {
        const out = path.join(dir, `${slug}_${String(seq + 1).padStart(3, "0")}.jpg`);
        try {
          await sharp(path.join(LIBRARY, name))
            .rotate()
            .resize({ width: DISPLAY_LONG_EDGE, height: DISPLAY_LONG_EDGE, fit: "inside", withoutEnlargement: true })
            .toColorspace("srgb")
            .withExif({ IFD0: { Copyright: COPYRIGHT, Artist: COPYRIGHT } })
            .jpeg({ quality: DISPLAY_QUALITY, mozjpeg: true })
            .toFile(out);
          seq++; // 성공한 것만 번호를 매긴다 (건너뛴 파일로 번호가 비지 않게)
        } catch (err) {
          // 한 장이 안 읽혀도(예: sharp가 못 여는 HEIC) 전체를 멈추지 않고 건너뛴다.
          skipped.push({ collection: slug, file: name, reason: String(err.message || err) });
        }
      }

      if (seq === 0) {
        // 이 컬렉션은 실제로 쓸 수 있는 사진이 하나도 없었다 → 빈 폴더 제거하고 색인에서 뺀다.
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }

      idNum++;
      const csvEsc = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      rows.push(
        [
          String(idNum).padStart(3, "0"),
          c.date || new Date().toISOString().slice(0, 10),
          track,
          slug,
          c.place || "",
          (c.tags || []).join(";"),
          String(seq),
          "published",
          c.titleKo || "",
          c.titleEn || "",
          "organizer",
        ].map(csvEsc).join(",")
      );
      summary.push({ slug, count: seq });
    }

    fs.mkdirSync(path.dirname(INDEX_CSV), { recursive: true });
    fs.writeFileSync(INDEX_CSV, rows.join("\n") + "\n");
    let message = `${summary.length}개 컬렉션 게시 완료. git commit/push 하면 사이트에 반영됩니다.`;
    if (skipped.length) {
      message += ` (읽지 못해 건너뛴 사진 ${skipped.length}장 — HEIC 등은 JPEG로 바꿔 다시 넣으세요.)`;
    }
    res.json({ ok: true, summary, skipped, message });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`\n  사진 정리(Organizer)  →  http://localhost:${PORT}`);
  console.log(`  라이브러리 폴더: ${path.relative(ROOT, LIBRARY)}/  (여기에 사진을 넣으세요)`);
  console.log(`  게시 후 git commit/push → 사이트 반영. (로컬 저작 전용)\n`);
});
