"""
keywords.py
Extracts top keywords from lecture text using TF-IDF scoring.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np


def extract_keywords(cleaned_sentences: list, top_n: int = 12) -> list:
    """
    Uses TF-IDF to find the most important words across all sentences.

    Args:
        cleaned_sentences: List of preprocessed sentence strings.
        top_n: Number of keywords to return.

    Returns:
        List of keyword strings sorted by importance.
    """
    if not cleaned_sentences or all(s.strip() == "" for s in cleaned_sentences):
        return []

    # Fit TF-IDF on all sentences treated as documents
    vectorizer = TfidfVectorizer(
        max_features=200,
        ngram_range=(1, 2),   # Allow bigrams (e.g. "machine learning")
        min_df=1
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(cleaned_sentences)
    except ValueError:
        return []

    feature_names = vectorizer.get_feature_names_out()

    # Sum TF-IDF scores across all sentences for each word
    scores = np.asarray(tfidf_matrix.sum(axis=0)).flatten()

    # Pair words with their scores and sort descending
    word_scores = sorted(
        zip(feature_names, scores),
        key=lambda x: x[1],
        reverse=True
    )

    # Return only the word strings
    keywords = [word for word, _ in word_scores[:top_n]]
    return keywords