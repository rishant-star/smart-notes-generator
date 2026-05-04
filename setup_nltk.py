#!/usr/bin/env python3
"""
setup_nltk.py
Downloads all required NLTK resources for the NLP pipeline.
"""

import nltk

print("Downloading NLTK resources...")

resources = [
    "punkt",
    "punkt_tab",
    "stopwords",
    "averaged_perceptron_tagger",
    "universal_tagset"
]

for resource in resources:
    try:
        nltk.download(resource, quiet=True)
        print(f"✓ Downloaded: {resource}")
    except Exception as e:
        print(f"⚠ Failed to download {resource}: {e}")

print("\n✓ NLTK setup complete!")
