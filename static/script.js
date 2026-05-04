/**
 * script.js — Smart Lecture Notes Generator v2
 * ============================================
 * Fully functional UI with option selection and backend integration
 * 
 * Features:
 * - Tab switching (Text / Audio / Video)
 * - Format selection: Bullets, Paragraphs, Study
 * - Detail level: Short, Balanced, Detailed
 * - Study kit toggle
 * - File upload with drag-and-drop
 * - Full backend integration
 * - Back button functionality
 */

'use strict';

/* ───────────────────────────────────────────────────────────────
   STATE MANAGEMENT
─────────────────────────────────────────────────────────────── */
let appState = {
  // User selections
  selectedFormat: 'bullets',      // bullets | paragraphs | study
  selectedDetail: 'balanced',     // short | balanced | detailed
  selectedInclude: 'on',          // on (study kit) | off (notes only)
  
  // Current mode
  activeMode: 'text',             // text | audio | video
  
  // Uploaded content
  uploadedFile: null,             // File object if uploaded
  inputText: '',                  // Raw text from textarea
  
  // Processing
  isProcessing: false,
};

/* ───────────────────────────────────────────────────────────────
   DOM ELEMENTS
─────────────────────────────────────────────────────────────── */
// Pages
const pageInput = document.getElementById('pageInput');
const pageProcessing = document.getElementById('pageProcessing');
const pageOutput = document.getElementById('pageOutput');

// Navbar
const navBack = document.getElementById('navBack');
const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');

// Tabs
const modeTabs = document.querySelectorAll('.tab');

// Tab panels
const tabPanels = document.querySelectorAll('.tab-panel');

// Textareas
const taText = document.getElementById('taText');
const wcText = document.getElementById('wcText');

// File drops & uploads
const txtDrop = document.getElementById('txtDrop');
const txtFile = document.getElementById('txtFile');
const audioDrop = document.getElementById('audioDrop');
const audioFile = document.getElementById('audioFile');
const videoDrop = document.getElementById('videoDrop');
const videoFile = document.getElementById('videoFile');

// Buttons
const genBtn = document.getElementById('genBtn');
const genTxt = document.getElementById('genTxt');
const errBox = document.getElementById('errBox');

// Options panel
const optionNote = document.getElementById('optionNote');
const phState = document.getElementById('phState');

// Processing page
const procTitle = document.getElementById('procTitle');
const procStep = document.getElementById('procStep');
const procFill = document.getElementById('procFill');
const procDots = document.querySelectorAll('.pd');

// Output page
const btnDownload = document.getElementById('btnDownload');
const btnCopy = document.getElementById('btnCopy');
const sidebarCards = document.querySelectorAll('.sidebar-card');
const outputSections = document.querySelectorAll('.output-section');
const summaryContent = document.getElementById('summaryContent');
const keywordsContent = document.getElementById('keywordsContent');
const topicsContent = document.getElementById('topicsContent');
const transcriptBox = document.getElementById('transcriptBox');



/* ───────────────────────────────────────────────────────────────
   INITIALIZATION
─────────────────────────────────────────────────────────────── */
function initApp() {
  // Tab switching
  modeTabs.forEach(tab => {
    tab.addEventListener('click', switchTab);
  });

  // Textarea input tracking
  taText.addEventListener('input', updateWordCount);

  // Option selection - Format
  document.querySelectorAll('input[name="noteFormat"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.selectedFormat = e.target.value;
      updateOptionNote();
    });
  });

  // Option selection - Detail
  document.querySelectorAll('input[name="noteDetail"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.selectedDetail = e.target.value;
      updateOptionNote();
    });
  });

  // Option selection - Study Kit
  document.querySelectorAll('input[name="studyMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.selectedInclude = e.target.value;
      updateOptionNote();
    });
  });

  // File upload - Text
  setupFileUpload(txtFile, txtDrop, 'text');
  
  // File upload - Audio
  setupFileUpload(audioFile, audioDrop, 'audio');
  
  // File upload - Video
  setupFileUpload(videoFile, videoDrop, 'video');

  // Generate button
  genBtn.addEventListener('click', handleGenerate);

  // Back button
  navBack.addEventListener('click', goBack);

  // Theme toggle
  themeBtn.addEventListener('click', toggleTheme);

  // Output actions
  btnDownload.addEventListener('click', downloadNotes);
  btnCopy.addEventListener('click', copyNotes);

  // Sidebar navigation
  sidebarCards.forEach(card => {
    card.addEventListener('click', showSection);
  });

  // Set initial UI state
  updateOptionNote();
}

