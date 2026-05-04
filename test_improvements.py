#!/usr/bin/env python3
"""
test_improvements.py
Quick test to demonstrate the NLP pipeline improvements.
Run: python test_improvements.py
"""

from preprocess import preprocess_text, tokenize_words
from keywords import extract_keywords
from summarizer import generate_summary

# Sample lecture transcript with filler words and speech artifacts
SAMPLE_TRANSCRIPT = """
So like, okay basically, the thing is, you know, machine learning is really important.
Right so, basically like, neural networks work because they process data through layers.
So like, the thing is, we need to preprocess the data, you know?
Basically, data normalization removes outliers and improves accuracy, like, really important.
Okay so, the algorithm, right, it's gonna train on the dataset and kind of learn patterns.
Like basically, the training process adjusts weights to minimize error, sort of, right?
So then, the model validation phase ensures that our network generalizes well.
You know, like, the accuracy score tells us how well the neural network performs on test data.
Okay so basically, overfitting happens when the model kind of memorizes training data.
Right, so like, regularization techniques prevent overfitting, basically, you know?
So the thing is, feature extraction creates meaningful representations from raw input data.
Like, okay, hyperparameter tuning adjusts learning rate and batch size for better convergence.
"""

print("=" * 80)
print("NLP PIPELINE IMPROVEMENT TEST")
print("=" * 80)

# Step 1: Preprocessing
print("\n[1] PREPROCESSING")
print("-" * 80)
sentences, cleaned = preprocess_text(SAMPLE_TRANSCRIPT)
print(f"✓ Extracted {len(sentences)} sentences")
print(f"\nOriginal sentence (with filler):")
print(f"  '{sentences[0]}'")
print(f"\nCleaned sentence (POS filtered, no fillers):")
print(f"  '{cleaned[0]}'")

# Step 2: Keyword Extraction
print("\n\n[2] KEYWORD EXTRACTION")
print("-" * 80)
keywords = extract_keywords(cleaned, top_n=15)
print(f"✓ Extracted {len(keywords)} keywords:")
for i, kw in enumerate(keywords, 1):
    print(f"  {i:2d}. {kw}")

# Verify no filler words in keywords
filler_words = {"like", "basically", "so", "right", "okay", "kind", "sort", "thing", 
                "you know", "i mean", "gonna", "kinda"}
filler_found = [kw for kw in keywords if any(fw in kw.lower() for fw in filler_words)]
if filler_found:
    print(f"\n⚠ WARNING: Found filler words in keywords: {filler_found}")
else:
    print(f"\n✓ SUCCESS: NO FILLER WORDS in keywords!")

# Step 3: Summary Generation
print("\n\n[3] SUMMARY GENERATION (With Quality Filtering)")
print("-" * 80)
summary = generate_summary(sentences, cleaned, top_n=5, keywords=keywords)
print(f"✓ Generated {len(summary)}-sentence summary:\n")
for i, sent in enumerate(summary, 1):
    print(f"{i}. {sent}")

print("\n\n[4] QUALITY METRICS")
print("-" * 80)

# Calculate filler word statistics
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import nltk

nltk.download("stopwords", quiet=True)

FILLER_WORDS = {
    "like", "basically", "actually", "so", "then", "okay", "right", "just", 
    "kind", "sort", "really", "very", "pretty", "quite", "sure", "probably", 
    "maybe", "hmm", "uh", "um", "ah", "oh", "well", "you", "know", "i", "mean",
    "see", "look", "listen", "let", "me", "going", "to", "gonna", "kinda", "sorta"
}

def count_filler_ratio(text):
    tokens = word_tokenize(text.lower())
    if not tokens:
        return 0
    filler_count = sum(1 for t in tokens if t.lower() in FILLER_WORDS)
    return (filler_count / len(tokens)) * 100

original_filler = count_filler_ratio(SAMPLE_TRANSCRIPT)
summary_text = " ".join(summary)
summary_filler = count_filler_ratio(summary_text)

print(f"Original transcript filler word ratio: {original_filler:.1f}%")
print(f"Generated summary filler word ratio:  {summary_filler:.1f}%")
print(f"Improvement:                          {original_filler - summary_filler:.1f}% reduction")

if summary_filler < original_filler * 0.3:
    print(f"\n✓ EXCELLENT: Summary has significantly fewer filler words!")
elif summary_filler < original_filler * 0.5:
    print(f"\n✓ GOOD: Summary has moderately fewer filler words")
else:
    print(f"\n⚠ WARNING: Consider adjusting filler word penalties")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
