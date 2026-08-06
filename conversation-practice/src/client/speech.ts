// 브라우저 내장 음성 폴백 — 서버 TTS/STT 가 없을 때만.
// ⚠️ SpeechSynthesis 음성은 스피커로만 나가므로 녹음 파일에는 담기지 않는다.
//    (F1 완전 충족은 서버 TTS 경로에서만. README 참조.)

export function browserTtsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakFallback(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!browserTtsAvailable()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    const voices = window.speechSynthesis.getVoices();
    const ko = voices.find((v) => v.lang?.startsWith('ko'));
    if (ko) u.voice = ko;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Web Speech STT 한 발화 인식 (STT_PROVIDER=none 시). Chrome 계열만. Safari ✕.
type SR = any;
export function browserSttAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
}