/* ───────────────────────────────────────────────────────────────
   TAB SWITCHING
─────────────────────────────────────────────────────────────── */
function switchTab(e) {
  const mode = e.target.getAttribute('data-tab');
  
  // Update active tab
  modeTabs.forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  e.target.setAttribute('aria-selected', 'true');
  
  // Update active panel
  tabPanels.forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${mode}`).classList.add('active');
  
  // Update state
  appState.activeMode = mode;
  
  // Clear previous input
  taText.value = '';
  appState.inputText = '';
  appState.uploadedFile = null;
  updateWordCount();
  clearError();
}

/* ───────────────────────────────────────────────────────────────
   FILE UPLOAD SETUP
─────────────────────────────────────────────────────────────── */
function setupFileUpload(fileInput, dropZone, type) {
  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());
  
  // File selection
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFileUpload(file, type);
  });
  
  // Drag over
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('over');
  });
  
  // Drop
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file, type);
  });
}

function handleFileUpload(file, type) {
  // Store file
  appState.uploadedFile = file;
  appState.inputText = '';
  
  // Mark dropzone as having file
  const dropZone = type === 'text' ? txtDrop : (type === 'audio' ? audioDrop : videoDrop);
  dropZone.classList.add('has-file');
  
  // Show file meta
  const metaEl = dropZone.nextElementSibling;
  if (metaEl && metaEl.classList.contains('file-meta')) {
    metaEl.classList.remove('hidden');
    metaEl.innerHTML = `📁 ${file.name} — ${(file.size / 1024).toFixed(1)} KB`;
  }
  
  // Clear textarea
  taText.value = '';
  updateWordCount();
  
  clearError();
}

/* ───────────────────────────────────────────────────────────────
   WORD COUNT UPDATE
─────────────────────────────────────────────────────────────── */
function updateWordCount() {
  const text = taText.value.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  appState.inputText = text;
  wcText.textContent = `${words} words`;
}

/* ───────────────────────────────────────────────────────────────
   UPDATE OPTION NOTE
─────────────────────────────────────────────────────────────── */
function updateOptionNote() {
  let note = 'Output will include ';
  
  const formatLabels = {
    'bullets': 'bullet points',
    'paragraphs': 'paragraph text',
    'study': 'structured study format'
  };
  
  const detailLabels = {
    'short': 'a short summary',
    'balanced': 'balanced coverage',
    'detailed': 'comprehensive coverage'
  };
  
  note += `${formatLabels[appState.selectedFormat]}, ${detailLabels[appState.selectedDetail]}.`;
  
  if (appState.selectedInclude === 'on') {
    note += ' Includes keywords, topics, and study cards.';
  } else {
    note += ' Notes only.';
  }
  
  optionNote.textContent = note;
}

/* ───────────────────────────────────────────────────────────────
   GENERATE NOTES
─────────────────────────────────────────────────────────────── */
async function handleGenerate() {
  clearError();
  
  // Validate input
  if (!appState.inputText && !appState.uploadedFile) {
    showError('Please enter text, upload a file, or record audio.');
    return;
  }
  
  // Prevent double-submit
  if (appState.isProcessing) return;
  
  appState.isProcessing = true;
  genBtn.disabled = true;
  genTxt.textContent = 'Processing…';
  
  showProcessing();
  
  try {
    let data;
    
    if (appState.uploadedFile) {
      // File upload
      data = await uploadFile(appState.uploadedFile, appState.activeMode);
    } else {
      // Text input
      data = await summarizeText(appState.inputText);
    }
    
    if (data.error) {
      showError(data.error);
      hideProcessing();
    } else {
      // Show output after a brief delay
      setTimeout(() => {
        hideProcessing();
        renderOutput(data);
        showPage('output');
      }, 1500);
    }
    
  } catch (err) {
    console.error('Error:', err);
    showError('Network error. Is the Flask server running on port 5000?');
    hideProcessing();
  } finally {
    appState.isProcessing = false;
    genBtn.disabled = false;
    genTxt.textContent = 'Generate Notes';
  }
}

/* ───────────────────────────────────────────────────────────────
   API CALLS
─────────────────────────────────────────────────────────────── */
async function summarizeText(text) {
  const response = await fetch('/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      format: appState.selectedFormat,
      detail: appState.selectedDetail,
      include: appState.selectedInclude
    })
  });
  return response.json();
}

async function uploadFile(file, mode) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('format', appState.selectedFormat);
  fd.append('detail', appState.selectedDetail);
  fd.append('include', appState.selectedInclude);
  fd.append('mode', mode);
  
  const endpoint = mode === 'audio' ? '/transcribe/audio' : 
                   mode === 'video' ? '/transcribe/video' : 
                   '/upload';
  
  const response = await fetch(endpoint, { method: 'POST', body: fd });
  return response.json();
}

/* ───────────────────────────────────────────────────────────────
   PROCESSING STATE
─────────────────────────────────────────────────────────────── */
function showProcessing() {
  showPage('processing');
  procFill.style.width = '0%';
  
  const steps = [
    'Parsing input…',
    'Extracting keywords…',
    'Generating summary…',
    'Clustering topics…',
    'Formatting output…'
  ];
  
  let step = 0;
  procDots.forEach(dot => dot.classList.remove('active', 'done'));
  
  const interval = setInterval(() => {
    if (step < steps.length) {
      procTitle.textContent = steps[step];
      procStep.textContent = `${step + 1}/${steps.length}`;
      procFill.style.width = ((step + 1) / steps.length * 100) + '%';
      
      if (step > 0) {
        procDots[step - 1].classList.add('done');
      }
      if (step < procDots.length) {
        procDots[step].classList.add('active');
      }
      
      step++;
    } else {
      clearInterval(interval);
    }
  }, 300);
}

function hideProcessing() {
  // Auto-hide after results shown
}

/* ───────────────────────────────────────────────────────────────
   RENDER OUTPUT
─────────────────────────────────────────────────────────────── */
let outputData = null;

function renderOutput(data) {
  outputData = data;
  
  // Summary
  summaryContent.innerHTML = '';
  if (appState.selectedFormat === 'bullets') {
    // Bullet points
    data.summary.forEach(sentence => {
      const div = document.createElement('div');
      div.className = 'summary-para';
      div.innerHTML = '• ' + escapeHtml(sentence);
      summaryContent.appendChild(div);
    });
  } else if (appState.selectedFormat === 'paragraphs') {
    // Paragraphs
    data.summary.forEach(sentence => {
      const div = document.createElement('div');
      div.className = 'summary-para';
      div.innerHTML = escapeHtml(sentence);
      summaryContent.appendChild(div);
    });
  } else if (appState.selectedFormat === 'study') {
    // Study format - Q&A style
    data.summary.forEach((sentence, i) => {
      const div = document.createElement('div');
      div.className = 'summary-para';
      div.style.borderLeft = '3px solid var(--green)';
      div.innerHTML = `<strong>Key point ${i + 1}:</strong> ${escapeHtml(sentence)}`;
      summaryContent.appendChild(div);
    });
  }
  
  // Keywords
  if (appState.selectedInclude === 'on') {
    document.getElementById('secKeywords').classList.remove('hidden');
    keywordsContent.innerHTML = '';
    data.keywords.forEach((kw, i) => {
      const span = document.createElement('span');
      span.className = 'kw';
      span.innerHTML = kw;
      span.style.animationDelay = (i * 0.05) + 's';
      keywordsContent.appendChild(span);
    });
  } else {
    document.getElementById('secKeywords').classList.add('hidden');
  }
  
  // Topics
  if (appState.selectedInclude === 'on' && data.topics && data.topics.length) {
    document.getElementById('secTopics').classList.remove('hidden');
    topicsContent.innerHTML = '';
    
    data.topics.forEach((topic, i) => {
      const item = document.createElement('div');
      item.className = 'topic-item';
      
      const header = document.createElement('div');
      header.className = 'topic-header';
      header.innerHTML = `
        <span class="topic-title">
          <span class="topic-dot"></span>
          Topic ${i + 1}
        </span>
        <span class="topic-toggle">›</span>
      `;
      
      const body = document.createElement('div');
      body.className = 'topic-body';
      body.innerHTML = '<div class="topic-sents">' +
        (Array.isArray(topic) ? topic : (topic.sentences || [])).map(s =>
          `<div class="t-sent">${escapeHtml(s)}</div>`
        ).join('') +
        '</div>';
      
      header.addEventListener('click', () => {
        item.classList.toggle('open');
      });
      
      item.appendChild(header);
      item.appendChild(body);
      topicsContent.appendChild(item);
    });
  } else {
    document.getElementById('secTopics').classList.add('hidden');
  }
  
  // Transcript (if audio/video)
  if (data.transcript) {
    document.querySelector('[data-section="transcript"]').parentElement.classList.remove('hidden');
    if (transcriptBox) {
      transcriptBox.textContent = data.transcript;
    }
  }
  
  // Update stats
  document.getElementById('kwCount').textContent = data.keywords.length;
  if (data.topics) {
    document.getElementById('toCount').textContent = Array.isArray(data.topics) ? data.topics.length : Object.keys(data.topics).length;
  }
}

/* ───────────────────────────────────────────────────────────────
   OUTPUT SIDEBAR NAVIGATION
─────────────────────────────────────────────────────────────── */
function showSection(e) {
  const section = e.currentTarget.getAttribute('data-section');
  
  // Update active card
  sidebarCards.forEach(card => card.classList.remove('active'));
  e.currentTarget.classList.add('active');
  
  // Show/hide sections
  if (section === 'all') {
    outputSections.forEach(sec => sec.classList.remove('hidden'));
  } else {
    outputSections.forEach(sec => {
      const sectionId = sec.getAttribute('id');
      const show = (section === 'summary' && sectionId === 'secSummary') ||
                   (section === 'keywords' && sectionId === 'secKeywords') ||
                   (section === 'topics' && sectionId === 'secTopics') ||
                   (section === 'study' && sectionId === 'secStudy') ||
                   (section === 'transcript' && sectionId === 'secTranscript');
      
      sec.classList.toggle('hidden', !show);
    });
  }
}

/* ───────────────────────────────────────────────────────────────
   DOWNLOAD & COPY
─────────────────────────────────────────────────────────────── */
function downloadNotes() {
  if (!outputData) return;
  
  let content = '# Generated Lecture Notes\n\n';
  
  content += '## Summary\n';
  outputData.summary.forEach(s => {
    content += `- ${s}\n`;
  });
  
  if (appState.selectedInclude === 'on') {
    content += '\n## Keywords\n';
    content += outputData.keywords.join(', ') + '\n';
    
    if (outputData.topics && outputData.topics.length) {
      content += '\n## Topics\n';
      outputData.topics.forEach((topic, i) => {
        content += `\n### Topic ${i + 1}\n`;
        (Array.isArray(topic) ? topic : (topic.sentences || [])).forEach(s => {
          content += `- ${s}\n`;
        });
      });
    }
  }
  
  if (outputData.transcript) {
    content += '\n## Transcript\n';
    content += outputData.transcript + '\n';
  }
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lecture-notes.md';
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('✓ Notes downloaded!');
}

