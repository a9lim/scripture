#!/usr/bin/env python3
"""Build chapter similarity index using TF-IDF cosine similarity.

Usage::

    python3 similarity.py <data_dir>

Requires scikit-learn: ``pip install scikit-learn``
Writes ``<data_dir>/similarity.json``.
"""

import argparse
import json
import os
import sys

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("Error: scikit-learn required. pip install scikit-learn", file=sys.stderr)
    sys.exit(1)

MIN_SCORE = 0.1
TOP_N = 5


def build_similarity(data_dir: str) -> None:
    works_path = os.path.join(data_dir, "works.json")
    if not os.path.isfile(works_path):
        print(f"Error: {works_path} not found.", file=sys.stderr)
        sys.exit(1)

    with open(works_path, "r", encoding="utf-8") as f:
        work_order = json.load(f)

    chapters = []

    for work_id in work_order:
        work_dir = os.path.join(data_dir, work_id)
        manifest_path = os.path.join(work_dir, "manifest.json")
        if not os.path.isfile(manifest_path):
            continue

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        chapter_to_book = {}
        for book in manifest.get("books", []):
            for ch in book.get("chapters", []):
                chapter_to_book[ch["id"]] = book["id"]

        chapters_dir = os.path.join(work_dir, "chapters")
        if not os.path.isdir(chapters_dir):
            continue

        for chapter_file in sorted(os.listdir(chapters_dir)):
            if not chapter_file.endswith(".json"):
                continue

            with open(os.path.join(chapters_dir, chapter_file), "r", encoding="utf-8") as f:
                chapter = json.load(f)

            chapter_id = chapter["id"]
            parts = []
            for section in chapter.get("sections", []):
                for verse in section.get("verses", []):
                    parts.append(verse["text"])

            text = " ".join(parts)
            if text.strip():
                chapters.append({
                    "workId": work_id,
                    "chapterId": chapter_id,
                    "bookId": chapter_to_book.get(chapter_id, ""),
                    "text": text,
                })

    if not chapters:
        print("No chapters found.")
        return

    print(f"Computing similarity for {len(chapters)} chapters...")

    texts = [ch["text"] for ch in chapters]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=20000)
    tfidf = vectorizer.fit_transform(texts)
    sim_matrix = cosine_similarity(tfidf)

    result = {}
    for i, ch in enumerate(chapters):
        scores = []
        for j, other in enumerate(chapters):
            if i == j:
                continue
            # Exclude same-book chapters to prioritize cross-work discovery
            if ch["bookId"] == other["bookId"] and ch["workId"] == other["workId"]:
                continue
            score = float(sim_matrix[i, j])
            if score >= MIN_SCORE:
                scores.append({"ref": f"{other['workId']}:{other['chapterId']}", "score": round(score, 3)})

        scores.sort(key=lambda x: x["score"], reverse=True)
        if scores:
            result[ch["chapterId"]] = scores[:TOP_N]

    with open(os.path.join(data_dir, "similarity.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"Similarity: {len(result)} chapters with matches.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build chapter similarity index.")
    parser.add_argument("data_dir", help="Root data directory")
    args = parser.parse_args()
    if not os.path.isdir(args.data_dir):
        print(f"Error: not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)
    build_similarity(args.data_dir)


if __name__ == "__main__":
    main()
