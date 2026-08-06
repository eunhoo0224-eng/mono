#!/bin/bash
# 대화 연습 — 맥에서 더블클릭으로 시작. 서버 + cloudflared 터널을 켜고
# 아이패드로 접속할 HTTPS 주소를 띄운다.
#
# 준비 (한 번만):
#   - Node 설치         https://nodejs.org  (LTS)
#   - cloudflared 설치   brew install cloudflared
#   - .env.local 에 키   (이 파일과 같은 폴더, .env.example 참고)
#   - (로컬 STT 쓸 때)   pip install flask mlx-whisper && brew install ffmpeg
#
# 끄기: 이 창에서 Ctrl-C (또는 창 닫기)

cd "$(dirname "$0")" || exit 1
set -u

PORT=3000
STT_PID=""
DEV_PID=""
CF_LOG="$(mktemp -t 대화연습-cf)"

cleanup() {
  echo ""
  echo "정리 중…"
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null
  [ -n "$STT_PID" ] && kill "$STT_PID" 2>/dev/null
  # cloudflared 는 이 스크립트의 자식으로 foreground 실행 → 함께 종료됨
  rm -f "$CF_LOG" 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

echo "======================================"
echo "  대화 연습 — 시작"
echo "======================================"

# 1) Node 확인
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node 가 없습니다. https://nodejs.org 에서 LTS 설치 후 다시 실행하세요."
  read -r -p "엔터를 누르면 닫힙니다..." _; exit 1
fi

# 2) 의존성
if [ ! -d node_modules ]; then
  echo "· 의존성 설치 중 (처음 한 번, 잠시…)"
  npm install --no-audit --no-fund || { echo "❌ npm install 실패"; read -r _; exit 1; }
fi

# 3) .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local 이 없습니다. .env.example 을 복사합니다 — 키를 채워야 대화가 됩니다."
  cp .env.example .env.local
fi

# 4) 로컬 STT 서버 (STT_PROVIDER=local 이고 스크립트가 있으면)
STT_PROVIDER="$(grep -E '^STT_PROVIDER=' .env.local | tail -1 | cut -d= -f2 | tr -d ' \r')"
if [ "$STT_PROVIDER" = "local" ] && [ -f tools/local_stt_server.py ]; then
  if command -v python3 >/dev/null 2>&1; then
    echo "· 로컬 STT 서버(mlx-whisper) 시작"
    python3 tools/local_stt_server.py >/tmp/대화연습-stt.log 2>&1 &
    STT_PID=$!
  else
    echo "⚠️  python3 가 없어 로컬 STT 를 못 켭니다. .env.local 의 STT_PROVIDER 를 openai 로 바꾸세요."
  fi
fi

# 5) Next 개발 서버
echo "· 앱 서버 시작 (포트 $PORT)"
npx next dev -p "$PORT" >/tmp/대화연습-dev.log 2>&1 &
DEV_PID=$!

# 서버가 뜰 때까지 대기
echo -n "  기다리는 중"
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  echo -n "."; sleep 1
done
echo ""
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "❌ 앱 서버가 뜨지 않았습니다. 로그: /tmp/대화연습-dev.log"
  read -r _; exit 1
fi

# 6) cloudflared 터널
if ! command -v cloudflared >/dev/null 2>&1; then
  echo ""
  echo "❌ cloudflared 가 없습니다. 터널 없이 이 맥에서만 쓰려면:"
  echo "     http://localhost:$PORT  (이 맥 브라우저에서)"
  echo "   아이패드로 쓰려면 설치하세요:  brew install cloudflared"
  echo "   설치 후 이 창을 다시 실행하면 됩니다."
  read -r -p "엔터를 누르면 서버가 계속 뜬 상태로 둡니다 (Ctrl-C 로 종료)..." _
  wait "$DEV_PID"
  exit 0
fi

echo "· 터널 여는 중 (cloudflared)…"
cloudflared tunnel --url "http://localhost:$PORT" >"$CF_LOG" 2>&1 &
CF_PID=$!

# 터널 URL 추출
URL=""
for _ in $(seq 1 30); do
  URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$CF_LOG" | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done

echo ""
echo "======================================"
if [ -n "$URL" ]; then
  echo "  ✅ 아이패드 Safari 에서 이 주소로 접속:"
  echo ""
  echo "      $URL"
  echo ""
  echo "  (마이크 권한을 '허용' 하세요. HTTPS 라 음성이 됩니다.)"
else
  echo "  ⚠️ 터널 주소를 못 찾았습니다. 로그 확인: $CF_LOG"
fi
echo "======================================"
echo "  종료하려면 이 창에서 Ctrl-C"
echo ""

wait "$CF_PID"
