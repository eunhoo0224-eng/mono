#!/usr/bin/env python3
"""로컬 STT 서버 — mlx-whisper 를 HTTP 로 노출한다.

대화 연습 앱에서 STT_PROVIDER=local 로 두면 이 엔드포인트로 오디오를 보낸다
(명세 R-A: 의뢰인의 mlx-whisper 파이프라인 재사용 → API 비용 0, 최고 정확도).

계약: POST /transcribe  (multipart form, field 'file')  →  {"text": "..."}

준비 (맥):
    pip install flask mlx-whisper
    brew install ffmpeg        # 브라우저 녹음(webm/mp4) 디코딩에 필요

실행:
    python3 tools/local_stt_server.py
    # 기본 포트 8123 — 앱의 LOCAL_STT_URL 기본값과 일치

환경변수(선택):
    STT_PORT       기본 8123
    STT_MODEL      기본 mlx-community/whisper-large-v3-turbo
    STT_LANGUAGE   기본 ko
"""
import os
import tempfile

try:
    from flask import Flask, request, jsonify
except ImportError:
    raise SystemExit("flask 가 필요합니다:  pip install flask")

try:
    import mlx_whisper
except ImportError:
    raise SystemExit("mlx-whisper 가 필요합니다:  pip install mlx-whisper")

PORT = int(os.environ.get("STT_PORT", "8123"))
MODEL = os.environ.get("STT_MODEL", "mlx-community/whisper-large-v3-turbo")
LANGUAGE = os.environ.get("STT_LANGUAGE", "ko")

app = Flask(__name__)


@app.post("/transcribe")
def transcribe():
    f = request.files.get("file")
    if f is None:
        return jsonify({"error": "file 필드가 없습니다."}), 400

    # 업로드 확장자를 유지해 ffmpeg 가 포맷을 제대로 잡게 한다
    # (Chrome=webm/opus, iPad Safari=mp4).
    suffix = os.path.splitext(f.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        path = tmp.name
    try:
        result = mlx_whisper.transcribe(
            path,
            path_or_hf_repo=MODEL,
            language=LANGUAGE,
        )
        return jsonify({"text": (result.get("text") or "").strip()})
    except Exception as e:  # noqa: BLE001 — 클라이언트에 원인 전달
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": MODEL, "language": LANGUAGE})


if __name__ == "__main__":
    print(f"[local-stt] mlx-whisper 준비: model={MODEL} lang={LANGUAGE}")
    print(f"[local-stt] listening on http://127.0.0.1:{PORT}/transcribe")
    # 앱 서버(Next)가 같은 맥에서 서버사이드로 호출하므로 127.0.0.1 로 충분.
    app.run(host="127.0.0.1", port=PORT, threaded=True)
