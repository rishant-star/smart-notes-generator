"""
Smart Lecture Notes Generator - Flask Application
Main entry point for the web server and API endpoints.
"""

from flask import Flask, request, jsonify, render_template
from preprocess import preprocess_text
from summarizer import generate_summary
from keywords import extract_keywords
from clustering import cluster_sentences

app = Flask(__name__)

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/summarize", methods=["POST"])
def summarize():
    """
    POST /summarize
    Accepts JSON: { "text": "..." }
    Returns structured notes: summary, keywords, topics.
    """
    data = request.get_json()
    if not data or not data.get("text", "").strip():
        return jsonify({"error": "No text provided."}), 400

    raw_text = data["text"].strip()
    return _process_text(raw_text)


@app.route("/upload", methods=["POST"])
def upload():
    """
    POST /upload
    Accepts a .txt file upload.
    Returns structured notes: summary, keywords, topics.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400
    if not file.filename.endswith(".txt"):
        return jsonify({"error": "Only .txt files are supported."}), 400

    raw_text = file.read().decode("utf-8", errors="ignore").strip()
    if not raw_text:
        return jsonify({"error": "Uploaded file is empty."}), 400

    return _process_text(raw_text)


# ─── Core Processing Pipeline ──────────────────────────────────────────────────

def _process_text(raw_text: str):
    """
    Runs the full NLP pipeline on the input text and returns a JSON response.
    Steps:
      1. Preprocess (tokenize, remove stopwords)
      2. Extract keywords via TF-IDF
      3. Generate summary (top-ranked sentences)
      4. Cluster sentences into topics
    """
    try:
        # Step 1: Preprocess
        sentences, cleaned_sentences = preprocess_text(raw_text)

        if len(sentences) < 2:
            return jsonify({"error": "Text too short. Please provide more content."}), 400

        # Step 2: Keywords
        keywords = extract_keywords(cleaned_sentences, top_n=12)

        # Step 3: Summary
        summary_sentences = generate_summary(sentences, cleaned_sentences, top_n=6)

        # Step 4: Clustering into topics
        topics = cluster_sentences(sentences, cleaned_sentences, n_clusters=3)

        word_count = len(raw_text.split())

        return jsonify({
            "summary": summary_sentences,
            "keywords": keywords,
            "topics": topics,
            "word_count": word_count
        })

    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500


# ─── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)