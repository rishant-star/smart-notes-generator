/**
 * script.js — Smart Lecture Notes Generator
 * ==========================================
 * Handles:
 *   - Word count live update
 *   - .txt file drag-and-drop upload
 *   - Text → /summarize → display results
 *   - Audio → Web Speech API → textarea → /summarize → display results
 *   - Loading states, error handling, result rendering
 *
 * Audio pipeline (same NLP backend, zero extra routes):
 *   🎙  User speaks
 *   ↓   SpeechRecognition converts to text (browser, no API key)
 *   ↓   Transcript fills #lectureText textarea
 *   ↓   Preview panel shows transcript + "Edit / Use" prompt
 *   ↓   handleGenerate() runs — same path as typing text manually
 *   ↓   POST /summarize → { summary, keywords, topics }
 *   ↓   renderResults() displays output
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────────────────────────────── */
const lectureText   = document.getElementById('lectureText');
const wordCountEl   = document.getElementById('wordCount');
const fileInput     = document.getElementById('fileInput');
const browseBtn     = document.getElementById('browseBtn');
const uploadZone    = document.getElementById('uploadZone');
const fileNameDisp  = document.getElementById('fileNameDisplay');
const generateBtn   = document.getElementById('generateBtn');
const clearBtn      = document.getElementById('clearBtn');
const errorBanner   = document.getElementById('errorBanner');
const loadingState  = document.getElementById('loadingState');
const resultsPanel  = document.getElementById('resultsPanel');

// Audio recording DOM (added via HTML snippet below)
const micBtn        = document.getElementById('micBtn');
const micStatus     = document.getElementById('micStatus');
const micDot        = document.getElementById('micDot');
const previewPanel  = document.getElementById('transcriptPreview');
const previewText   = document.getElementById('previewText');
const useTextBtn    = document.getElementById('useTranscriptBtn');
const editTextBtn   = document.getElementById('editTranscriptBtn');
const discardBtn    = document.getElementById('discardTranscriptBtn');

// Step indicators inside loading state
const steps = [1, 2, 3, 4].map(n => document.getElementById('step' + n));

/* ─────────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────────── */
let uploadedFile     = null;   // holds a File object when user uploads .txt
let stepTimer        = null;   // interval for loading step animation
let isRecording      = false;  // whether mic is currently active
let recognition      = null;   // SpeechRecognition instance (created once)
let interimBuffer    = '';     // interim (in-progress) speech text

/* ─────────────────────────────────────────────────────────────────
   WORD COUNTER
───────────────────────────────────────────────────────────────── */
lectureText.addEventListener('input', () => {
  const words = lectureText.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = words;

  // Clear uploaded-file selection if user starts typing
  if (lectureText.value.trim()) {
    uploadedFile = null;
    fileNameDisp.textContent = 'No file selected';
  }
});

/* ─────────────────────────────────────────────────────────────────
   FILE UPLOAD  (.txt drag-and-drop / browse)
───────────────────────────────────────────────────────────────── */
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
uploadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (!file.name.endsWith('.txt')) { showError('Only .txt files are supported.'); return; }
  uploadedFile = file;
  fileNameDisp.textContent = '📄 ' + file.name;
  lectureText.value = '';
  wordCountEl.textContent = '0';
});

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file || !file.name.endsWith('.txt')) { showError('Please drop a .txt file.'); return; }
  uploadedFile = file;
  fileNameDisp.textContent = '📄 ' + file.name;
  lectureText.value = '';
  wordCountEl.textContent = '0';
});

/* ─────────────────────────────────────────────────────────────────
   CLEAR BUTTON
───────────────────────────────────────────────────────────────── */
clearBtn.addEventListener('click', () => {
  lectureText.value = '';
  wordCountEl.textContent = '0';
  uploadedFile = null;
  fileInput.value = '';
  fileNameDisp.textContent = 'No file selected';
  hideError();
  hidePreview();
  resultsPanel.classList.add('hidden');
});

/* ─────────────────────────────────────────────────────────────────
   GENERATE BUTTON  (text / file path — unchanged logic)
───────────────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', handleGenerate);

/**
 * Main generation handler.
 * Called by: Generate button click, "Use this text" after recording.
 * Reads from lectureText.value OR uploadedFile — same as always.
 */
