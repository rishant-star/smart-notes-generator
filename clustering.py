"""
clustering.py
Groups sentences into thematic topic clusters using KMeans + TF-IDF.
Assigns a label to each cluster based on the most representative words.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.exceptions import ConvergenceWarning
import warnings


def cluster_sentences(sentences: list, cleaned_sentences: list, n_clusters: int = 3) -> list:
    """
    Clusters sentences into n_clusters groups and assigns topic labels.

    Args:
        sentences: Original sentence strings.
        cleaned_sentences: Preprocessed sentences for vectorization.
        n_clusters: Number of topic groups to create.

    Returns:
        List of dicts: [{ "topic": "Topic Label", "sentences": [...] }, ...]
    """
    # Adjust cluster count if we have fewer sentences than requested clusters
    n_clusters = min(n_clusters, len(sentences))
    if n_clusters < 2:
        return [{"topic": "Main Topic", "sentences": sentences}]

    # Vectorize
    vectorizer = TfidfVectorizer(max_features=300)
    try:
        tfidf_matrix = vectorizer.fit_transform(cleaned_sentences)
    except ValueError:
        return [{"topic": "Main Topic", "sentences": sentences}]

    # KMeans clustering
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(tfidf_matrix)

    feature_names = vectorizer.get_feature_names_out()
    topics = []

    for cluster_id in range(n_clusters):
        # Find which sentences belong to this cluster
        cluster_indices = [i for i, lbl in enumerate(labels) if lbl == cluster_id]
        if not cluster_indices:
            continue

        cluster_sentences = [sentences[i] for i in cluster_indices]

        # Extract top words for the cluster centroid → use as topic label
        centroid = kmeans.cluster_centers_[cluster_id]
        top_word_indices = centroid.argsort()[::-1][:3]
        top_words = [feature_names[i].title() for i in top_word_indices]
        topic_label = " & ".join(top_words)

        topics.append({
            "topic": topic_label,
            "sentences": cluster_sentences
        })

    return topics