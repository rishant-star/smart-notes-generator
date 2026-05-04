"""
summarizer.py
Scores and ranks sentences to generate an extractive summary.
Enhanced to avoid filler word sentences and prioritize content-rich statements.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

# Download required resources
nltk.download("stopwords", quiet=True)

# Extended filler word list
FILLER_WORDS = {
    "like", "basically", "actually", "so", "then", "okay", "right", "just", 
    "kind", "sort", "really", "very", "pretty", "quite", "rather", "sure",
    "probably", "maybe", "perhaps", "somehow", "anyway", "yeah", "yep", "nope",
    "hmm", "uh", "um", "ah", "oh", "well", "you know", "i mean", "i think",
    "you see", "look", "listen", "okay so", "right so", "next", "now",
    "let me", "going to", "gonna", "kinda", "sorta", "literally", "is", "are",
    "was", "were", "be", "been", "have", "has", "had", "get", "got", "do", "does"
}

# Standard NLTK stopwords
NLTK_STOPWORDS = set(stopwords.words("english"))
ALL_STOPWORDS = NLTK_STOPWORDS | FILLER_WORDS


def calculate_filler_ratio(sentence: str) -> float:
    """
    Calculates the ratio of filler words in a sentence.
    Higher ratio = lower quality sentence.
    
    Args:
        sentence: Original sentence text
        
    Returns:
        Float between 0 and 1: ratio of filler words
    """
    tokens = word_tokenize(sentence.lower())
    if not tokens:
        return 0.0
    
    filler_count = sum(1 for token in tokens if token.lower() in ALL_STOPWORDS)
    return filler_count / len(tokens)


def calculate_keyword_boost(sentence: str, keywords: list) -> float:
    """
    Boosts score if sentence contains keywords.
    
    Args:
        sentence: Original sentence text
        keywords: List of important keywords
        
    Returns:
        Boost multiplier (>= 1.0)
    """
    if not keywords:
        return 1.0
    
    sentence_lower = sentence.lower()
    keyword_matches = sum(1 for keyword in keywords if keyword.lower() in sentence_lower)
    
    # Each keyword match adds 10% boost, max 50% boost
    boost = 1.0 + min(0.5, keyword_matches * 0.1)
    return boost


def generate_summary(sentences: list, cleaned_sentences: list, top_n: int = 6, keywords: list = None) -> list:
    """
    Scores each sentence by TF-IDF cosine similarity with penalties for filler words
    and boosts for keyword-rich sentences.
    
    Returns top_n highest-scoring sentences in their original order.

    Args:
        sentences: Original (un-cleaned) sentence strings.
        cleaned_sentences: Preprocessed versions for vectorization.
        top_n: Number of summary sentences to return.
        keywords: Optional list of important keywords for boosting.

    Returns:
        List of original sentence strings representing the summary.
    """
    if len(sentences) <= top_n:
        return sentences  # Too few sentences; return all

    # Handle empty input
    if not cleaned_sentences or all(s.strip() == "" for s in cleaned_sentences):
        return sentences[:top_n]

    # Build TF-IDF matrix where each row = one sentence
    vectorizer = TfidfVectorizer()
    try:
        tfidf_matrix = vectorizer.fit_transform(cleaned_sentences)
    except ValueError:
        return sentences[:top_n]

    # Create a single "document vector" by averaging all sentence vectors
    doc_vector = np.asarray(tfidf_matrix.mean(axis=0))

    # Score each sentence by similarity to the document vector
    base_scores = cosine_similarity(tfidf_matrix, doc_vector).flatten()
    
    # Apply penalties and boosts
    adjusted_scores = []
    for i, base_score in enumerate(base_scores):
        sentence = sentences[i]
        
        # Penalty: reduce score based on filler word ratio
        # Sentences with >50% filler words get HEAVILY penalized
        filler_ratio = calculate_filler_ratio(sentence)
        # Exponential penalty: makes high-filler sentences very unattractive
        filler_penalty = max(0.1, (1.0 - filler_ratio) ** 1.5)
        
        # Boost: increase score if sentence contains keywords
        keyword_boost = calculate_keyword_boost(sentence, keywords) if keywords else 1.0
        
        # Final adjusted score
        adjusted_score = base_score * filler_penalty * keyword_boost
        adjusted_scores.append(adjusted_score)
    
    adjusted_scores = np.array(adjusted_scores)

    # Get indices of top-N scoring sentences
    top_indices = np.argsort(adjusted_scores)[::-1][:top_n]

    # Return sentences in their ORIGINAL order (preserves narrative flow)
    top_indices_sorted = sorted(top_indices)
    return [sentences[i] for i in top_indices_sorted]