"""Parser for the Arda Viraf Namag (sacred-texts.com plaintext).

Reads a cleaned plaintext of Haug & West's translation.  101 chapters
with inline verse numbering (``N.`` markers, ``(N)`` sub-verse
continuations).

Produces one work (``viraf``) with one book.
"""

import re
from base_parser import BaseParser

# Chapter heading: "CHAPTER N" or "Chapter N." optionally followed by bracketed description
_CHAPTER_RE = re.compile(
    r"^(?:CHAPTER|Chapter)\s+(\d+)\.?(.*)$", re.MULTILINE
)

# Verse marker: "N." at the start of a line (possibly after whitespace)
_VERSE_RE = re.compile(r"^(\d+)\.\s*(.*)")

# Sub-verse marker: "(N)" inline — these continue the current verse
_SUBVERSE_RE = re.compile(r"\((\d+)\)\s*")

# Part headers like "[Part 1. Introduction.]" or "Part 5. Epilogue"
_PART_RE = re.compile(r"^\[?Part \d+\..*?\]?\s*$")

# Page markers
_PAGE_RE = re.compile(r"\[p\.\s*\w+\]")


class VirafParser(BaseParser):
    WORK_ID = "viraf"
    WORK_TITLE = "Arda Viraf"

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        ch_matches = list(_CHAPTER_RE.finditer(text))
        chapters = []

        for i, m in enumerate(ch_matches):
            ch_num = int(m.group(1))
            desc = m.group(2).strip()
            # Extract name from bracketed description
            bm = re.search(r"\[(.+?)\]", desc)
            name = bm.group(1).strip() if bm else None

            body_start = m.end()
            body_end = (
                ch_matches[i + 1].start() if i + 1 < len(ch_matches) else len(text)
            )
            body = text[body_start:body_end].strip()

            # Remove Part headers
            body = _PART_RE.sub("", body)
            # Remove page markers
            body = _PAGE_RE.sub("", body)

            verses = self._parse_verses(body)
            if not verses:
                continue
            verses = [self.strip_parenthesized(v) for v in verses]
            verses[0] = self.normalize_caps_first_words(verses[0])

            chapters.append({
                "_id": f"viraf-{ch_num}",
                "name": name,
                "sections": [BaseParser.make_section(verses)],
            })

        names = [ch.get("name") for ch in chapters]
        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "haug-west", "name": "Martin Haug & Edward William West", "year": 1872}
            ],
            "books": [{
                "id": "viraf",
                "name": "Arda Viraf",
                "abbrev": "Viraf",
                "chapters": len(chapters),
                "names": names,
            }],
        }

        return [{
            "manifest": manifest,
            "chapters": chapters,
        }]

    def _parse_verses(self, body):
        """Parse body text into verses.

        Numbered verses start with ``N.`` at the beginning of a line.
        Sub-verse markers ``(N)`` are inline continuations — their text
        is merged into the current verse.
        """
        verses = []
        current_parts = []

        for line in body.split("\n"):
            stripped = line.strip()
            if not stripped:
                continue

            m = _VERSE_RE.match(stripped)
            if m:
                # Flush previous verse
                if current_parts:
                    verses.append(self._join_verse(current_parts))
                    current_parts = []

                rest = m.group(2).strip()
                if rest:
                    current_parts.append(rest)
            elif stripped:
                current_parts.append(stripped)

        # Flush remaining
        if current_parts:
            verses.append(self._join_verse(current_parts))

        return verses

    def _join_verse(self, parts):
        """Join parts and clean sub-verse markers."""
        text = " ".join(parts)
        # Remove sub-verse markers (N) but keep their text
        text = _SUBVERSE_RE.sub("", text)
        return self.clean_text(text)
