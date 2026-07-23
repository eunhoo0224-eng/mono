// 로컬 관리자 서버 — "프론트엔드 업로드 + 백엔드 저장" 데모.
//
// 실행: npm run admin  → http://localhost:4322
// 이 서버는 로컬 저작(authoring) 전용이다. 배포 사이트에는 포함되지 않는다.
// 업로드된 사진을 웹용으로 변환해 저장소 파일(public/photos, content/index.csv)에
// 써넣는다. 그 뒤 git commit / push 하면 배포에 반영된다.
//
// 공개 인터넷에 띄우지 말 것 — 인증이 없다. 내 컴퓨터에서만 돌린다.

import express from "express";
import multer from "multer";
import { execFile } from "node:child_process";
import { readShoots, saveShoot } from "./store.mjs";

const PORT = process.env.ADMIN_PORT || 4322;
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 60 }, // 장당 60MB, 최대 60장
});

app.get("/", (_req, res) => {
  const { rows } = readShoots();
  const existing = rows
    .map((r) => `<li><b>${r.slug}</b> · ${r.title_ko || r.title_en || "(제목 없음)"} · ${r.count}장 · ${r.status}</li>`)
    .join("");
  res.type("html").send(PAGE(existing || "<li>아직 없음</li>"));
});

app.post("/upload", upload.array("photos", 60), async (req, res) => {
  try {
    const result = await saveShoot(
      {
        titleKo: req.body.titleKo,
        titleEn: req.body.titleEn,
        date: req.body.date,
        track: req.body.track,
        place: req.body.place,
        tags: req.body.tags,
        slug: req.body.slug,
        status: req.body.status || "published",
      },
      req.files || []
    );
    res.json({
      ok: true,
      ...result,
      message:
        `저장 완료: ${result.count}장 → public/photos/${result.slug}/ , index.csv에 id=${result.id} 추가. ` +
        `확인 후 git commit / push 하면 사이트에 반영됩니다.`,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

// 편의: 현재 변경사항을 커밋(선택). git이 있는 환경에서만.
app.post("/commit", express.json(), (req, res) => {
  const msg = (req.body && req.body.message) || "content: 사진 추가 (admin)";
  execFile("git", ["add", "public/photos", "content/index.csv"], { cwd: process.cwd() }, (e1) => {
    if (e1) return res.status(500).json({ ok: false, error: String(e1) });
    execFile("git", ["commit", "-m", msg], { cwd: process.cwd() }, (e2, out) => {
      if (e2) return res.status(500).json({ ok: false, error: String(e2), out: String(out) });
      res.json({ ok: true, message: "커밋했습니다. git push로 배포에 반영하세요." });
    });
  });
});

app.listen(PORT, () => {
  console.log(`\n  사진 관리자  →  http://localhost:${PORT}\n`);
  console.log("  업로드 후 git commit / push 하면 배포 사이트에 반영됩니다.");
  console.log("  (이 서버는 로컬 저작 전용 — 공개 배포하지 마세요.)\n");
});

function PAGE(existing) {
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>사진 관리자</title>
<style>
:root{--blue:#3182f6;--blue-hover:#1b64da;--bg:#f2f4f6;--card:#fff;--fg:#191f28;--fg2:#4e5968;--fg3:#8b95a1;--line:#e5e8eb;--radius:16px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;line-height:1.6;padding:2rem 1rem 4rem}
.wrap{max-width:640px;margin:0 auto}
h1{font-size:1.8rem;font-weight:800;letter-spacing:-.03em;margin:0 0 .3rem}
.muted{color:var(--fg3);font-size:.92rem;margin:0 0 1.75rem}
.card{background:var(--card);border-radius:var(--radius);padding:1.5rem;box-shadow:0 2px 8px rgba(25,31,40,.06);margin-bottom:1.25rem}
label{display:block;font-weight:600;font-size:.9rem;margin:0 0 .4rem}
.row{display:flex;gap:.75rem}.row>div{flex:1}
input,select{width:100%;padding:.7rem .85rem;border:1px solid var(--line);border-radius:12px;font:inherit;background:#fff;margin-bottom:1rem}
input:focus,select:focus{outline:none;border-color:var(--blue)}
.drop{border:2px dashed var(--line);border-radius:var(--radius);padding:2rem;text-align:center;color:var(--fg3);cursor:pointer;transition:.15s;margin-bottom:1rem}
.drop.hot{border-color:var(--blue);color:var(--blue);background:#f5f9ff}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:.5rem;margin-bottom:1rem}
.thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px}
.btn{display:inline-flex;justify-content:center;align-items:center;width:100%;border:none;background:var(--blue);color:#fff;font:inherit;font-weight:600;padding:.9rem;border-radius:14px;cursor:pointer}
.btn:hover{background:var(--blue-hover)}.btn:disabled{opacity:.5;cursor:default}
.out{margin-top:1rem;padding:.9rem 1rem;border-radius:12px;font-size:.92rem;font-weight:500;display:none}
.out.ok{display:block;background:#e8f7ee;color:#0b7a3b}
.out.err{display:block;background:#fdecec;color:#c0392b}
ul{margin:.25rem 0 0;padding-left:1.1rem;color:var(--fg2);font-size:.9rem}
small{color:var(--fg3)}
</style></head><body><div class="wrap">
<h1>사진 관리자</h1>
<p class="muted">사진을 올리고 정보를 채우면 웹용으로 변환해 저장소에 저장합니다. 저장 후 <b>git commit / push</b> 하면 사이트에 반영돼요.</p>

<form id="f" class="card">
  <div class="drop" id="drop">여기로 사진을 끌어다 놓거나 클릭해서 선택<br><small>여러 장 선택 가능 · JPG/PNG · 긴 변 2560px로 자동 축소</small>
    <input id="photos" name="photos" type="file" accept="image/*" multiple hidden>
  </div>
  <div class="thumbs" id="thumbs"></div>

  <div class="row">
    <div><label>한글 제목</label><input name="titleKo" placeholder="예: 미국 서부 여행"></div>
    <div><label>영문 제목</label><input name="titleEn" placeholder="US West Trip"></div>
  </div>
  <div class="row">
    <div><label>날짜</label><input name="date" type="date" required></div>
    <div><label>트랙</label><select name="track" required>
      <option value="P">P — 개인 (아무도 안 기다린 촬영)</option>
      <option value="C">C — 수주 (받을 사람이 정해진 촬영)</option>
    </select></div>
  </div>
  <div class="row">
    <div><label>장소</label><input name="place" placeholder="Los Angeles"></div>
    <div><label>태그 <small>(쉼표로 구분)</small></label><input name="tags" placeholder="landscape, concept"></div>
  </div>
  <label>slug <small>(비우면 영문 제목에서 자동 생성 · 영소문자-하이픈)</small></label>
  <input name="slug" placeholder="us-west-trip">

  <button class="btn" id="submit" type="submit">업로드하고 저장</button>
  <div class="out" id="out"></div>
</form>

<div class="card">
  <label>현재 저장된 촬영 건</label>
  <ul>${existing}</ul>
</div>

<script>
const drop=document.getElementById('drop'),input=document.getElementById('photos'),thumbs=document.getElementById('thumbs'),out=document.getElementById('out'),form=document.getElementById('f'),submit=document.getElementById('submit');
let files=[];
drop.onclick=()=>input.click();
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hot')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hot')}));
drop.addEventListener('drop',ev=>{addFiles(ev.dataTransfer.files)});
input.onchange=()=>addFiles(input.files);
function addFiles(list){for(const f of list){if(f.type.startsWith('image/'))files.push(f)}render()}
function render(){thumbs.innerHTML='';files.forEach(f=>{const i=document.createElement('img');i.src=URL.createObjectURL(f);thumbs.appendChild(i)});drop.querySelector('br')&&(drop.firstChild.textContent=files.length?files.length+'장 선택됨 — 더 추가하려면 클릭':'여기로 사진을 끌어다 놓거나 클릭해서 선택')}
form.onsubmit=async ev=>{
  ev.preventDefault();
  if(!files.length){show('사진을 최소 한 장 올려주세요.',false);return}
  const fd=new FormData(form);fd.delete('photos');files.forEach(f=>fd.append('photos',f));
  submit.disabled=true;submit.textContent='저장 중…';
  try{
    const r=await fetch('/upload',{method:'POST',body:fd});
    const j=await r.json();
    if(j.ok){show(j.message,true);files=[];render();form.reset()}else show(j.error,false);
  }catch(e){show(String(e),false)}
  submit.disabled=false;submit.textContent='업로드하고 저장';
};
function show(msg,ok){out.className='out '+(ok?'ok':'err');out.textContent=msg}
</script>
</div></body></html>`;
}
