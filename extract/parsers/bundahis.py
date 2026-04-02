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

            verses = self._extract_verses(body)
            if not verses:
                continue

            chapters.append({
                "chapter": ch_num,
                "id": f"bund-{ch_num}",
                "name": self._extract_name(verses),
                "sections": [{
                    "startVerse": verses[0]["number"],
                    "verses": verses,
                }],
            })

        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "west", "name": "Edward William West", "year": 1897}
            ],
            "books": [{
                "id": "bund",
                "name": "Bundahishn",
                "chapters": [
                    {
                        "id": ch["id"],
                        "name": ch.get("name"),
                        "verses": len(ch["sections"][0]["verses"]),
                    }
                    for ch in chapters
                ],
            }],
        }

        return [{
            "manifest": manifest,
            "chapters": chapters,
        }]

    @staticmethod
    def _extract_name(verses):
        """If verse 0 exists, use it as the chapter subtitle and remove it."""
        if verses and verses[0]["number"] == 0:
            name = verses.pop(0)["text"].rstrip(".")
            # Update startVerse since verse 0 was removed
            return name
        return None

    def _extract_verses(self, body):
        """Split body into numbered verses using sequential markers."""
        markers = list(_VERSE_RE.finditer(body))
        if not markers:
            return []

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

        verses = []
        for i, m in enumerate(filtered):
            vnum = int(m.group(1))
            start = m.end()
            end = filtered[i + 1].start() if i + 1 < len(filtered) else len(body)
            vtext = body[start:end].strip()
            vtext = self.clean_text(vtext)
            if vtext:
                verses.append({"number": vnum, "text": vtext})

        return verses
