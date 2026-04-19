"""
app.py — NoteFlow Multimodal Extension
========================================
Extends the original text-only pipeline with:
  POST /transcribe/audio  — upload audio → Whisper → NLP
  POST /transcribe/video  — upload video → ffmpeg → Whisper → NLP
  GET  /status/<job_id>   — poll async job progress
  POST /summarize         — original text endpoint (unchanged)
  POST /upload            — original .txt upload (unchanged)

Architecture:
  Audio/Video file → transcribe.py (Whisper) → _process() → JSON response
"""

import os
import uuid
import threading
from flask import Flask, request, jsonify, render_template

# ── existing pipeline modules ──────────────────────────────────────────────────
from preprocess  import preprocess_text
from summarizer  import generate_summary
from keywords    import extract_keywords
from clustering  import cluster_sentences

# ── new multimodal module ──────────────────────────────────────────────────────
from transcribe  import transcribe_audio, extract_audio_from_video

# ── config ────────────────────────────────────────────────────────────────────
UPLOAD_FOLDER   = os.path.join(os.path.dirname(__file__), "uploads")
MAX_CONTENT_MB  = 500          # hard cap for video uploads
ALLOWED_AUDIO   = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"}
ALLOWED_VIDEO   = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_MB * 1024 * 1024

# ── in-memory job store (swap for Redis/DB in production) ─────────────────────
# Structure: { job_id: { "status": "pending|processing|done|error",
#                         "step":   "...",
#                         "result": {...} | None,
#                         "error":  str | None } }
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _ext(filename: str) -> str:
    """Return lowercase file extension including the dot, e.g. '.mp4'"""
    return os.path.splitext(filename)[1].lower()


def _save_upload(file_storage) -> str:
    """Save an uploaded FileStorage object to UPLOAD_FOLDER; return its path."""
    safe_name = f"{uuid.uuid4().hex}{_ext(file_storage.filename)}"
    path = os.path.join(UPLOAD_FOLDER, safe_name)
    file_storage.save(path)
    return path


def _process(raw_text: str):
    """
    Core NLP pipeline — identical to the original app.
    Accepts raw transcript/text; returns dict ready for jsonify().
    """
    sentences, cleaned = preprocess_text(raw_text)
    if len(sentences) < 2:
        return {"error": "Transcript too short. Please provide longer content."}, 400

    keywords   = extract_keywords(cleaned, top_n=12)
    summary    = generate_summary(sentences, cleaned, top_n=6)
    topics     = cluster_sentences(sentences, cleaned, n_clusters=3)
    word_count = len(raw_text.split())

    return {
        "summary":    summary,
        "keywords":   keywords,
        "topics":     topics,
        "word_count": word_count,
    }, 200


def _set_job(job_id: str, **kwargs):
    with jobs_lock:
        jobs.setdefault(job_id, {}).update(kwargs)


# ══════════════════════════════════════════════════════════════════════════════
#  ASYNC WORKER  (runs in background thread)
# ══════════════════════════════════════════════════════════════════════════════

def _run_transcription_job(job_id: str, file_path: str, mode: str):
    """
    Background worker that:
      1. Extracts audio from video (if mode == "video")
      2. Runs Whisper transcription
      3. Feeds transcript into NLP pipeline
      4. Stores result in jobs dict
    """
    audio_path = None
    try:
        # ── Step 1: video → audio ────────────────────────────────────────────
        if mode == "video":
            _set_job(job_id, status="processing", step="Extracting audio from video…")
            audio_path = extract_audio_from_video(file_path)
        else:
            audio_path = file_path

        # ── Step 2: audio → transcript ───────────────────────────────────────
        _set_job(job_id, status="processing", step="Transcribing speech to text…")
        transcript = transcribe_audio(audio_path)

        if not transcript or not transcript.strip():
            _set_job(job_id, status="error", error="Transcription returned empty text.")
            return

        # ── Step 3: transcript → NLP ─────────────────────────────────────────
        _set_job(job_id, status="processing", step="Running NLP pipeline…")
        result, code = _process(transcript)

        if code != 200:
            _set_job(job_id, status="error", error=result.get("error", "NLP error"))
            return

        # Attach transcript to response so frontend can show it
        result["transcript"] = transcript
        _set_job(job_id, status="done", result=result, step="Complete")

    except Exception as exc:
        _set_job(job_id, status="error", error=str(exc))

    finally:
        # Clean up temp files
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        if audio_path and audio_path != file_path and os.path.exists(audio_path):
            os.remove(audio_path)


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html")


