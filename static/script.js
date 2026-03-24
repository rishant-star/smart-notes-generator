/**
 * script.js
 * Smart Lecture Notes Generator — Frontend Logic
 * Handles user input, API calls, and dynamic result rendering.
 */

// ── DOM References ────────────────────────────────────────────────────────────
const lectureText   = document.getElementById("lectureText");
const wordCountEl   = document.getElementById("wordCount");
const fileInput     = document.getElementById("fileInput");
const browseBtn     = document.getElementById("browseBtn");
const uploadZone    = document.getElementById("uploadZone");
const fileNameDisp  = document.getElementById("fileNameDisplay");
const generateBtn   = document.getElementById("generateBtn");
const clearBtn      = document.getElementById("clearBtn");
const errorBanner   = document.getElementById("errorBanner");
const loadingState  = document.getElementById("loadingState");
const resultsPanel  = document.getElementById("resultsPanel");

// Stats
const statWords    = document.getElementById("statWords");
const statSummary  = document.getElementById("statSummary");
const statKeywords = document.getElementById("statKeywords");
const statTopics   = document.getElementById("statTopics");

// Result areas
const keywordsCloud   = document.getElementById("keywordsCloud");
const summaryList     = document.getElementById("summaryList");
const topicsContainer = document.getElementById("topicsContainer");

// Loading step indicators
const steps = [
  document.getElementById("step1"),
  document.getElementById("step2"),
  document.getElementById("step3"),
  document.getElementById("step4"),
];

// State
let uploadedFile = null;
let stepTimer    = null;


// ── Word Counter ──────────────────────────────────────────────────────────────
lectureText.addEventListener("input", () => {
  const words = lectureText.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = words;
  // Clear file if user types
  if (lectureText.value.trim()) {
    uploadedFile = null;
    fileNameDisp.textContent = "No file selected";
  }
});


// ── File Upload ───────────────────────────────────────────────────────────────
browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

uploadZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (!file.name.endsWith(".txt")) {
    showError("Only .txt files are supported.");
    return;
  }
  uploadedFile = file;
  fileNameDisp.textContent = `📄 ${file.name}`;
  lectureText.value = "";       // Clear textarea if file chosen
  wordCountEl.textContent = "0";
});

// Drag & drop
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (!file || !file.name.endsWith(".txt")) {
    showError("Please drop a .txt file.");
    return;
  }
  uploadedFile = file;
  fileNameDisp.textContent = `📄 ${file.name}`;
  lectureText.value = "";
  wordCountEl.textContent = "0";
});


// ── Clear ─────────────────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  lectureText.value = "";
  wordCountEl.textContent = "0";
  uploadedFile = null;
  fileInput.value = "";
  fileNameDisp.textContent = "No file selected";
  hideError();
  resultsPanel.classList.add("hidden");
});


// ── Generate Notes ────────────────────────────────────────────────────────────
generateBtn.addEventListener("click", handleGenerate);

async function handleGenerate() {
  hideError();

  const text = lectureText.value.trim();

  // Validate: must have either text or a file
  if (!text && !uploadedFile) {
    showError("Please enter lecture text or upload a .txt file.");
    return;
  }

  showLoading();

  try {
    let data;
    if (uploadedFile) {
      data = await uploadFile(uploadedFile);
    } else {
      data = await summarizeText(text);
    }

    if (data.error) {
      showError(data.error);
      return;
    }

    renderResults(data);

  } catch (err) {
    showError("Network error. Is the Flask server running on port 5000?");
    console.error(err);
  } finally {
    hideLoading();
  }
}


// ── API Calls ─────────────────────────────────────────────────────────────────

async function summarizeText(text) {
  const resp = await fetch("/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return resp.json();
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch("/upload", {
    method: "POST",
    body: formData,
  });
  return resp.json();
}


// ── Render Results ────────────────────────────────────────────────────────────

function renderResults(data) {
  const { summary, keywords, topics, word_count } = data;

  // Stats bar
  statWords.textContent    = word_count || "—";
  statSummary.textContent  = summary.length;
  statKeywords.textContent = keywords.length;
  statTopics.textContent   = topics.length;

  // Keywords cloud
  keywordsCloud.innerHTML = "";
  keywords.forEach((kw, i) => {
    const tag = document.createElement("span");
    tag.className = "keyword-tag";
    tag.textContent = kw;
    tag.style.animationDelay = `${i * 0.04}s`;
    keywordsCloud.appendChild(tag);
  });

  // Summary list with keyword highlighting
  summaryList.innerHTML = "";
  summary.forEach((sentence, i) => {
    const li = document.createElement("li");
    li.className = "summary-item";

    const bullet = document.createElement("span");
    bullet.className = "summary-bullet";
    bullet.textContent = i + 1;

    const text = document.createElement("span");
    text.innerHTML = highlightKeywords(sentence, keywords);

    li.appendChild(bullet);
    li.appendChild(text);
    summaryList.appendChild(li);
  });

  // Topics
  topicsContainer.innerHTML = "";
  topics.forEach((topic) => {
    const group = document.createElement("div");
    group.className = "topic-group";

    const heading = document.createElement("div");
    heading.className = "topic-heading";
    heading.textContent = topic.topic;
    group.appendChild(heading);

    const sentenceList = document.createElement("div");
    sentenceList.className = "topic-sentences";
    topic.sentences.forEach((s) => {
      const div = document.createElement("div");
      div.className = "topic-sentence";
      div.innerHTML = highlightKeywords(s, keywords);
      sentenceList.appendChild(div);
    });
    group.appendChild(sentenceList);
    topicsContainer.appendChild(group);
  });

  resultsPanel.classList.remove("hidden");
  // Smooth scroll to results
  setTimeout(() => resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}


// ── Keyword Highlighting ──────────────────────────────────────────────────────

function highlightKeywords(sentence, keywords) {
  let result = escapeHtml(sentence);
  // Sort keywords longest-first to avoid partial replacements
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  sorted.forEach((kw) => {
    const escaped = escapeRegex(kw);
    const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
    result = result.replace(regex, `<mark class="kw-highlight">$1</mark>`);
  });
  return result;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// ── Loading Animation ─────────────────────────────────────────────────────────

function showLoading() {
  resultsPanel.classList.add("hidden");
  loadingState.classList.remove("hidden");
  generateBtn.disabled = true;
  generateBtn.querySelector(".btn-text").textContent = "Processing…";

  // Animate steps sequentially
  steps.forEach(s => s.classList.remove("active"));
  let currentStep = 0;
  steps[0].classList.add("active");

  stepTimer = setInterval(() => {
    if (currentStep < steps.length - 1) {
      currentStep++;
      steps[currentStep].classList.add("active");
    } else {
      clearInterval(stepTimer);
    }
  }, 600);
}

function hideLoading() {
  clearInterval(stepTimer);
  loadingState.classList.add("hidden");
  generateBtn.disabled = false;
  generateBtn.querySelector(".btn-text").textContent = "Generate Notes";
  steps.forEach(s => s.classList.remove("active"));
}


// ── Error Handling ────────────────────────────────────────────────────────────

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
  errorBanner.textContent = "";
}
