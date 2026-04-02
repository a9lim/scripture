#!/usr/bin/env python3
"""Parse a scraped sacred-texts.com raw text file into JSON.

Reads the ``=== CHAPTER N ===`` delimited format produced by
``scrape_sacred_texts.py`` and converts it to the standard JSON
data structure.

Within each chapter, verses are detected by ``N.`` markers at the
start of a line.  When verse numbers restart at 1, a new section is
created (common in works with sub-chapters per page).  If no verse
numbers are found, paragraphs are used as verses.

Can create a new work or add a book to an existing work.

Usage::

    # New standalone work
    python3 parse_scraped.py mencius_raw.txt --output ../data \\
        --work-id mencius --work-title Mencius \\
        --book-id mencius --book-name Mencius

    # Add book to existing work
    python3 parse_scraped.py mencius_raw.txt --output ../data \\
        --work-id fourbooks --book-id mencius --book-name Mencius
"""

import argparse
import json
import os
import re
import sys

_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)

from base_parser import BaseParser

_CHAPTER_RE = re.compile(r"^=== CHAPTER (\d+) ===$")
_VERSE_RE = re.compile(r"^(\d+)\.\s*(.*)")


def parse_chapters(text, book_id):
    """Split raw scraped text into chapter dicts."""
    # Split into chapter blocks
    blocks = []
    current_num = None
    current_lines = []

    for line in text.split("\n"):
        m = _CHAPTER_RE.match(line)
        if m:
            if current_num is not None:
                blocks.append((current_num, current_lines))
            current_num = int(m.group(1))
            current_lines = []
        else:
            current_lines.append(line)

    if current_num is not None:
        blocks.append((current_num, current_lines))

    chapters = []
    for ch_num, lines in blocks:
        sections = _parse_sections(lines)
        if not sections or all(not s["verses"] for s in sections):
            continue
        chapters.append(
            {
                "chapter": ch_num,
                "id": f"{book_id}-{ch_num}",
                "sections": sections,
            }
        )
    return chapters


def _parse_sections(lines):
    """Parse lines into sections with verses.

    Detects numbered verses (``N.`` pattern).  When verse numbers
    restart at 1, a new section begins.  Falls back to paragraph
    splitting if no verse markers are found.
    """
    # Check if the text has numbered verses at all
    has_verses = any(_VERSE_RE.match(line.strip()) for line in lines)

    if has_verses:
        return _parse_numbered(lines)
    return _parse_paragraphs(lines)


def _parse_numbered(lines):
    """Parse lines with ``N.`` verse markers into sections."""
    sections = []
    current_verses = []
    parts = []
    last_num = 0

    for line in lines:
        stripped = line.strip()
        m = _VERSE_RE.match(stripped)
        if m:
            num = int(m.group(1))
            # Verse number restart → new section
            if num <= last_num and current_verses:
                # Flush current verse
                if parts:
                    current_verses.append(" ".join(parts))
                    parts = []
                sections.append(_make_section(current_verses))
                current_verses = []
            elif parts:
                # Flush previous verse
                current_verses.append(" ".join(parts))
                parts = []

            last_num = num
            rest = m.group(2).strip()
            if rest:
                parts.append(rest)
        elif stripped:
            parts.append(stripped)

    # Flush remaining
    if parts:
        current_verses.append(" ".join(parts))
    if current_verses:
        sections.append(_make_section(current_verses))

    return sections


def _parse_paragraphs(lines):
    """Fall back to paragraph-based verse splitting."""
    verses = []
    parts = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if parts:
                verses.append(" ".join(parts))
                parts = []
        else:
            parts.append(stripped)

    if parts:
        verses.append(" ".join(parts))

    if not verses:
        return []
    return [_make_section(verses)]


def _make_section(verses):
    start = 1
    return {
        "startVerse": start,
        "verses": [
            {"number": start + i, "text": v} for i, v in enumerate(verses)
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Parse a scraped sacred-texts.com file into JSON."
    )
    parser.add_argument("source", help="Path to the scraped raw text file")
    parser.add_argument("--output", required=True, help="Output data directory")
    parser.add_argument("--work-id", required=True, help="Work ID (e.g. 'fourbooks')")
    parser.add_argument("--work-title", help="Work title (for new works)")
    parser.add_argument("--book-id", required=True, help="Book ID (e.g. 'mencius')")
    parser.add_argument("--book-name", required=True, help="Book display name")

    args = parser.parse_args()

    if not os.path.isfile(args.source):
        print(f"Error: source file not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    with open(args.source, encoding="utf-8") as f:
        text = f.read()

    print(f"Parsing {args.source}...")
    chapters = parse_chapters(text, args.book_id)
    print(f"  {len(chapters)} chapters, {sum(sum(len(s['verses']) for s in ch['sections']) for ch in chapters)} verses")

    # Build book metadata
    book_meta = {
        "id": args.book_id,
        "name": args.book_name,
        "chapters": [
            {
                "id": ch["id"],
                "name": str(ch["chapter"]),
                "verses": sum(len(s["verses"]) for s in ch["sections"]),
            }
            for ch in chapters
        ],
    }

    # Load or create manifest
    work_dir = os.path.join(args.output, args.work_id)
    manifest_path = os.path.join(work_dir, "manifest.json")

    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
        # Replace book if it already exists, otherwise append
        manifest["books"] = [
            b for b in manifest["books"] if b["id"] != args.book_id
        ]
        manifest["books"].append(book_meta)
        print(f"  Updated existing work '{args.work_id}'")
    else:
        if not args.work_title:
            print("Error: --work-title required for new works", file=sys.stderr)
            sys.exit(1)
        manifest = {
            "id": args.work_id,
            "title": args.work_title,
            "books": [book_meta],
        }
        print(f"  Created new work '{args.work_id}'")

    # Write output
    writer = BaseParser()

    work = {
        "manifest": manifest,
        "chapters": chapters,
    }

    # For existing works, we only want to write the new book's chapters
    # plus the updated manifest — not overwrite other books' chapters.
    os.makedirs(work_dir, exist_ok=True)
    chapters_dir = os.path.join(work_dir, "chapters")
    os.makedirs(chapters_dir, exist_ok=True)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(writer._strip_manifest(manifest), f, ensure_ascii=False, indent=2)

    # Only write glossary if new work
    gl_path = os.path.join(work_dir, "glossary.json")
    if not os.path.exists(gl_path):
        with open(gl_path, "w", encoding="utf-8") as f:
            json.dump([], f)

    for ch in chapters:
        stripped = writer._strip_chapter(ch)
        ch_path = os.path.join(chapters_dir, f"{stripped['id']}.json")
        with open(ch_path, "w", encoding="utf-8") as f:
            json.dump(stripped, f, ensure_ascii=False, indent=2)

    print(f"  Wrote {len(chapters)} chapter files to {chapters_dir}/")
    print("Done.")


if __name__ == "__main__":
    main()