async function handleGenerate() {
  hideError();
  hidePreview();

  const text = lectureText.value.trim();

  if (!text && !uploadedFile) {
    showError('Please enter lecture text, upload a .txt file, or record your voice.');
    return;
  }

  showLoading();

  try {
    const data = uploadedFile
      ? await uploadFile(uploadedFile)
      : await summarizeText(text);

    if (data.error) {
      showError(data.error);
      return;
    }

    renderResults(data);

  } catch (err) {
    showError('Network error — is the Flask server running on port 5000?');
  } finally {
    hideLoading();
  }
}

/* ─────────────────────────────────────────────────────────────────
   API CALLS
───────────────────────────────────────────────────────────────── */

/**
 * POST /summarize
 * Sends plain text as JSON. Backend returns { summary, keywords, topics }.
 */
async function summarizeText(text) {
  const response = await fetch('/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return response.json();
}

/**
 * POST /upload
 * Sends a .txt file as multipart/form-data.
 */
async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const response = await fetch('/upload', { method: 'POST', body: fd });
  return response.json();
}

/* ─────────────────────────────────────────────────────────────────
   ████████████████████████████████████████████████████████████
   AUDIO RECORDING PIPELINE  — Web Speech API
   ████████████████████████████████████████████████████████████

   Flow:
     1. User clicks 🎙 "Start Recording"
     2. SpeechRecognition listens continuously
     3. Interim results shown live in micStatus (feedback)
     4. On final result: transcript accumulated
     5. On recording stop: transcript shown in preview panel
     6. User can: "Use this text" (→ fills textarea → generateNotes())
                  "Edit first"   (→ fills textarea for manual editing)
                  "Discard"      (→ cancels, clears everything)
───────────────────────────────────────────────────────────────── */

/**
 * Check if Web Speech API is available in this browser.
 * Supported: Chrome, Edge (desktop + Android).
 * Not supported: Firefox, Safari (partial), older browsers.
 */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  // Graceful fallback: hide mic button, show a message instead
  if (micBtn) {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
  }
  if (micStatus) {
    micStatus.textContent = '⚠ Speech recognition requires Chrome or Edge.';
    micStatus.style.color = 'var(--amber, #f59e0b)';
  }
  console.warn('[NoteFlow] Web Speech API not available. Use Chrome or Edge for voice input.');
}

/* ── Initialise recognition instance ── */
if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  // continuous: keep listening even after a pause (don't stop after first phrase)
  recognition.continuous = true;

  // interimResults: fire events as words are being spoken (live feedback)
  recognition.interimResults = true;

  // Language: auto-detect from browser locale, or hard-code e.g. 'en-US'
  recognition.lang = navigator.language || 'en-US';

  // Maximum silence (ms) before recognition auto-stops (browser-controlled)
  // We handle this via recognition.stop() on second button click

  /* ── onresult: fired every time speech is detected ── */
  recognition.onresult = function (event) {
    let interimText = '';   // words still being spoken
    let finalText   = '';   // confirmed, committed words

    // Loop through all result chunks since recording started
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        // Committed speech — append to the permanent buffer
        finalText += transcript + ' ';
      } else {
        // Still being spoken — show as preview only
        interimText += transcript;
      }
    }

    // Accumulate final text across multiple sentences
    if (finalText) {
      interimBuffer += finalText;
    }

    // Live display: permanent text + grayed-out interim text
    setMicStatus(
      '🎙 ' + (interimBuffer + interimText || 'Listening…'),
      'recording'
    );
  };

  /* ── onend: fires when recognition stops (button click or timeout) ── */
  recognition.onend = function () {
    isRecording = false;
    resetMicButton();

    const transcript = interimBuffer.trim();

    if (!transcript) {
      setMicStatus('No speech detected. Try again.', 'error');
      return;
    }

    // Success: show the preview panel with the captured text
    showPreview(transcript);
    setMicStatus('✓ Recording complete.', 'success');
    interimBuffer = '';
  };

  /* ── onerror: handles specific failure reasons ── */
  recognition.onerror = function (event) {
    isRecording = false;
    resetMicButton();
    interimBuffer = '';

    const errorMessages = {
      'not-allowed':      '🔒 Microphone access denied. Click the 🔒 icon in your browser address bar and allow microphone access.',
      'no-speech':        '🔇 No speech was detected. Please speak clearly and try again.',
      'network':          '🌐 Network error during speech recognition. Check your internet connection.',
      'audio-capture':    '🎤 No microphone found. Please connect a microphone and try again.',
      'service-not-allowed': '🔒 Speech service blocked. Please allow microphone access in browser settings.',
      'aborted':          '⏹ Recording was stopped.',
    };

    const msg = errorMessages[event.error] || `Speech error: ${event.error}`;
    setMicStatus(msg, 'error');
    showError(msg);
    console.error('[NoteFlow] SpeechRecognition error:', event.error);
  };

  /* ── onsoundstart / onsoundend: extra feedback ── */
  recognition.onsoundstart = function () {
    setMicStatus('🎙 Sound detected — keep speaking…', 'recording');
  };

  recognition.onnomatch = function () {
    setMicStatus('Could not match speech. Please speak more clearly.', 'error');
  };
}

