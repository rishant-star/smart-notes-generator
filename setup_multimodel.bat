@echo off
echo.
echo ============================================================
echo   NoteFlow Multimodal Setup — Windows
echo ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found. Install from https://python.org
  pause & exit /b 1
)

echo [1/5] Creating virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo [2/5] Upgrading pip...
python -m pip install --upgrade pip --quiet

echo [3/5] Installing Python dependencies...
pip install flask nltk scikit-learn numpy openai-whisper torch tqdm soundfile ffmpeg-python

echo [4/5] Downloading NLTK data...
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords')"

echo [5/5] Checking ffmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
  echo.
  echo [WARNING] ffmpeg not found on PATH.
  echo   Video processing requires ffmpeg.
  echo   Download: https://ffmpeg.org/download.html
  echo   Add ffmpeg/bin to your system PATH after installing.
  echo.
) else (
  echo   ffmpeg found ^✓
)

echo.
echo ============================================================
echo   Setup complete!
echo   Run start_multimodal.bat to launch the server.
echo ============================================================
echo.
pause