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

ABBREVS = {
    'gen': 'Gen.', 'ex': 'Ex.', 'lev': 'Lev.', 'num': 'Num.',
    'deut': 'Deut.', 'josh': 'Josh.', 'judg': 'Judg.', 'ruth': 'Ruth',
    '1-sam': '1 Sam.', '2-sam': '2 Sam.', '1-kgs': '1 Kgs.', '2-kgs': '2 Kgs.',
    '1-chr': '1 Chr.', '2-chr': '2 Chr.', 'ezra': 'Ezra', 'neh': 'Neh.',
    'esth': 'Esth.', 'job': 'Job', 'ps': 'Ps.', 'prov': 'Prov.',
    'eccl': 'Eccl.', 'song': 'Song', 'isa': 'Isa.', 'jer': 'Jer.',
    'lam': 'Lam.', 'ezek': 'Ezek.', 'dan': 'Dan.', 'hosea': 'Hosea',
    'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obad.', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'hab': 'Hab.', 'zeph': 'Zeph.',
    'hag': 'Hag.', 'zech': 'Zech.', 'mal': 'Mal.',
    'matt': 'Matt.', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
    'acts': 'Acts', 'rom': 'Rom.', '1-cor': '1 Cor.', '2-cor': '2 Cor.',
    'gal': 'Gal.', 'eph': 'Eph.', 'philip': 'Philip.', 'col': 'Col.',
    '1-thes': '1 Thes.', '2-thes': '2 Thes.', '1-tim': '1 Tim.',
    '2-tim': '2 Tim.', 'titus': 'Titus', 'philem': 'Philem.',
    'heb': 'Heb.', 'james': 'James', '1-pet': '1 Pet.', '2-pet': '2 Pet.',
    '1-jn': '1 Jn.', '2-jn': '2 Jn.', '3-jn': '3 Jn.', 'jude': 'Jude',
    'rev': 'Rev.',
    '1-ne': '1 Ne.', '2-ne': '2 Ne.', 'jacob': 'Jacob', 'enos': 'Enos',
    'jarom': 'Jarom', 'omni': 'Omni', 'w-of-m': 'W of M',
    'mosiah': 'Mosiah', 'alma': 'Alma', 'hel': 'Hel.', '3-ne': '3 Ne.',
    '4-ne': '4 Ne.', 'morm': 'Morm.', 'ether': 'Ether', 'moro': 'Moro.',
    'dc': 'D&C', 'od': 'OD',
    'moses': 'Moses', 'abr': 'Abr.', 'js-m': 'JS\u2014M',
    'js-h': 'JS\u2014H', 'a-of-f': 'A of F',
    'quran': 'Quran',
    'tobit': 'Tobit', 'judith': 'Judith', 'add-esth': 'Add. Esth.',
    'wis': 'Wis.', 'sir': 'Sir.', 'bar': 'Bar.', 'pr-azar': 'Pr. Azar.',
    'sus': 'Sus.', 'bel': 'Bel', '1-macc': '1 Macc.', '2-macc': '2 Macc.',
    '1-esd': '1 Esd.', 'pr-man': 'Pr. Man.', '2-esd': '2 Esd.',
    'gl': 'G.L.', 'dom': 'D.M.', 'analects': 'Analects', 'mencius': 'Mencius',
    'ttc': 'T.T.C.',
    'kjk': 'Kami.', 'kjn': 'Naka.', 'kjs': 'Shimo.',
    'bund': 'Bund.',
    'lotus': 'Lotus',
    'viraf': 'Viraf',
    'guofeng': 'G.F.', 'xiaoya': 'X.Y.', 'daya': 'D.Y.', 'hymns': 'Hymns',
    'kv': 'Kal.',
    'poe-gods': 'Gods', 'poe-heroes': 'Heroes',
}

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
        # Strip leading all-caps title lines (chapter subtitles)
        while lines and lines[0].strip() and lines[0].strip() == lines[0].strip().upper():
            lines = lines[1:]
        sections = _parse_sections(lines)
        if not sections or all(not s["verses"] for s in sections):
            continue
        # Normalize all-caps first words (drop-cap convention)
        first_sec = sections[0]
        if first_sec["verses"]:
            first_sec["verses"][0] = BaseParser.normalize_caps_first_words(
                first_sec["verses"][0]
            )
        chapters.append(
            {
                "_id": f"{book_id}-{ch_num}",
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
    return {
        "startVerse": 1,
        "verses": verses,
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
        "abbrev": ABBREVS.get(args.book_id, args.book_id),
        "chapters": len(chapters),
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
        ch_id = stripped.pop('_id')
        ch_path = os.path.join(chapters_dir, f"{ch_id}.json")
        with open(ch_path, "w", encoding="utf-8") as f:
            json.dump(stripped, f, ensure_ascii=False, indent=2)

    print(f"  Wrote {len(chapters)} chapter files to {chapters_dir}/")
    print("Done.")


if __name__ == "__main__":
    main()