/* ── MIC BUTTON click handler ── */
if (micBtn) {
  micBtn.addEventListener('click', toggleRecording);
}

/**
 * Toggle recording on / off when mic button is clicked.
 */
function toggleRecording() {
  if (!SpeechRecognition) return; // already handled above

  if (isRecording) {
    // Second click: stop recording
    recognition.stop();
    // onend will fire and handle the rest
  } else {
    // First click: start recording
    startRecording();
  }
}

/**
 * Start the Web Speech API recording session.
 */
function startRecording() {
  hideError();
  hidePreview();
  interimBuffer = '';

  // Visual: switch button to "Stop" state
  isRecording = true;
  micBtn.classList.add('recording');
  micBtn.querySelector('.mic-btn-text').textContent = 'Stop Recording';
  micDot.classList.add('blinking');
  setMicStatus('🎙 Listening… speak your lecture notes clearly.', 'recording');

  // Disable the Generate button while recording to prevent confusion
  generateBtn.disabled = true;

  try {
    recognition.start();
  } catch (err) {
    // recognition.start() throws if called while already running
    isRecording = false;
    resetMicButton();
    showError('Could not start microphone. Please try again.');
    console.error('[NoteFlow] recognition.start() error:', err);
  }
}

/**
 * Reset the mic button back to its default (not-recording) state.
 */
function resetMicButton() {
  micBtn.classList.remove('recording');
  micBtn.querySelector('.mic-btn-text').textContent = 'Start Recording';
  micDot.classList.remove('blinking');
  generateBtn.disabled = false;
}

/* ─────────────────────────────────────────────────────────────────
   TRANSCRIPT PREVIEW PANEL
   Shown after recording completes — lets user review before sending
───────────────────────────────────────────────────────────────── */

/**
 * Display the preview panel with the transcribed text.
 * @param {string} transcript - The text captured by SpeechRecognition
 */
