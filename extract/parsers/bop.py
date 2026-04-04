"""Parser for the Book of Poetry / Shijing (Legge translation, sacred-texts.com).

Reads the plaintext of James Legge's 1876 translation.  The text is
organized into 4 Parts, each containing numbered poems (Roman numerals).
Each poem has ``[N]`` verse markers for stanzas.

Produces one work (``bop``) with four books matching the traditional
Chinese divisions: Guofeng, Xiaoya, Daya, Song.
"""

import re
from base_parser import BaseParser

# Noise patterns
_PAGE_RE = re.compile(r"\[p\.\s*\d+\]")
_BOILERPLATE_RE = re.compile(
    r"^\s*The Book of Poetry,.*?sacred-texts\.com\s*$", re.MULTILINE
)

# Verse marker: [1], [2], etc. (also handles HTML entities like [1&nbsp;&nbsp;])
_VERSE_RE = re.compile(r"\[(\d+)(?:&nbsp;)*\s*\]")

# Part headers
_PART_RE = re.compile(r"^PART\s+([IVXLC]+)\s*$")

# Roman numeral poem header (standalone line)
_ROMAN_RE = re.compile(r"^([IVXLC]+)\s*$")

# BOOK / SECTION / DECADE headers (organizational, used for context)
_BOOK_RE = re.compile(r"^BOOK\s+[IVXLC]+\.?\s*(.*)", re.IGNORECASE)
_SECTION_RE = re.compile(r"^SECTION\s+[IVXLC]+\.?\s*(.*)", re.IGNORECASE)

# Roman numeral conversion
_ROMAN_VALS = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def _roman_to_int(s):
    result = 0
    prev = 0
    for c in reversed(s):
        val = _ROMAN_VALS.get(c, 0)
        if val < prev:
            result -= val
        else:
            result += val
        prev = val
    return result


class BopParser(BaseParser):
    WORK_ID = "bop"
    WORK_TITLE = "Book of Poetry"

    _BOOKS = [
        ("guofeng", "Guofeng", "G.F."),
        ("xiaoya", "Xiaoya", "X.Y."),
        ("daya", "Daya", "D.Y."),
        ("song", "Song", "Song"),
    ]

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Clean page markers and boilerplate
        text = _PAGE_RE.sub("", text)
        text = _BOILERPLATE_RE.sub("", text)

        # Split into parts
        parts = self._split_parts(text)

        all_chapters = []
        books_meta = []

        for part_idx, (book_id, book_name, abbrev) in enumerate(self._BOOKS):
            if part_idx >= len(parts):
                break

            poems = self._split_poems(parts[part_idx])
            chapters = []

            for poem_num, (title, body) in enumerate(poems, 1):
                verses = self._parse_verses(body)
                if not verses:
                    continue
                chapters.append({
                    "_id": f"{book_id}-{poem_num}",
                    "name": title,
                    "sections": [BaseParser.make_section(verses)],
                })

            all_chapters.extend(chapters)
            books_meta.append({
                "id": book_id,
                "name": book_name,
                "abbrev": abbrev,
                "chapters": len(chapters),
                "names": [ch.get("name") for ch in chapters],
            })

        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "legge", "name": "James Legge", "year": 1876}
            ],
            "books": books_meta,
        }

        return [{
            "manifest": manifest,
            "chapters": all_chapters,
        }]

    def _split_parts(self, text):
        """Split text into 4 parts at PART headers."""
        lines = text.split("\n")
        part_starts = []
        for i, line in enumerate(lines):
            if _PART_RE.match(line.strip()):
                part_starts.append(i)

        parts = []
        for j, start in enumerate(part_starts):
            end = part_starts[j + 1] if j + 1 < len(part_starts) else len(lines)
            parts.append("\n".join(lines[start:end]))
        return parts

    def _split_poems(self, part_text):
        """Split a part into poems at Roman numeral headers.

        Returns list of (title, body) tuples.
        """
        lines = part_text.split("\n")
        poems = []
        current_body_lines = []
        current_title = None
        in_poem = False

        for i, line in enumerate(lines):
            stripped = line.strip()

            # Skip organizational headers (BOOK, SECTION, DECADE, PART)
            if (_BOOK_RE.match(stripped) or _SECTION_RE.match(stripped)
                    or _PART_RE.match(stripped)):
                continue

            # Check for Roman numeral poem header
            if _ROMAN_RE.match(stripped):
                # Flush previous poem
                if in_poem and current_body_lines:
                    poems.append((current_title, "\n".join(current_body_lines)))

                current_body_lines = []
                current_title = None
                in_poem = True
                continue

            if in_poem:
                # The first non-empty line after a Roman numeral is the
                # description/title line
                if current_title is None and stripped:
                    # Extract title: text before semicolon, or first sentence
                    title = stripped.split(";")[0].strip()
                    # Remove "The " prefix for cleaner names
                    if title.startswith("The "):
                        title = title[4:]
                    current_title = title
                elif stripped:
                    current_body_lines.append(stripped)

        # Flush last poem
        if in_poem and current_body_lines:
            poems.append((current_title, "\n".join(current_body_lines)))

        return poems

    def _parse_verses(self, body):
        """Parse poem body into verses using [N] markers.

        Falls back to stanza-based splitting if no markers found.
        """
        if _VERSE_RE.search(body):
            return self._parse_numbered(body)
        return self._parse_stanzas(body)

    def _parse_numbered(self, body):
        """Split on [N] markers, collecting text between them."""
        # Split body at verse markers
        parts = _VERSE_RE.split(body)
        # parts alternates: text_before, num, text, num, text, ...
        verses = []
        i = 1  # skip text before first marker
        while i < len(parts):
            # parts[i] is the number, parts[i+1] is the text
            if i + 1 < len(parts):
                text = parts[i + 1].strip()
                # Join lines and clean
                text = re.sub(r"\s+", " ", text).strip()
                text = self.clean_text(text)
                if text:
                    verses.append(text)
            i += 2
        return verses

    def _parse_stanzas(self, body):
        """Fall back to blank-line-separated stanzas as verses."""
        verses = []
        current = []
        for line in body.split("\n"):
            stripped = line.strip()
            if not stripped:
                if current:
                    text = " ".join(current)
                    text = self.clean_text(text)
                    if text:
                        verses.append(text)
                    current = []
            else:
                current.append(stripped)
        if current:
            text = " ".join(current)
            text = self.clean_text(text)
            if text:
                verses.append(text)
        return verses
