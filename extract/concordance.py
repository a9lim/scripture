#!/usr/bin/env python3
"""Build concordance index from extracted scripture data.

Usage::

    python3 concordance.py <data_dir>

Walks all ``<data_dir>/<workId>/`` directories, reads chapter files,
tokenizes verse text, and writes:

- ``<data_dir>/concordance.json`` — mapping of word → list of verse refs
"""

import argparse
import json
import os
import re
import sys

# Comprehensive English stopwords including archaic forms
STOPWORDS = {
    # Articles, conjunctions, prepositions
    "a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so",
    "at", "by", "in", "of", "on", "to", "up", "as", "is", "it",
    "be", "do", "if", "no", "not", "oh", "he", "me", "my", "we",
    "us", "am", "at",
    # Common pronouns
    "i", "you", "he", "she", "it", "we", "they", "them", "their",
    "this", "that", "these", "those", "who", "which", "what", "whose",
    "whom", "its", "our", "your", "his", "her", "my", "me", "him",
    "us", "all", "any", "each", "few", "more", "most", "other",
    "some", "such", "than", "too", "very",
    # Common verbs
    "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can", "need", "dare", "ought",
    "used", "get", "got", "go", "went", "come", "came", "make",
    "made", "know", "knew", "take", "took", "see", "saw", "think",
    "thought", "look", "want", "give", "gave", "use", "find", "tell",
    "ask", "seem", "feel", "try", "leave", "call", "keep", "let",
    "begin", "show", "hear", "put", "say", "said", "set",
    # Common adverbs and adjectives
    "also", "back", "even", "just", "now", "only", "then", "there",
    "well", "here", "how", "when", "where", "why", "again", "away",
    "down", "off", "out", "over", "still", "up", "about", "after",
    "before", "between", "into", "through", "under", "while", "with",
    "without", "around", "because", "both", "during", "from",
    "long", "never", "new", "old", "once", "own", "same", "since",
    "than", "though", "thus", "until", "upon", "whether", "within",
    # Prepositions
    "above", "across", "against", "along", "among", "around", "behind",
    "below", "beside", "besides", "beyond", "despite", "except",
    "inside", "instead", "outside", "toward", "towards", "underneath",
    # Numbers
    "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "first", "second", "third", "many", "much",
    # Archaic / scriptural forms
    "thee", "thou", "thy", "thine", "hath", "doth", "art", "wilt",
    "shalt", "saith", "canst", "wouldst", "shouldst", "couldst",
    "hast", "hadst", "didst", "wast", "wert", "tis", "twas",
    "thereof", "therein", "thereon", "thereunto", "therewith",
    "whereof", "wherein", "whereon", "whereunto", "wherewith",
    "whereby", "therefore", "wherefore", "therefrom", "heretofore",
    "unto", "ye", "yea", "nay", "verily", "behold", "lo",
    "hereunto", "herein", "hereof", "heretofore", "hereby",
    "withal", "thereof", "thence", "hence", "whence",
    # Other common words
    "come", "came", "brought", "bring", "brought", "again",
    "every", "full", "great", "good", "great", "high", "little",
    "like", "man", "men", "way", "day", "time", "made", "make",
    "place", "hand", "part", "right", "left", "said",
    "every", "after", "also", "even", "then", "now", "so",
    "thus", "therefore", "yet", "but", "and", "or", "nor",
    "whom", "whose", "whatever", "wherever", "whoever", "however",
    "else", "else", "neither", "either", "none", "another",
    "anything", "everything", "nothing", "something", "anyone",
    "everyone", "no", "not", "never", "always", "often", "sometimes",
    "already", "still", "yet", "soon", "later", "early", "late",
    "much", "more", "less", "least", "most", "enough",
    "together", "alone", "away", "forth", "back", "down", "up",
    "over", "under", "through", "across", "along", "among", "near",
    "far", "off", "out", "in", "on", "at", "by", "to", "from",
    "with", "without", "for", "about", "above", "below", "into",
    "onto", "upon", "within", "between", "against", "before",
    "after", "during", "since", "until", "while", "though",
    "although", "because", "if", "unless", "whether", "that",
    "which", "who", "what", "when", "where", "how", "why",
    "as", "like", "than", "such", "so", "too", "very", "quite",
    "rather", "just", "only", "even", "also", "both", "either",
    "neither", "each", "every", "all", "any", "some", "no",
    "other", "another", "same", "different", "own", "few", "many",
}

_TOKEN_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")


def build_concordance(data_dir: str) -> None:
    """Scan *data_dir* and emit concordance.json."""
    # Read works.json for ordering
    works_path = os.path.join(data_dir, "works.json")
    if os.path.isfile(works_path):
        with open(works_path, "r", encoding="utf-8") as f:
            work_order = json.load(f)
    else:
        work_order = []

    # Collect all work dirs, use works.json order then append any others
    all_dirs = [
        e for e in os.listdir(data_dir)
        if os.path.isdir(os.path.join(data_dir, e))
        and os.path.isfile(os.path.join(data_dir, e, "manifest.json"))
    ]
    ordered_works = [w for w in work_order if w in all_dirs]
    ordered_set = set(ordered_works)
    ordered_works += [w for w in sorted(all_dirs) if w not in ordered_set]

    concordance: dict[str, list[str]] = {}
    total_refs = 0

    for work_id in ordered_works:
        work_dir = os.path.join(data_dir, work_id)
        chapters_dir = os.path.join(work_dir, "chapters")
        if not os.path.isdir(chapters_dir):
            continue

        for chapter_file in sorted(os.listdir(chapters_dir)):
            if not chapter_file.endswith(".json"):
                continue

            chapter_path = os.path.join(chapters_dir, chapter_file)
            with open(chapter_path, "r", encoding="utf-8") as f:
                chapter = json.load(f)

            chapter_id = chapter_file[:-5]  # strip .json

            for section in chapter.get("sections", []):
                for i, text in enumerate(section.get("verses", [])):
                    verse_num = section["startVerse"] + i
                    text = text.lower()
                    ref = f"{work_id}:{chapter_id}:{verse_num}"

                    # Tokenize, deduplicate words per verse
                    tokens = set(_TOKEN_RE.findall(text))
                    for word in tokens:
                        if len(word) <= 1:
                            continue
                        if word in STOPWORDS:
                            continue
                        if word not in concordance:
                            concordance[word] = []
                        concordance[word].append(ref)
                        total_refs += 1

    # Sort alphabetically
    sorted_concordance = dict(sorted(concordance.items()))

    out_path = os.path.join(data_dir, "concordance.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sorted_concordance, f, ensure_ascii=False, indent=2)

    print(f"Concordance: {len(sorted_concordance)} words, {total_refs} total references.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build concordance index from extracted scripture data."
    )
    parser.add_argument(
        "data_dir",
        help="Root data directory containing work subdirectories",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.data_dir):
        print(f"Error: directory not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)

    build_concordance(args.data_dir)


if __name__ == "__main__":
    main()
