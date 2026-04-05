#!/usr/bin/env python3
"""Convert scripture text files back to JSON.

Reads the text format produced by json_to_txt.py and converts back to the
standard JSON structure (manifest, chapters).

Text format::

    WORK: id | Title
    TRANSLATION: id | Name | Year
    BOOK: id | Name
    CHAPTER: [name]
    > intro text
    SECTION:                       section break (numbering continues)
    SECTION: @                     section break, reset verse numbering to 1
    SECTION: @ 4                   section break, start verse numbering at 4
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
            current_book = {'id': m.group(1), 'name': m.group(2)}
            books.append(current_book)
            continue

        # Chapter start offset: START: N
        if line.startswith('START:') and current_book is not None:
            num = int(line[len('START:'):].strip())
            current_book['_start'] = num
            continue

        # Chapter header
        if line.startswith('CHAPTER:'):
            if current_chapter is not None:
                _flush_chapter(current_chapter, current_section, chapters, current_book)

            ch_name = line[len('CHAPTER:'):].strip() or None
            ch_idx = current_book.get('_count', 0) if current_book else 0
            ch_start = current_book.get('_start', 1) if current_book else 1
            ch_num = ch_start + ch_idx
            ch_id = f"{current_book['id']}-{ch_num}" if current_book else f"ch-{ch_num}"

            current_chapter = {
                '_id': ch_id,
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

        # Section break: SECTION:, SECTION: @, SECTION: @ N
        if line.startswith('SECTION:') and current_chapter is not None:
            rest = line[len('SECTION:'):].strip()
            if rest.startswith('@'):
                num_part = rest[1:].strip()
                current_chapter['_next_verse'] = int(num_part) if num_part else 1
            start = current_chapter.get('_next_verse', 1)
            current_section = {'startVerse': start, 'verses': []}
            current_chapter['_sections'].append(current_section)
            continue

        # Verse line (any line not matching other patterns)
        if current_chapter is not None:
            if current_section is None:
                start = current_chapter.get('_next_verse', 1)
                current_section = {'startVerse': start, 'verses': []}
                current_chapter['_sections'].append(current_section)

            current_chapter['_next_verse'] = current_section['startVerse'] + len(current_section['verses']) + 1

            current_section['verses'].append(line)

    # Flush last chapter
    if current_chapter is not None:
        _flush_chapter(current_chapter, current_section, chapters, current_book)

    # Build manifest — convert books from tracking dicts to final format
    final_books = []
    for book in books:
        b = {'id': book['id'], 'name': book['name']}
        b['abbrev'] = ABBREVS.get(book['id'], book['id'])
        b['chapters'] = book.get('_count', 0)
        start = book.get('_start')
        if start is not None and start != 1:
            b['start'] = start
        names = book.get('_names')
        if names:
            # Only include names if at least one is non-None
            if any(n is not None for n in names):
                b['names'] = names
        final_books.append(b)

    manifest = {'id': work_id, 'title': work_title}
    if translations:
        manifest['translations'] = translations
    manifest['books'] = final_books

    return [{
        'manifest': manifest,
        'chapters': chapters,
    }]


def _flush_chapter(current_chapter, current_section, chapters, current_book):
    """Finalize a chapter dict and append to chapters list + book metadata."""
    ch_id = current_chapter['_id']

    sections = current_chapter['_sections']

    ch_name = current_chapter.get('name')

    chapter = {'_id': ch_id}
    if ch_name:
        chapter['name'] = ch_name
    if current_chapter.get('intro'):
        chapter['intro'] = current_chapter['intro']
    chapter['sections'] = sections

    chapters.append(chapter)

    # Update book tracking metadata
    count = current_book.get('_count', 0)
    if count == 0:
        # First chapter: record start from ch_id suffix
        suffix = ch_id.rsplit('-', 1)[-1]
        if suffix.isdigit():
            current_book['_start'] = int(suffix)
    current_book['_count'] = count + 1

    if ch_name:
        names = current_book.setdefault('_names', [])
        # Pad with None for any gaps
        while len(names) < count:
            names.append(None)
        names.append(ch_name)
    elif '_names' in current_book:
        # Keep the list in sync even when no name
        current_book['_names'].append(None)

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
