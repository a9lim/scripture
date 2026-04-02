#!/usr/bin/env python3
"""Convert scripture text files back to JSON.

Reads the text format produced by json_to_txt.py and converts back to the
standard JSON structure (manifest, chapters).

Text format::

    WORK: id | Title
    TRANSLATION: id | Name | Year
    BOOK: id | Name
    CHAPTER: id [| name]
    > intro text
    ~                              section break (numbering continues)
    ~ @                            section break, reset verse numbering to 1
    ~ @ 4                          section break, start verse numbering at 4
    verse text

Usage::

    python3 txt_to_json.py <text_file> --output <dir>
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


def parse_txt(txt_path: str) -> list[dict]:
    """Parse a scripture text file into work dicts."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    work_id = None
    work_title = None
    translations = []
    books = []
    chapters = []
    current_book = None
    current_chapter = None
    current_section = None

    for line in raw.split('\n'):
        if not line:
            continue

        # Work header
        if line.startswith('WORK:'):
            m = re.match(r'^WORK:\s*(.+?)\s*\|\s*(.+?)\s*$', line)
            work_id = m.group(1)
            work_title = m.group(2)
            continue

        # Translation
        if line.startswith('TRANSLATION:'):
            m = re.match(r'^TRANSLATION:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*$', line)
            translations.append({
                'id': m.group(1),
                'name': m.group(2),
                'year': int(m.group(3))
            })
            continue

        # Book header
        if line.startswith('BOOK:'):
            if current_chapter is not None:
                _flush_chapter(current_chapter, current_section, chapters, current_book)
                current_chapter = None
                current_section = None
            m = re.match(r'^BOOK:\s*(.+?)\s*\|\s*(.+?)\s*$', line)
            current_book = {'id': m.group(1), 'name': m.group(2), 'chapters': []}
            books.append(current_book)
            continue

        # Chapter header
        if line.startswith('CHAPTER:'):
            if current_chapter is not None:
                _flush_chapter(current_chapter, current_section, chapters, current_book)

            m = re.match(r'^CHAPTER:\s*(.+?)(?:\s*\|\s*(.+?))?\s*$', line)
            ch_id = m.group(1)
            ch_name = m.group(2)  # None when no descriptive name
            ch_num_m = re.search(r'(\d+)$', ch_id)
            ch_num = int(ch_num_m.group(1)) if ch_num_m else 1

            current_chapter = {
                'chapter': ch_num,
                'id': ch_id,
                '_next_verse': 1,
            }
            if ch_name:
                current_chapter['name'] = ch_name
            current_chapter['_sections'] = []
            current_section = None
            continue

        # Intro
        if line.startswith('> ') and current_chapter is not None:
            current_chapter['intro'] = line[2:]
            continue

        # Standalone verse numbering: @ or @ N
        if line.startswith('@') and not line.startswith('@@') and current_chapter is not None:
            num_part = line[1:].strip()
            current_chapter['_next_verse'] = int(num_part) if num_part else 1
            continue

        # Section break: ~, ~ @, ~ @ N
        if line.startswith('~') and current_chapter is not None:
            rest = line[1:].strip()
            if rest.startswith('@'):
                num_part = rest[1:].strip()
                current_chapter['_next_verse'] = int(num_part) if num_part else 1
            current_section = {'verses': []}
            current_chapter['_sections'].append(current_section)
            continue

        # Verse line (any line not matching other patterns)
        if current_chapter is not None:
            if current_section is None:
                current_section = {'verses': []}
                current_chapter['_sections'].append(current_section)

            verse_num = current_chapter.get('_next_verse', 1)
            current_chapter['_next_verse'] = verse_num + 1

            current_section['verses'].append({
                'number': verse_num,
                'text': line,
            })

    # Flush last chapter
    if current_chapter is not None:
        _flush_chapter(current_chapter, current_section, chapters, current_book)

    # Build manifest
    manifest = {'id': work_id, 'title': work_title}
    if translations:
        manifest['translations'] = translations
    manifest['books'] = books

    return [{
        'manifest': manifest,
        'chapters': chapters,
    }]


def _flush_chapter(current_chapter, current_section, chapters, current_book):
    """Finalize a chapter dict and append to chapters list + book metadata."""
    ch_id = current_chapter['id']

    sections = []
    for sec in current_chapter['_sections']:
        start = sec['verses'][0]['number'] if sec['verses'] else 1
        sections.append({
            'startVerse': start,
            'verses': sec['verses'],
        })

    ch_name = current_chapter.get('name')

    chapter = {
        'chapter': current_chapter['chapter'],
        'id': ch_id,
    }
    if ch_name:
        chapter['name'] = ch_name
    if current_chapter.get('intro'):
        chapter['intro'] = current_chapter['intro']
    chapter['sections'] = sections

    chapters.append(chapter)

    total_verses = sum(len(s['verses']) for s in sections)
    ch_meta = {'id': ch_id}
    if ch_name:
        ch_meta['name'] = ch_name
    ch_meta['verses'] = total_verses
    current_book['chapters'].append(ch_meta)

    del current_chapter['_sections']
    current_chapter.pop('_next_verse', None)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a scripture text file to JSON data."
    )
    parser.add_argument("source", help="Path to the scripture text file")
    parser.add_argument(
        "--output", required=True,
        help="Output directory for JSON files",
    )

    args = parser.parse_args()

    if not os.path.isfile(args.source):
        print(f"Error: source file not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    print(f"Parsing {args.source}...")
    works = parse_txt(args.source)

    print(f"Writing output to {args.output}/")
    writer = BaseParser()
    writer.write_output(works, args.output)

    for work in works:
        wid = work['manifest']['id']
        n_ch = len(work['chapters'])
        print(f"  {wid}: {n_ch} chapters")

    total = sum(len(w['chapters']) for w in works)
    print(f"Done: {total} chapters across {len(works)} work(s).")


if __name__ == "__main__":
    main()
