// 백엔드 "저장소" 계층.
// 업로드된 사진을 웹용으로 변환해 public/photos/<slug>/ 에 쓰고,
// content/index.csv 에 촬영 건 한 줄을 추가한다. 저장소 = Git 저장소의 파일.
//
// 규칙 원본은 저장소 루트의 사진아카이브_분류체계.md / 작업지시서_아카이브도구.md.
// 여기서는 그 계약을 웹 업로드 흐름에 맞게 구현할 뿐이다:
//  - 원본 덮어쓰기 금지(같은 slug 폴더가 있으면 거부)
//  - 웹 스펙: 긴 변 2560px, sRGB, JPEG 품질 82, 메타데이터(GPS 포함) 제거
//  - index.csv 는 추가만, 기존 행은 건드리지 않음

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS_DIR = path.join(ROOT, "public", "photos");
const INDEX_CSV = path.join(ROOT, "content", "index.csv");

const WEB_LONG_EDGE = 2560;
const WEB_QUALITY = 82;
// 웹 스펙: GPS 등 원본 메타데이터는 제거하되 저작권은 박아넣는다.
// (사진가 이름이 바뀌면 여기 또는 PHOTO_COPYRIGHT 환경변수로 바꾼다.)
const COPYRIGHT = process.env.PHOTO_COPYRIGHT || "© Eunhoo Kim";

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const rows = [];
  let field = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); field = ""; row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

export function readShoots() {
  if (!fs.existsSync(INDEX_CSV)) return { header: null, rows: [] };
  const rows = parseCsv(fs.readFileSync(INDEX_CSV, "utf-8"));
  const [header, ...body] = rows;
  return {
    header,
    rows: body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ""]))),
  };
}

function nextId(rows) {
  const nums = rows.map((r) => parseInt(r.id, 10)).filter((n) => !Number.isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
}

/**
 * 촬영 건 하나를 저장한다.
 * @param {{titleKo?:string,titleEn?:string,date:string,track:'C'|'P',place?:string,
 *          tags?:string,slug?:string,status?:string}} meta
 * @param {{buffer:Buffer, originalname:string}[]} files
 * @returns {Promise<{slug:string,id:string,count:number,dir:string}>}
 */
export async function saveShoot(meta, files) {
  if (!files?.length) throw new Error("사진이 최소 한 장은 필요합니다.");
  if (meta.track !== "C" && meta.track !== "P")
    throw new Error("트랙은 C 또는 P 여야 합니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || ""))
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");

  const slug = meta.slug ? slugify(meta.slug) : slugify(meta.titleEn || meta.titleKo || "");
  if (!SLUG_RE.test(slug))
    throw new Error(`slug를 만들 수 없습니다. 영문 제목이나 slug를 직접 입력하세요. (받은 값: ${slug || "(빈 값)"})`);

  const dir = path.join(PHOTOS_DIR, slug);
  if (fs.existsSync(dir))
    throw new Error(`이미 존재하는 slug입니다: ${slug} — 덮어쓰지 않습니다. 다른 slug를 쓰세요.`);

  const { rows } = readShoots();
  if (rows.some((r) => r.slug === slug))
    throw new Error(`index.csv에 이미 있는 slug입니다: ${slug}`);

  // 파일명 순서대로 번호를 매긴다(업로드 순서 대신 안정적인 정렬).
  const ordered = [...files].sort((a, b) => a.originalname.localeCompare(b.originalname));

  fs.mkdirSync(dir, { recursive: true });
  let seq = 0;
  for (const f of ordered) {
    seq++;
    const out = path.join(dir, `${slug}_${String(seq).padStart(3, "0")}.jpg`);
    await sharp(f.buffer)
      .rotate() // EXIF orientation 반영 후
      .resize({
        width: WEB_LONG_EDGE,
        height: WEB_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true, // 원본이 작으면 키우지 않음
      })
      .toColorspace("srgb")
      // sharp는 기본적으로 원본 메타데이터를 버린다(=GPS 등 제거).
      // 그 위에 저작권만 새로 박아넣는다.
      .withExif({ IFD0: { Copyright: COPYRIGHT, Artist: COPYRIGHT } })
      .jpeg({ quality: WEB_QUALITY, mozjpeg: true })
      .toFile(out);
  }

  const id = nextId(rows);
  const record = {
    id,
    date: meta.date,
    track: meta.track,
    slug,
    place: meta.place || "",
    tags: (meta.tags || "")
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .join(";"),
    count: String(seq),
    status: meta.status || "published",
    title_ko: meta.titleKo || "",
    title_en: meta.titleEn || "",
    note: "admin 업로드",
  };

  const header = ["id","date","track","slug","place","tags","count","status","title_ko","title_en","note"];
  const line = header.map((k) => csvEscape(record[k])).join(",") + "\n";
  // 파일이 개행으로 끝나지 않으면 먼저 개행을 넣어 행이 붙지 않게 한다.
  if (fs.existsSync(INDEX_CSV)) {
    const cur = fs.readFileSync(INDEX_CSV, "utf-8");
    if (cur.length && !cur.endsWith("\n")) fs.appendFileSync(INDEX_CSV, "\n");
  } else {
    fs.writeFileSync(INDEX_CSV, header.join(",") + "\n");
  }
  fs.appendFileSync(INDEX_CSV, line);

  return { slug, id, count: seq, dir: path.relative(ROOT, dir) };
}