# ── Original text endpoints (unchanged) ───────────────────────────────────────

@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.get_json()
    if not data or not data.get("text", "").strip():
        return jsonify({"error": "No text provided."}), 400
    result, code = _process(data["text"].strip())
    return jsonify(result), code


@app.route("/upload", methods=["POST"])
def upload_text():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400
    f = request.files["file"]
    if not f.filename.endswith(".txt"):
        return jsonify({"error": "Only .txt files are supported."}), 400
    raw = f.read().decode("utf-8", errors="ignore").strip()
    if not raw:
        return jsonify({"error": "File is empty."}), 400
    result, code = _process(raw)
    return jsonify(result), code


# ── Audio upload endpoint ──────────────────────────────────────────────────────

@app.route("/transcribe/audio", methods=["POST"])
def transcribe_audio_endpoint():
    """
    POST /transcribe/audio
    Body: multipart/form-data  field: "file"
    Returns: { "job_id": "...", "status": "pending" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided."}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename."}), 400
    if _ext(f.filename) not in ALLOWED_AUDIO:
        return jsonify({"error": f"Unsupported audio format. Allowed: {', '.join(ALLOWED_AUDIO)}"}), 400

    file_path = _save_upload(f)
    job_id    = uuid.uuid4().hex

    _set_job(job_id, status="pending", step="Queued…", result=None, error=None)

    # Fire background thread — non-blocking for the HTTP response
    thread = threading.Thread(
        target=_run_transcription_job,
        args=(job_id, file_path, "audio"),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "status": "pending"}), 202


# ── Video upload endpoint ──────────────────────────────────────────────────────

@app.route("/transcribe/video", methods=["POST"])
def transcribe_video_endpoint():
    """
    POST /transcribe/video
    Body: multipart/form-data  field: "file"
    Returns: { "job_id": "...", "status": "pending" }
    """
    if "file" not in request.files:
        return jsonify({"error": "No video file provided."}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename."}), 400
    if _ext(f.filename) not in ALLOWED_VIDEO:
        return jsonify({"error": f"Unsupported video format. Allowed: {', '.join(ALLOWED_VIDEO)}"}), 400

    file_path = _save_upload(f)
    job_id    = uuid.uuid4().hex

    _set_job(job_id, status="pending", step="Queued…", result=None, error=None)

    thread = threading.Thread(
        target=_run_transcription_job,
        args=(job_id, file_path, "video"),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "status": "pending"}), 202


# ── Job status polling ─────────────────────────────────────────────────────────

@app.route("/status/<job_id>", methods=["GET"])
def job_status(job_id: str):
    """
    GET /status/<job_id>
    Returns current job state. Frontend polls this every 2 s.

    Possible responses:
      { "status": "pending",    "step": "Queued…" }
      { "status": "processing", "step": "Transcribing speech to text…" }
      { "status": "done",       "result": { summary, keywords, topics, transcript, word_count } }
      { "status": "error",      "error": "..." }
    """
    with jobs_lock:
        job = jobs.get(job_id)

    if not job:
        return jsonify({"error": "Job not found."}), 404

    return jsonify(job), 200


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n✅ NoteFlow Multimodal running → http://127.0.0.1:5000\n")
    # threaded=True is required for background job threads to work correctly
    app.run(debug=True, port=5000, threaded=True)