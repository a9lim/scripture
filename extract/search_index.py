#!/usr/bin/env python3
"""Build search index and works list from extracted scripture data.

Usage::

    python3 search_index.py <data_dir>

Walks all ``<data_dir>/<workId>/`` directories, reads manifests and
chapter files, and writes:

- ``<data_dir>/works.json``        — array of work IDs
- ``<data_dir>/search-index.json`` — flat array of verse references
"""

import argparse
import json
import os
import sys


def build_index(data_dir: str) -> None:
    """Scan *data_dir* and emit works.json + search-index.json."""
    works: list[str] = []
    index: list[dict] = []

    for entry in sorted(os.listdir(data_dir)):
        work_dir = os.path.join(data_dir, entry)
        manifest_path = os.path.join(work_dir, "manifest.json")

        if not os.path.isdir(work_dir) or not os.path.isfile(manifest_path):
            continue

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        work_id = manifest["id"]
        works.append(work_id)

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
                    ref = f"{work_id}:{chapter_id}:{verse_num}"
                    index.append({"ref": ref, "text": text})

    # Preserve existing works.json ordering, appending any new works
    works_path = os.path.join(data_dir, "works.json")
    existing = []
    if os.path.isfile(works_path):
        with open(works_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    works_set = set(works)
    ordered = [w for w in existing if w in works_set]
    ordered_set = set(ordered)
    ordered += [w for w in works if w not in ordered_set]

    with open(works_path, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    with open(os.path.join(data_dir, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"Indexed {len(works)} works, {len(index)} verses.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build search index from extracted scripture data."
    )
    parser.add_argument(
        "data_dir",
        help="Root data directory containing work subdirectories",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.data_dir):
        print(f"Error: directory not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)

    build_index(args.data_dir)


if __name__ == "__main__":
    main()