function copyNotes() {
  if (!outputData) return;
  
  let content = 'LECTURE NOTES\n\n';
  
  content += 'SUMMARY\n';
  outputData.summary.forEach(s => {
    content += `• ${s}\n`;
  });
  
  if (appState.selectedInclude === 'on') {
    content += '\nKEYWORDS\n';
    content += outputData.keywords.join(', ') + '\n';
  }
  
  navigator.clipboard.writeText(content).then(() => {
    showToast('✓ Copied to clipboard!');
  });
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

/* ───────────────────────────────────────────────────────────────
   PAGE NAVIGATION
─────────────────────────────────────────────────────────────── */
function showPage(name) {
  pageInput.classList.remove('active');
  pageProcessing.classList.remove('active');
  pageOutput.classList.remove('active');
  navBack.style.display = 'none';
  
  if (name === 'input') {
    pageInput.classList.add('active');
    navBack.style.display = 'none';
  } else if (name === 'processing') {
    pageProcessing.classList.add('active');
    navBack.style.display = 'none';
  } else if (name === 'output') {
    pageOutput.classList.add('active');
    navBack.style.display = 'flex';
  }
}

function goBack() {
  showPage('input');
  clearOutput();
  
  // Reset selections to defaults
  appState.selectedFormat = 'bullets';
  appState.selectedDetail = 'balanced';
  appState.selectedInclude = 'on';
  
  // Update radio buttons
  document.getElementById('fmtBullets').checked = true;
  document.getElementById('detBalanced').checked = true;
  document.getElementById('studyOn').checked = true;
  
  updateOptionNote();
}

function clearOutput() {
  outputData = null;
  summaryContent.innerHTML = '';
  keywordsContent.innerHTML = '';
  topicsContent.innerHTML = '';
}

/* ───────────────────────────────────────────────────────────────
   THEME TOGGLE
─────────────────────────────────────────────────────────────── */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  themeIcon.textContent = newTheme === 'light' ? '☀️' : '🌙';
}

// Load saved theme
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  themeIcon.textContent = saved === 'light' ? '☀️' : '🌙';
}

/* ───────────────────────────────────────────────────────────────
   ERROR HANDLING
─────────────────────────────────────────────────────────────── */
function showError(msg) {
  errBox.textContent = msg;
  errBox.classList.remove('hidden');
  errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
  errBox.classList.add('hidden');
  errBox.textContent = '';
}

/* ───────────────────────────────────────────────────────────────
   UTILITIES
─────────────────────────────────────────────────────────────── */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ───────────────────────────────────────────────────────────────
   STARTUP
─────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initApp();
  showPage('input');
});
