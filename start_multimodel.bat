@echo off
echo.
echo ============================================================
echo   NoteFlow Multimodal — Starting server
echo ============================================================
echo.
call venv\Scripts\activate.bat
echo Open your browser at: http://127.0.0.1:5000
echo.
echo Modes available:
echo   Text  : paste text or upload .txt
echo   Audio : upload .mp3/.wav/.m4a or record live
echo   Video : upload .mp4/.mov/.avi/.mkv
echo.
echo Press CTRL+C to stop.
echo.
set WHISPER_MODEL=base
python app.py
pause