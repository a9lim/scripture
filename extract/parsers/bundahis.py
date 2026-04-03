"""Parser for West's Bundahishn translation (avesta.org plaintext).

Reads a cleaned plaintext of E. W. West's 1897 translation from Sacred
Books of the East, Volume 5.  34 chapters with inline verse numbering
(``N. text``).

Produces one work (``bund``) with one book.
"""

import re

from base_parser import BaseParser

# Chapter heading: "CHAPTER N." optionally followed by title text
_CHAPTER_RE = re.compile(r"^CHAPTER\s+(\d+)\.(.*)$", re.MULTILINE)

# Verse marker: "N. " inline or at paragraph start
_VERSE_RE = re.compile(r"(?:^|\s)(\d+)[.,]\s")


class BundahisParser(BaseParser):
    WORK_ID = "bund"
    WORK_TITLE = "Bundahishn"

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        ch_matches = list(_CHAPTER_RE.finditer(text))
        chapters = []

        for i, m in enumerate(ch_matches):
            ch_num = int(m.group(1))
            body_start = m.end()
            body_end = ch_matches[i + 1].start() if i + 1 < len(ch_matches) else len(text)
            body = text[body_start:body_end].strip()

            # Strip square brackets before collapsing — they interfere
            # with verse-number detection (e.g. "[2. text")
            body = re.sub(r"[\[\]]", "", body)
            # Remove parenthesized text (disambiguations / Avestan terms)
            body = re.sub(r"\s*\([^)]*\)", "", body)
            # Collapse newlines into spaces (paragraphs are separated by
            # blank lines but verses span across them)
            body = re.sub(r"\s+", " ", body).strip()

            start_verse, name, verses = self._extract_verses(body)
            if not verses:
                continue

            chapters.append({
                "_id": f"bund-{ch_num}",
                "name": name,
                "sections": [{
                    "startVerse": start_verse,
                    "verses": verses,
                }],
            })

        names = [ch.get("name") for ch in chapters]
        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "west", "name": "Edward William West", "year": 1897}
            ],
            "books": [{
                "id": "bund",
                "name": "Bundahishn",
                "abbrev": "Bund.",
                "chapters": len(chapters),
                "names": names,
            }],
        }

        return [{
            "manifest": manifest,
            "chapters": chapters,
        }]

    def _extract_verses(self, body):
        """Split body into numbered verses using sequential markers.

        Returns (start_verse, name_or_none, verse_strings).
        If verse 0 exists, it becomes the chapter name.
        """
        markers = list(_VERSE_RE.finditer(body))
        if not markers:
            return (1, None, [])

        # Filter to sequential verse numbers only
        filtered = []
        expect = int(markers[0].group(1))
        for m in markers:
            vnum = int(m.group(1))
            if vnum == expect:
                filtered.append(m)
                expect = vnum + 1
            elif not filtered:
                expect = vnum + 1
                filtered.append(m)

        raw = []
        for i, m in enumerate(filtered):
            vnum = int(m.group(1))
            start = m.end()
            end = filtered[i + 1].start() if i + 1 < len(filtered) else len(body)
            vtext = self.clean_text(body[start:end].strip())
            if vtext:
                raw.append((vnum, vtext))

        if not raw:
            return (1, None, [])

        # If verse 0 exists, extract it as the chapter name
        name = None
        if raw[0][0] == 0:
            name = raw.pop(0)[1].rstrip(".")

        if not raw:
            return (1, name, [])

        start_verse = raw[0][0]
        verses = [text for _num, text in raw]
        return (start_verse, name, verses)
