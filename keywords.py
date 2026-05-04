"""
keywords.py
Extracts top keywords from lecture text using TF-IDF scoring with advanced filtering.
Enhanced to remove meaningless phrases and prioritize content-rich terms.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import re

# Meaningless bigrams and phrases to filter out
MEANINGLESS_PHRASES = {
    "thing is", "kind of", "sort of", "lot of", "number of",
    "going to", "gonna", "want to", "able to", "try to",
    "like a", "like the", "said the", "said that", "say that",
    "one way", "another way", "other thing", "other things",
    "is the", "are the", "was the", "have the", "has the"
}

# Common weak verbs that shouldn't be in bigrams
WEAK_VERBS = {"is", "are", "was", "were", "be", "have", "has", "had", "do", "does", 
              "did", "get", "gets", "go", "goes", "make", "makes", "take", "takes",
              "put", "say", "come", "comes"}


def is_valid_ngram(phrase: str) -> bool:
    """
    Validates if an n-gram is meaningful (not just filler words or verbs).
    
    Args:
        phrase: The n-gram string to validate
        
    Returns:
        True if phrase is likely meaningful; False if it's filler/generic
    """
    # Check against known meaningless phrases
    if phrase.lower() in MEANINGLESS_PHRASES:
        return False
    
    # For multi-word phrases, check composition
    words = phrase.split()
    if len(words) > 1:
        # Count weak verbs vs meaningful words
        weak_count = sum(1 for w in words if w.lower() in WEAK_VERBS)
        meaningful_count = len(words) - weak_count
        
        # Require more meaningful words than weak verbs
        if meaningful_count <= weak_count:
            return False
        
        # Filter phrases that are mostly articles/prepositions
        short_words = sum(1 for w in words if len(w) <= 2)
        if short_words > len(words) * 0.5:  # More than 50% short words
            return False
    
    # Filter out very short phrases (single character after cleanup)
    if len(phrase.replace(" ", "")) < 3:
        return False
    
    # Don't allow phrases that are just filler words
    if all(w.lower() in MEANINGLESS_PHRASES for w in words):
        return False
    
    return True


def extract_keywords(cleaned_sentences: list, top_n: int = 12) -> list:
    """
    Uses TF-IDF to find the most important words and phrases across all sentences.
    Filters out meaningless phrases and low-value terms.

    Args:
        cleaned_sentences: List of preprocessed sentence strings.
        top_n: Number of keywords to return.

    Returns:
        List of keyword strings sorted by importance, filtered for academic relevance.
    """
    if not cleaned_sentences or all(s.strip() == "" for s in cleaned_sentences):
        return []

    # Fit TF-IDF on all sentences treated as documents
    vectorizer = TfidfVectorizer(
        max_features=300,  # Increased to filter more options
        ngram_range=(1, 2),  # Allow unigrams and bigrams
        min_df=1,
        lowercase=True,
        token_pattern=r"(?u)\b[a-z]{3,}\b"  # Only words with 3+ characters
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(cleaned_sentences)
    except ValueError:
        return []

    feature_names = vectorizer.get_feature_names_out()

    # Sum TF-IDF scores across all sentences for each word/phrase
    scores = np.asarray(tfidf_matrix.sum(axis=0)).flatten()

    # Pair words/phrases with their scores
    word_scores = list(zip(feature_names, scores))
    
    # Filter and prioritize keywords
    filtered_keywords = []
    for word, score in word_scores:
        # Skip invalid n-grams and meaningless phrases
        if is_valid_ngram(word):
            filtered_keywords.append((word, score))
    
    # Sort by score (descending) and take top N
    filtered_keywords.sort(key=lambda x: x[1], reverse=True)
    
    # Return only the keyword strings
    keywords = [word for word, _ in filtered_keywords[:top_n]]
    
    return keywords