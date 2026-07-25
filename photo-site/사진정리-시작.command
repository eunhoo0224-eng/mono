#!/bin/bash
# ────────────────────────────────────────────────
#  사진 정리(Organizer) 실행 파일
#  Finder에서 이 파일을 "더블클릭" 하면 도구가 켜집니다.
#  (터미널에 직접 명령을 칠 필요가 없어요.)
# ────────────────────────────────────────────────
cd "$(dirname "$0")" || exit 1

echo "======================================="
echo "   사진 정리 도구를 준비합니다"
echo "======================================="
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "⚠ Node.js가 설치돼 있지 않아요."
  echo "  nodejs.org 에서 'LTS' 버전을 설치한 뒤,"
  echo "  이 파일을 다시 더블클릭하세요."
  echo
  read -n1 -p "아무 키나 누르면 창이 닫힙니다..."
  exit 1
fi

echo "부품 설치 중... (처음 한 번만, 1~3분 걸려요. 글자가 지나가는 건 정상)"
echo
npm install || {
  echo
  echo "⚠ 설치 중 문제가 생겼어요. 이 화면을 캡처해서 보내주세요."
  read -n1 -p "아무 키나 누르면 닫힙니다..."
  exit 1
}

echo
echo "✅ 준비 완료! 도구를 켭니다."
echo "   잠시 후 브라우저가 자동으로 열려요 (localhost:4323)."
echo "   ※ 이 검은 창은 도구가 켜져 있는 동안 닫지 마세요."
echo "     (끝내려면 이 창을 닫거나 Control+C)"
echo

( sleep 3 && open "http://localhost:4323" ) &
npm run organize
