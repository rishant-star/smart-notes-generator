"""
summarizer.py
Scores and ranks sentences to generate an extractive summary.
Uses TF-IDF cosine similarity against the full document vector.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def generate_summary(sentences: list, cleaned_sentences: list, top_n: int = 6) -> list:
    """
    Scores each sentence by its cosine similarity to the overall document,
    then returns the top_n highest-scoring sentences in their original order.

    Args:
        sentences: Original (un-cleaned) sentence strings.
        cleaned_sentences: Preprocessed versions for vectorization.
        top_n: Number of summary sentences to return.

    Returns:
        List of original sentence strings representing the summary.
    """
    if len(sentences) <= top_n:
        return sentences  # Too few sentences; return all

    # Build TF-IDF matrix where each row = one sentence
    vectorizer = TfidfVectorizer()
    try:
        tfidf_matrix = vectorizer.fit_transform(cleaned_sentences)
    except ValueError:
        return sentences[:top_n]

    # Create a single "document vector" by averaging all sentence vectors
    doc_vector = np.asarray(tfidf_matrix.mean(axis=0))

    # Score each sentence by similarity to the document vector
    scores = cosine_similarity(tfidf_matrix, doc_vector).flatten()

    # Get indices of top-N scoring sentences
    top_indices = np.argsort(scores)[::-1][:top_n]

    # Return sentences in their ORIGINAL order (preserves narrative flow)
    top_indices_sorted = sorted(top_indices)
    return [sentences[i] for i in top_indices_sorted]