function showPreview(transcript) {
  previewText.value = transcript;
  previewPanel.classList.remove('hidden');

  // Scroll to preview so user can see it
  previewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide the preview panel.
 */
function hidePreview() {
  if (previewPanel) previewPanel.classList.add('hidden');
  if (previewText) previewText.value = '';
}

/* ── "Use this text" button ── fills textarea, runs pipeline immediately */
if (useTextBtn) {
  useTextBtn.addEventListener('click', () => {
    const text = previewText.value.trim();
    if (!text) return;

    lectureText.value = text;
    updateWordCount();
    uploadedFile = null;

    // Trigger the exact same flow as clicking "Generate Notes"
    handleGenerate();
  });
}

/* ── "Edit first" button ── fills textarea for manual editing */
if (editTextBtn) {
  editTextBtn.addEventListener('click', () => {
    const text = previewText.value.trim();
    lectureText.value = text;
    updateWordCount();
    uploadedFile = null;
    hidePreview();

    // Focus + scroll to textarea for editing
    lectureText.focus();
    lectureText.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMicStatus('✏ Text loaded into editor. Edit and click "Generate Notes".', 'success');
  });
}

/* ── "Discard" button ── cancel everything */
if (discardBtn) {
  discardBtn.addEventListener('click', () => {
    hidePreview();
    interimBuffer = '';
    setMicStatus('', 'idle');
  });
}

/* ─────────────────────────────────────────────────────────────────
   MIC STATUS HELPERS
───────────────────────────────────────────────────────────────── */

/**
 * Update the status text below the mic button.
 * @param {string} message - Display text
 * @param {'idle'|'recording'|'success'|'error'} state
 */
function setMicStatus(message, state = 'idle') {
  if (!micStatus) return;
  micStatus.textContent = message;
  micStatus.className = 'mic-status mic-status--' + state;
}

/* ─────────────────────────────────────────────────────────────────
   WORD COUNT HELPER (called after programmatic textarea fill)
───────────────────────────────────────────────────────────────── */
function updateWordCount() {
  const words = lectureText.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = words;
}

/* ─────────────────────────────────────────────────────────────────
   LOADING STATE ANIMATION
───────────────────────────────────────────────────────────────── */
function showLoading() {
  resultsPanel.classList.add('hidden');
  loadingState.classList.remove('hidden');
  generateBtn.disabled = true;

  const btnText = generateBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Processing…';

  // Animate step indicators sequentially
  steps.forEach(s => s.classList.remove('active'));
  let cur = 0;
  if (steps[0]) steps[0].classList.add('active');

  stepTimer = setInterval(() => {
    if (cur < steps.length - 1) {
      steps[++cur].classList.add('active');
    } else {
      clearInterval(stepTimer);
    }
  }, 600);
}

function hideLoading() {
  clearInterval(stepTimer);
  loadingState.classList.add('hidden');
  generateBtn.disabled = false;

  const btnText = generateBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Generate Notes';

  steps.forEach(s => s.classList.remove('active'));
}

/* ─────────────────────────────────────────────────────────────────
   RENDER RESULTS
───────────────────────────────────────────────────────────────── */
function renderResults({ summary, keywords, topics, word_count }) {
  // Stats bar
  const statWords = document.getElementById('statWords');
  const statSummary = document.getElementById('statSummary');
  const statKeywords = document.getElementById('statKeywords');
  const statTopics = document.getElementById('statTopics');

  if (statWords)    statWords.textContent    = word_count || '—';
  if (statSummary)  statSummary.textContent  = summary.length;
  if (statKeywords) statKeywords.textContent = keywords.length;
  if (statTopics)   statTopics.textContent   = topics.length;

  // ── Keywords ──────────────────────────────────────────────────
  const cloud = document.getElementById('keywordsCloud');
  if (cloud) {
    cloud.innerHTML = '';
    keywords.forEach((kw, i) => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = kw;
      tag.style.animationDelay = (i * 0.04) + 's';
      cloud.appendChild(tag);
    });
  }

  // ── Summary ───────────────────────────────────────────────────
  const list = document.getElementById('summaryList');
  if (list) {
    list.innerHTML = '';
    summary.forEach((sentence, i) => {
      const li     = document.createElement('li');
      li.className = 'summary-item';

      const bullet = document.createElement('span');
      bullet.className = 'summary-bullet';
      bullet.textContent = i + 1;

      const txt = document.createElement('span');
      txt.innerHTML = highlight(sentence, keywords);

      li.appendChild(bullet);
      li.appendChild(txt);
      list.appendChild(li);
    });
  }

  // ── Topics ────────────────────────────────────────────────────
  const tc = document.getElementById('topicsContainer');
  if (tc) {
    tc.innerHTML = '';
    topics.forEach(topic => {
      const group   = document.createElement('div');
      group.className = 'topic-group';

      const heading = document.createElement('div');
      heading.className = 'topic-heading';
      heading.textContent = topic.topic;
      group.appendChild(heading);

      const sents   = document.createElement('div');
      sents.className = 'topic-sentences';

      topic.sentences.forEach(s => {
        const d = document.createElement('div');
        d.className = 'topic-sentence';
        d.innerHTML = highlight(s, keywords);
        sents.appendChild(d);
      });

      group.appendChild(sents);
      tc.appendChild(group);
    });
  }

  // Show results and scroll
  resultsPanel.classList.remove('hidden');
  setTimeout(() => {
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/* ─────────────────────────────────────────────────────────────────
   KEYWORD HIGHLIGHTING
───────────────────────────────────────────────────────────────── */
function highlight(sentence, keywords) {
  let result = escHtml(sentence);
  // Sort longest first to avoid partial-word replacements
  [...keywords].sort((a, b) => b.length - a.length).forEach(kw => {
    const pattern = new RegExp('\\b(' + escRx(kw) + ')\\b', 'gi');
    result = result.replace(pattern, '<mark class="kw-highlight">$1</mark>');
  });
  return result;
}

function escHtml(t) {
  return t.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
}

function escRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ─────────────────────────────────────────────────────────────────
   ERROR BANNER
───────────────────────────────────────────────────────────────── */
function showError(msg) {
  if (!errorBanner) return;
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
}
function hideError() {
  if (!errorBanner) return;
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';
}