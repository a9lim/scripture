"""Plaintext KJV Bible parser (VPL format).

Parses a verse-per-line file with format ``BOOK CH:VS text`` into one work:
  - apocrypha (Tobit–2 Esdras)

No PDF required — overrides ``parse()`` to read plaintext directly.
"""

import re
from collections import OrderedDict

from base_parser import BaseParser

# ---------------------------------------------------------------------------
# Abbreviation → full name mapping (order = canonical order in file)
# ---------------------------------------------------------------------------
_APOC_BOOKS = OrderedDict([
    ("TOB", "Tobit"), ("JDT", "Judith"),
    ("ESG", "Additions to Esther"), ("WIS", "Wisdom of Solomon"),
    ("SIR", "Sirach"), ("BAR", "Baruch"),
    ("PRA", "Prayer of Azariah"), ("SUS", "Susanna"),
    ("BEL", "Bel and the Dragon"), ("1MA", "1 Maccabees"),
    ("2MA", "2 Maccabees"), ("1ES", "1 Esdras"),
    ("PRM", "Prayer of Manasseh"), ("4ES", "2 Esdras"),
])

# VPL abbreviation → abbreviated book ID (matches frontend BOOKS map)
_BOOK_IDS = {
    "TOB": "tobit", "JDT": "judith", "ESG": "add-esth", "WIS": "wis", "SIR": "sir",
    "BAR": "bar", "PRA": "pr-azar", "SUS": "sus", "BEL": "bel", "1MA": "1-macc",
    "2MA": "2-macc", "1ES": "1-esd", "PRM": "pr-man", "4ES": "2-esd",
}

_RE_LINE = re.compile(r"^(\w+)\s+(\d+):(\d+)\s+(.*)$")


class KjvVplParser(BaseParser):
    """Parser for verse-per-line KJV plaintext files."""

    def parse(self, txt_path: str) -> list[dict]:
        with open(txt_path, encoding="utf-8") as f:
            lines = f.readlines()

        # Group verses by (book_abbrev, chapter_num)
        raw: dict[str, dict[int, list[tuple[int, str]]]] = {}
        for line in lines:
            m = _RE_LINE.match(line.strip())
            if not m:
                continue
            abbrev, ch_s, vs_s, text = m.groups()
            ch, vs = int(ch_s), int(vs_s)
            raw.setdefault(abbrev, {}).setdefault(ch, []).append((vs, text))

        chapters = []
        manifest_books = []
        for abbrev, book_name in _APOC_BOOKS.items():
            if abbrev not in raw:
                continue
            book_slug = _BOOK_IDS.get(abbrev, self.slugify(book_name))
            book_chapters_meta = []
            for ch_num in sorted(raw[abbrev]):
                verses_raw = raw[abbrev][ch_num]
                ch_id = f"{book_slug}-{ch_num}"
                verses = [
                    {"number": vs, "text": BaseParser.clean_text(BaseParser.normalize_divine_names(txt))}
                    for vs, txt in sorted(verses_raw)
                ]
                chapters.append({
                    "chapter": ch_num,
                    "id": ch_id,
                    "sections": [{
                        "startVerse": verses[0]["number"] if verses else 1,
                        "verses": verses,
                    }],
                })
                book_chapters_meta.append({
                    "id": ch_id,
                    "verses": len(verses),
                })
            manifest_books.append({
                "id": book_slug,
                "name": book_name,
                "chapters": book_chapters_meta,
            })
        manifest = {
            "id": "apoc",
            "title": "Apocrypha",
            "translations": [{"id": "kjv", "name": "King James Version", "year": 1769}],
            "books": manifest_books,
        }
        return [{"manifest": manifest, "chapters": chapters}]
