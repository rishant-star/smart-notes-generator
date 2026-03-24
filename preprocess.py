"""
preprocess.py
Handles text cleaning, tokenization, and stopword removal.
"""

import re
import nltk

# Download required NLTK resources (only on first run)
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize

STOPWORDS = set(stopwords.words("english"))


def preprocess_text(raw_text: str):
    """
    Splits raw text into sentences and returns:
      - sentences      : original sentence strings
      - cleaned_sentences : lowercased, stopword-removed token strings (for TF-IDF)
    """
    # Split into sentences
    sentences = sent_tokenize(raw_text)
    # Keep only sentences with at least 5 words
    sentences = [s.strip() for s in sentences if len(s.split()) >= 5]

    cleaned_sentences = []
    for sentence in sentences:
        # Lowercase and remove non-alpha characters
        tokens = word_tokenize(sentence.lower())
        tokens = [re.sub(r"[^a-z]", "", t) for t in tokens]
        tokens = [t for t in tokens if t and t not in STOPWORDS and len(t) > 2]
        cleaned_sentences.append(" ".join(tokens))

    return sentences, cleaned_sentences


def tokenize_words(text: str):
    """Returns a cleaned list of meaningful words from a block of text."""
    tokens = word_tokenize(text.lower())
    tokens = [re.sub(r"[^a-z]", "", t) for t in tokens]
    return [t for t in tokens if t and t not in STOPWORDS and len(t) > 2]