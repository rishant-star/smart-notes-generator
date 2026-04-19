"""
transcribe.py — Speech-to-Text & Audio Extraction
===================================================
Handles two jobs:
  1. extract_audio_from_video(video_path) → wav_path
     Uses ffmpeg (subprocess) to rip audio from any video container.

  2. transcribe_audio(audio_path) → transcript_str
     Uses OpenAI Whisper (local, no API key) to convert audio → text.

Why Whisper?
  ✔ Fully offline / open-source
  ✔ Multilingual (99 languages)
  ✔ No API key required
  ✔ "base" model runs on CPU in ~1–2 min for a 1-hour lecture
  ✔ "large" model adds ~5-10% accuracy, needs GPU

Model size guide (choose via WHISPER_MODEL env var):
  tiny   → fastest, ~32 MB,  good for quick tests
  base   → recommended default, ~74 MB
  small  → better accuracy, ~244 MB
  medium → high accuracy, ~769 MB (GPU recommended)
  large  → best accuracy, ~1550 MB (GPU required for speed)
"""

import os
import subprocess
import tempfile
import logging

logger = logging.getLogger(__name__)

# ── Whisper model size — override with env var ─────────────────────────────────
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")

# ── Lazy-load Whisper model (singleton — loads once per process) ───────────────
_whisper_model = None


def _get_model():
    """
    Load Whisper model once and cache it.
    First call takes ~10–30 s depending on model size and disk speed.
    Subsequent calls return the cached model instantly.
    """
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper  # openai-whisper package
            logger.info(f"Loading Whisper '{WHISPER_MODEL_SIZE}' model…")
            _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
            logger.info("Whisper model loaded ✓")
        except ImportError:
            raise RuntimeError(
                "openai-whisper is not installed. "
                "Run: pip install openai-whisper"
            )
    return _whisper_model


# ══════════════════════════════════════════════════════════════════════════════
#  AUDIO EXTRACTION  (Video → WAV)
# ══════════════════════════════════════════════════════════════════════════════

def extract_audio_from_video(video_path: str) -> str:
    """
    Extract audio track from a video file using ffmpeg.

    Args:
        video_path: Absolute path to the video file (.mp4, .mov, .mkv, etc.)

    Returns:
        Path to a temporary WAV file (16 kHz mono, as Whisper expects).
        Caller is responsible for deleting this file after use.

    Raises:
        RuntimeError: If ffmpeg is not installed or extraction fails.

    ffmpeg flags explained:
        -i           : input file
        -vn          : disable video stream (audio only)
        -acodec pcm_s16le : uncompressed 16-bit PCM (WAV)
        -ar 16000    : 16 kHz sample rate (Whisper's native rate)
        -ac 1        : mono channel (reduces file size 50%, Whisper handles mono fine)
        -y           : overwrite output without asking
    """
    _check_ffmpeg()

    # Create temp file with .wav extension
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)  # close the fd; ffmpeg will write the file

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        wav_path,
    ]

    logger.info(f"Extracting audio: {video_path} → {wav_path}")

    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=600,  # 10-minute timeout for very large files
    )

    if result.returncode != 0:
        error_msg = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg failed:\n{error_msg}")

    if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
        raise RuntimeError("ffmpeg produced an empty or missing WAV file.")

    logger.info(f"Audio extracted: {os.path.getsize(wav_path) / 1024:.1f} KB")
    return wav_path


def _check_ffmpeg():
    """Raise a clear error if ffmpeg is not on PATH."""
    result = subprocess.run(
        ["ffmpeg", "-version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "ffmpeg is not installed or not found on PATH.\n"
            "Windows: https://ffmpeg.org/download.html\n"
            "Mac:     brew install ffmpeg\n"
            "Linux:   sudo apt install ffmpeg"
        )


# ══════════════════════════════════════════════════════════════════════════════
#  TRANSCRIPTION  (Audio → Text)
# ══════════════════════════════════════════════════════════════════════════════

def transcribe_audio(audio_path: str, language: str = None) -> str:
    """
    Transcribe an audio file to text using OpenAI Whisper (local).

    Args:
        audio_path: Path to audio file (.wav, .mp3, .m4a, etc.)
        language:   Optional ISO 639-1 language code (e.g. "en", "hi", "fr").
                    If None, Whisper auto-detects language.

    Returns:
        Full transcript as a single string.

    Performance notes:
        - "base" model: ~1 hour lecture ≈ 90 seconds on modern CPU
        - "large" model: ~1 hour lecture ≈ 15 seconds on RTX 3080
        - For CPU-only, use "base" or "small"
        - For GPU, set WHISPER_MODEL=large in environment
    """
    model = _get_model()

    logger.info(f"Transcribing: {audio_path}")

    transcribe_kwargs = {
        "verbose": False,        # suppress per-segment stdout
        "fp16":    False,        # disable FP16 on CPU (GPU sets this automatically)
        "task":    "transcribe", # "transcribe" keeps original lang; "translate" → English
    }
    if language:
        transcribe_kwargs["language"] = language

    result = model.transcribe(audio_path, **transcribe_kwargs)

    transcript = result.get("text", "").strip()
    detected   = result.get("language", "unknown")

    logger.info(
        f"Transcription complete — {len(transcript.split())} words, "
        f"language detected: {detected}"
    )

    return transcript


# ══════════════════════════════════════════════════════════════════════════════
#  OPTIONAL: CHUNKED TRANSCRIPTION  (for very large files)
# ══════════════════════════════════════════════════════════════════════════════

def transcribe_audio_chunked(audio_path: str, chunk_minutes: int = 10) -> str:
    """
    For files longer than ~60 minutes, split into chunks to avoid
    memory exhaustion. Uses ffmpeg to slice, then stitches transcripts.

    Args:
        audio_path:    Path to audio file
        chunk_minutes: Length of each chunk in minutes (default: 10)

    Returns:
        Full stitched transcript string.
    """
    import math

    # Get duration via ffprobe
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    duration_s = float(probe.stdout.decode().strip())
    chunk_s    = chunk_minutes * 60
    n_chunks   = math.ceil(duration_s / chunk_s)

    if n_chunks == 1:
        # Short enough — use standard transcription
        return transcribe_audio(audio_path)

    logger.info(f"Splitting {duration_s:.0f}s audio into {n_chunks} chunks of {chunk_minutes} min each")

    transcripts = []
    temp_files  = []

    try:
        for i in range(n_chunks):
            start = i * chunk_s
            fd, chunk_path = tempfile.mkstemp(suffix=f"_chunk{i}.wav")
            os.close(fd)
            temp_files.append(chunk_path)

            # Slice chunk with ffmpeg
            subprocess.run([
                "ffmpeg", "-y",
                "-i", audio_path,
                "-ss", str(start),
                "-t",  str(chunk_s),
                "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                chunk_path,
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            chunk_text = transcribe_audio(chunk_path)
            transcripts.append(chunk_text)
            logger.info(f"  Chunk {i+1}/{n_chunks} ✓ ({len(chunk_text.split())} words)")

    finally:
        for p in temp_files:
            if os.path.exists(p):
                os.remove(p)

    return " ".join(transcripts)