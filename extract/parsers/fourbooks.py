"""Parser for Legge's Four Books (plain-text Gutenberg format).

Expects a directory containing gl.txt, dom.txt, and analects.txt.
Produces one work ('fourbooks') with three books.
"""

import os
import re
from base_parser import BaseParser

_ABBREVS = {
    "gl": "G.L.", "dom": "D.M.", "analects": "Analects", "mencius": "Mencius",
}


class FourBooksParser(BaseParser):
    WORK_ID = "fourbooks"
    WORK_TITLE = "The Four Books"

    BOOKS = [
        ("gl.txt", "gl", "Great Learning"),
        ("dom.txt", "dom", "Doctrine of the Mean"),
        ("analects.txt", "analects", "Analects"),
    ]

    def parse(self, source_path):
        source_dir = (
            source_path
            if os.path.isdir(source_path)
            else os.path.dirname(source_path)
        )

        books_meta = []
        all_chapters = []

        for filename, book_id, book_name in self.BOOKS:
            filepath = os.path.join(source_dir, filename)
            with open(filepath, encoding="utf-8") as f:
                lines = f.readlines()

            if book_id == "analects":
                chapters = self._parse_analects(lines, book_id)
            elif book_id == "gl":
                chapters = self._parse_gl(lines, book_id)
            else:
                chapters = self._parse_single_chapter(lines, book_id)

            # Normalize all-caps first words in first verse of each chapter
            for ch in chapters:
                first_sec = ch["sections"][0]
                if first_sec["verses"]:
                    first_sec["verses"][0] = self.normalize_caps_first_words(
                        first_sec["verses"][0]
                    )

            all_chapters.extend(chapters)
            books_meta.append(
                {
                    "id": book_id,
                    "name": book_name,
                    "abbrev": _ABBREVS.get(book_id, book_id),
                    "chapters": len(chapters),
                }
            )

        return [
            {
                "manifest": {
                    "id": self.WORK_ID,
                    "title": self.WORK_TITLE,
                    "translations": [{"id": "legge", "name": "James Legge", "year": 1861}],
                    "books": books_meta,
                },
                "chapters": all_chapters,
            }
        ]

    # ── helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _lines_to_verses(lines):
        """Split lines into verse strings.

        New verse starts at each 3-space-indented paragraph.
        Continuation lines (1-space indent) merge into the current verse.
        """
        verses = []
        parts = []

        for line in lines:
            stripped = line.rstrip()
            if not stripped:
                continue
            # New paragraph: 3 spaces then a non-space character
            if re.match(r"^   \S", stripped):
                if parts:
                    verses.append(" ".join(parts))
                    parts = []
            parts.append(stripped.strip())

        if parts:
            verses.append(" ".join(parts))
        return verses

    # ── book-specific parsers ────────────────────────────────────────

    def _parse_gl(self, lines, book_id):
        """Great Learning: one chapter, two sections (text + commentary)."""
        split_idx = None
        for i, line in enumerate(lines):
            if "COMMENTARY" in line.upper() and "TSANG" in line.upper():
                split_idx = i
                break

        text_lines = lines[:split_idx] if split_idx else lines
        comm_lines = lines[split_idx + 1 :] if split_idx else []

        text_verses = self._lines_to_verses(text_lines)
        sections = [BaseParser.make_section(text_verses)]

        if comm_lines:
            comm_verses = self._lines_to_verses(comm_lines)
            start = len(text_verses) + 1
            sections.append(BaseParser.make_section(comm_verses, start=start))

        return [{"_id": f"{book_id}-1", "sections": sections}]

    def _parse_single_chapter(self, lines, book_id):
        """Single-chapter book (Doctrine of the Mean)."""
        verses = self._lines_to_verses(lines)
        return [{"_id": f"{book_id}-1", "sections": [BaseParser.make_section(verses)]}]

    def _parse_analects(self, lines, book_id):
        """Analects: 20 chapters separated by centered numbers."""
        chapter_groups = []
        current_lines = []
        current_num = None

        for line in lines:
            stripped = line.strip()
            # Centered chapter number: digit-only line with heavy leading whitespace
            if stripped.isdigit() and len(line) - len(line.lstrip()) > 10:
                if current_num is not None:
                    chapter_groups.append((current_num, current_lines))
                current_num = int(stripped)
                current_lines = []
            else:
                current_lines.append(line)

        if current_num is not None:
            chapter_groups.append((current_num, current_lines))

        chapters = []
        for num, ch_lines in chapter_groups:
            verses = self._lines_to_verses(ch_lines)
            chapters.append(
                {"_id": f"{book_id}-{num}", "sections": [BaseParser.make_section(verses)]}
            )
        return chapters
