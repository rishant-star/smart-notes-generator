# NoteFlow — Multimodal Notes Generator

Transform lectures into structured, intelligent notes using AI. NoteFlow processes **text, audio, and video** to extract summaries, keywords, and topic clusters.

![NoteFlow](https://img.shields.io/badge/NoteFlow-v1.0-6366f1?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.8+-3776ab?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 🎯 Features

- **Multimodal Input**: Paste text, upload audio files, or drop video files
- **Automatic Transcription**: Whisper-powered speech-to-text (tiny to large models)
- **Intelligent Summarization**: Sentence scoring + TF-IDF extraction
- **Keyword Extraction**: Extract and highlight key terms automatically
- **Topic Clustering**: KMeans clustering to organize notes by topic
- **Professional UI**: Modern SaaS-style interface with dark/light theme
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Processing**: Live progress tracking with step-by-step updates

---

## 📋 Tech Stack

### Backend
- **Flask** — Web framework
- **Whisper** — Speech-to-text transcription
- **scikit-learn** — TF-IDF + KMeans clustering
- **NLTK** — Natural language processing
- **FFmpeg** — Video audio extraction

### Frontend
- **HTML5** — Semantic markup
- **CSS3** — Modern styling (Glassmorphism, animations)
- **JavaScript (Vanilla)** — Zero dependencies, lightweight
- **Inter Font** — Professional typography

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- FFmpeg installed (`ffmpeg` command available in PATH)
- pip / virtualenv

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rishant/SmartNoteGenrator.git
   cd SmartNoteGenrator
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Flask server**
   ```bash
   python app.py
   ```

5. **Open browser**
   ```
   http://localhost:5000
   ```

---

## 📁 Project Structure

```
SmartNoteGenrator/
├── templates/
│   └── index.html                 # Main UI (input, processing, output pages)
├── static/
│   └── (future: CSS/JS splits)
├── app.py                          # Flask backend
├── nlp_pipeline.py                # NLP processing logic
├── requirements.txt               # Python dependencies
├── README.md                       # This file
└── .gitignore
```

---

## 🛠️ Configuration

### Whisper Model Selection

In the UI, choose your Whisper model based on speed/accuracy:

| Model | Speed | Accuracy | VRAM |
|-------|-------|----------|------|
| **tiny** | ⚡⚡⚡ Fastest | ✓ Good | 1GB |
| **base** | ⚡⚡ Fast | ✓✓ Better | 1GB |
| **small** | ⚡ Medium | ✓✓✓ Great | 2GB |
| **medium** | Medium | ✓✓✓✓ Excellent | 5GB |
| **large** | Slow | ✓✓✓✓✓ Best | 10GB |

**Recommended:** `base` (great balance)

### Customize NLP Parameters

Edit `nlp_pipeline.py`:

```python
# Number of keywords to extract
NUM_KEYWORDS = 10

# Number of topic clusters
NUM_TOPICS = 5

# Summarization ratio (0.0-1.0)
SUMMARY_RATIO = 0.3
```

---

## 🎨 UI/UX Flow

### Step 1: Input Page
- Choose input mode: **Text**, **Audio**, or **Video**
- Paste content or upload files
- Select Whisper model (for audio/video)
- Click "Generate Notes"

### Step 2: Processing Page
- Real-time progress indicator
- Step-by-step status:
  - Uploading
  - Transcribing
  - Running NLP
  - Extracting keywords
  - Clustering
- Animated loader with pulsing core

### Step 3: Output Page
- **Summary**: Clean paragraphs with highlighted keywords
- **Keywords**: Colored tags with hover effects
- **Topics**: Expandable accordion for each cluster
- **Transcript**: Full audio/video transcription (if applicable)
- **Actions**: Copy, Download, Share

---

## 📡 API Endpoints

### Text Processing
```http
POST /summarize
Content-Type: application/json

{
  "text": "Your lecture text here..."
}

Response:
{
  "summary": ["Para 1", "Para 2", ...],
  "keywords": ["word1", "word2", ...],
  "topics": [
    {
      "topic": "Topic Name",
      "sentences": ["sent1", "sent2", ...]
    }
  ]
}
```

### Audio Upload
```http
POST /transcribe/audio
Content-Type: multipart/form-data

file: <audio file>
model: base

Response:
{
  "job_id": "uuid"
}
```

### Check Status
```http
GET /status/{job_id}

Response:
{
  "status": "done|processing|error",
  "result": { ... },
  "error": "error message if failed"
}
```

---

## 🔌 Frontend JavaScript Functions

### Page Navigation
```javascript
goToPage('input')       // Go to input page
goToPage('processing')  // Show processing loader
goToPage('output')      // Show results
```

### Theme Toggle
```javascript
setTheme('dark')        // Dark mode
setTheme('light')       // Light mode
```

### Render Output
```javascript
renderOutput(data, isAV)
// data: { summary, keywords, topics, transcript }
// isAV: boolean (show transcript if audio/video)
```

---

## 🎯 Usage Examples

### Example 1: Paste Lecture Text
```
Input: "Machine learning is a subset of artificial intelligence..."
Output:
- Summary: 2-3 concise paragraphs
- Keywords: ["machine learning", "AI", "algorithms", ...]
- Topics: ML Basics, Applications, Techniques, etc.
```

### Example 2: Upload Audio File
```
Input: lecture.mp3 (10 minutes)
Processing: ~30-45 seconds (with base model)
Output:
- Full transcript
- Summary of key points
- Extracted keywords
- Organized topics
```

### Example 3: Upload Video File
```
Input: lecture.mp4 (20 minutes)
Processing: ~1-2 minutes (extracts audio first)
Output:
- Video transcript
- Structured notes
- Keyword highlights
- Topic clusters
```

---

## ⚙️ Backend Processing Pipeline

```
Input (Text/Audio/Video)
    ↓
[Whisper] → Transcription (if needed)
    ↓
[NLTK] → Sentence tokenization + cleaning
    ↓
[Sentence Scoring] → Importance ranking
    ↓
[Top N] → Summary extraction
    ↓
[TF-IDF] → Keyword extraction
    ↓
[KMeans] → Topic clustering
    ↓
Output JSON
    ↓
Render UI
```

---

## 🚨 Troubleshooting

### Issue: "Microphone access denied"
**Solution:** Allow browser access to microphone in settings

### Issue: Audio upload fails
**Solution:** Check file format (mp3, wav, m4a, ogg, flac, webm supported)

### Issue: Long processing time
**Solution:** Use smaller Whisper model (tiny/base) or GPU acceleration

### Issue: Out of memory
**Solution:** 
- Reduce file size
- Use smaller Whisper model
- Restart Flask server

### Issue: No keywords extracted
**Solution:** 
- Ensure input has enough content (5+ sentences)
- Check `NUM_KEYWORDS` setting in config

---

## 🔐 Security

- File uploads are temporary (deleted after processing)
- No data stored on server
- Input sanitization for all text fields
- CORS headers configured for localhost only

---

## 📈 Performance

| Operation | Time (base model) |
|-----------|------------------|
| Text Processing | <1s |
| Audio (5 min) | 30-45s |
| Video (10 min) | 60-90s |
| Topic Clustering | <2s |

*Times vary based on file size and hardware*

---

## 🎓 Use Cases

✅ **Students**: Convert lectures into study notes  
✅ **Researchers**: Extract key concepts from interviews  
✅ **Professionals**: Meeting transcription + summarization  
✅ **Content Creators**: Podcast/video note extraction  
✅ **Language Learners**: Audio comprehension practice  

---

## 🤝 Contributing

Contributions welcome! 

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the **MIT License** — see `LICENSE` file for details.

---

## 📧 Support & Contact

- **GitHub**: [github.com/rishant/SmartNoteGenrator](https://github.com/rishant/SmartNoteGenrator)
- **Issues**: [GitHub Issues](https://github.com/rishant/SmartNoteGenrator/issues)
- **Email**: [ranjanrishant40@gmail.com](mailto:ranjanrishant40@gmail.com)
- **Twitter**: [@rishanr_ranjan](https://twitter.com/rishanr_ranjan)

---

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) — Speech recognition
- [scikit-learn](https://scikit-learn.org/) — ML algorithms
- [NLTK](https://www.nltk.org/) — NLP toolkit
- [Inter Font](https://rsms.me/inter/) — Typography

---

## 🚀 Roadmap

- [ ] Export to PDF/Word
- [ ] Multi-language support
- [ ] Custom topic naming
- [ ] Note editing & revision
- [ ] Cloud storage integration
- [ ] Collaborative notes
- [ ] Browser extension
- [ ] Mobile app
- [ ] API v2 with rate limiting
- [ ] User authentication & cloud sync

---

**Made with ❤️ by [Rishant Ranjan](https://twitter.com/rishanr_ranjan)**

⭐ If this project helped you, consider giving it a star!

---

## 📊 Project Stats

- **Lines of Code**: 2000+
- **Frontend Components**: 50+
- **API Endpoints**: 5+
- **Supported Formats**: Text, Audio (5 formats), Video (4 formats)
- **Processing Pipeline Steps**: 8

---

*Last Updated: April 22, 2026*  
*Version: 1.0.0*  
*Author: Rishant Ranjan*
