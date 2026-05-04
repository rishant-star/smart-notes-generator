"""
preprocess.py
Handles text cleaning, tokenization, stopword removal, and POS filtering.
Enhanced to remove filler words and improve academic content extraction.
"""

import re
import nltk

# Download required NLTK resources (only on first run)
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize

# Try to import POS tagging; fallback to simple pattern-based approach if unavailable
try:
    nltk.download("averaged_perceptron_tagger_eng", quiet=True)
    from nltk import pos_tag
    USE_POS_TAGGING = True
except:
    USE_POS_TAGGING = False

# Standard NLTK stopwords
NLTK_STOPWORDS = set(stopwords.words("english"))

# Extended stopwords: filler words commonly found in speech transcripts
FILLER_WORDS = {
    # Common filler words from speech
    "like", "basically", "actually", "so", "then", "okay", "right", "just", 
    "kind", "sort", "really", "very", "pretty", "quite", "rather", "sure",
    "probably", "maybe", "perhaps", "somehow", "anyway", "yeah", "yep", "nope",
    "hmm", "uh", "um", "ah", "oh", "well", "you know", "i mean", "i think",
    "you see", "look", "listen", "okay so", "right so", "next", "now",
    "let me", "going to", "gonna", "kinda", "sorta", "actually", "literally",
    # Weak verbs and generic terms
    "do", "does", "did", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "get", "gets", "got", "make", "makes",
    "go", "goes", "going", "come", "comes", "put", "take", "say", "said",
    # Generic nouns
    "thing", "stuff", "things", "something", "someone", "people", "guys",
    "kind", "type", "sort", "way", "lot", "number"
}

# Combine all stopwords
STOPWORDS = NLTK_STOPWORDS | FILLER_WORDS


def simple_pos_filter(tokens):
    """
    Simple POS filter when NLTK tagger is unavailable.
    Filters based on word length and known patterns.
    Keeps: longer words (likely nouns/adjectives), removes: short common verbs.
    """
    # Common weak verbs and helpers to remove
    weak_verbs = {"is", "are", "was", "were", "be", "have", "has", "had", "get", 
                  "got", "do", "does", "did", "go", "goes", "going", "make", "makes",
                  "take", "takes", "put", "say", "said", "come", "comes"}
    
    filtered = []
    for word in tokens:
        clean_word = re.sub(r"[^a-z0-9]", "", word.lower())
        # Keep words that are:
        # - Not in stopwords
        # - Longer than 2 chars
        # - Not common weak verbs
        if (clean_word and 
            len(clean_word) > 2 and 
            clean_word not in STOPWORDS and 
            clean_word not in weak_verbs):
            filtered.append(clean_word)
    return filtered


def clean_speech_text(raw_text: str) -> str:
    """
    Cleans up speech transcript artifacts:
    - Removes repeated filler patterns
    - Normalizes spacing
    - Removes excessive punctuation
    """
    # Replace multiple spaces with single space
    text = re.sub(r"\s+", " ", raw_text)
    
    # Remove repeated filler patterns (e.g., "like like like" -> "like")
    text = re.sub(r"\b(like|so|right|okay|basically)\s+\1+\b", r"\1", text, flags=re.IGNORECASE)
    
    # Remove excessive punctuation
    text = re.sub(r"[.!?]{2,}", ".", text)
    
    # Clean up brackets and parentheses markers
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\(.*?laughter.*?\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\(.*?pause.*?\)", "", text, flags=re.IGNORECASE)
    
    return text.strip()


def preprocess_text(raw_text: str):
    """
    Splits raw text into sentences and returns:
      - sentences      : original sentence strings
      - cleaned_sentences : lowercased, stopword-removed, filtered token strings
    """
    # Clean up speech artifacts first
    raw_text = clean_speech_text(raw_text)
    
    # Split into sentences
    sentences = sent_tokenize(raw_text)
    
    # Keep only sentences with at least 4 words (more lenient now)
    sentences = [s.strip() for s in sentences if len(s.split()) >= 4]

    cleaned_sentences = []
    for sentence in sentences:
        # Tokenize
        tokens = word_tokenize(sentence.lower())
        
        # Filter using POS tagging if available, otherwise use simple filter
        if USE_POS_TAGGING:
            try:
                pos_tagged = pos_tag(tokens, tagset="universal")
                
                # Filter: keep only meaningful POS tags and remove stopwords
                filtered_tokens = []
                for word, pos in pos_tagged:
                    # Clean word (remove special characters, keep only alphanumeric)
                    clean_word = re.sub(r"[^a-z0-9]", "", word)
                    
                    # POS tags to keep (nouns, adjectives)
                    meaningful_pos = {"NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS"}
                    
                    # Skip short words, stopwords, and non-meaningful POS
                    if (clean_word and 
                        len(clean_word) > 2 and 
                        clean_word not in STOPWORDS and 
                        pos in meaningful_pos):
                        filtered_tokens.append(clean_word)
            except:
                # Fallback to simple filtering if POS tagging fails
                filtered_tokens = simple_pos_filter(tokens)
        else:
            filtered_tokens = simple_pos_filter(tokens)
        
        # Only keep sentence if it has at least 2 meaningful words
        if len(filtered_tokens) >= 2:
            cleaned_sentences.append(" ".join(filtered_tokens))
        else:
            # Fallback: if no meaningful words found, use basic stopword filtering
            tokens = word_tokenize(sentence.lower())
            tokens = [re.sub(r"[^a-z]", "", t) for t in tokens]
            tokens = [t for t in tokens if t and t not in STOPWORDS and len(t) > 2]
            if len(tokens) >= 2:
                cleaned_sentences.append(" ".join(tokens))

    return sentences, cleaned_sentences


def tokenize_words(text: str):
    """Returns a cleaned list of meaningful words from a block of text."""
    tokens = word_tokenize(text.lower())
    
    if USE_POS_TAGGING:
        try:
            pos_tagged = pos_tag(tokens, tagset="universal")
            
            # Filter for meaningful POS and remove stopwords
            meaningful_pos = {"NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS"}
            meaningful_tokens = []
            for word, pos in pos_tagged:
                clean_word = re.sub(r"[^a-z0-9]", "", word)
                if (clean_word and 
                    len(clean_word) > 2 and 
                    clean_word not in STOPWORDS and 
                    pos in meaningful_pos):
                    meaningful_tokens.append(clean_word)
            
            return meaningful_tokens if meaningful_tokens else []
        except:
            pass
    
    # Fallback to simple filtering
    return simple_pos_filter(tokens)