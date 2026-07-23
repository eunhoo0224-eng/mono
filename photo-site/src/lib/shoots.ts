import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Shoot {
  id: string;
  date: string;
  slug: string;
  place: string;
  tags: string[];
  titleKo: string;
  titleEn: string;
  images: string[]; // "/photos/<slug>/<file>.jpg" 형태의 public 경로
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const INDEX_CSV = path.join(ROOT, "content", "index.csv");
const PHOTOS_DIR = path.join(ROOT, "public", "photos");

/** 아주 단순한 RFC4180 CSV 파서. 따옴표로 감싼 칸의 콤마·개행을 지원한다. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((cell) => cell !== ""));
  return body.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}

function listImages(slug: string): string[] {
  const dir = path.join(PHOTOS_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith("."))
    .sort()
    .map((f) => `/photos/${slug}/${f}`);
}

let cache: Shoot[] | null = null;

/** content/index.csv에서 status=published인 촬영 건만 읽어 온다. */
export function getPublishedShoots(): Shoot[] {
  if (cache) return cache;

  const rows = parseCsv(fs.readFileSync(INDEX_CSV, "utf-8"));
  cache = rows
    .filter((r) => r.status === "published")
    .map((r) => ({
      id: r.id,
      date: r.date,
      slug: r.slug,
      place: r.place,
      tags: r.tags ? r.tags.split(";").filter(Boolean) : [],
      titleKo: r.title_ko,
      titleEn: r.title_en,
      images: listImages(r.slug),
    }))
    .filter((s) => s.images.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return cache;
}

export function getShootBySlug(slug: string): Shoot | undefined {
  return getPublishedShoots().find((s) => s.slug === slug);
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const s of getPublishedShoots()) {
    for (const t of s.tags) tags.add(t);
  }
  return [...tags].sort();
}
