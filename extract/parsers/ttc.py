"""Parser for Legge's Tao Te Ching (Gutenberg plain text).

Reads a single text file with 81 chapters across two parts.
Chapters are separated by double blank lines; verses within a chapter
are numbered ``1.``, ``2.``, etc.

Produces one work (``ttc``) with one book and 81 chapters.
"""

import re
from base_parser import BaseParser


class TtcParser(BaseParser):
    WORK_ID = "ttc"
    WORK_TITLE = "Tao Te Ching"

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # Split into chunks on 2+ blank lines
        chunks = re.split(r"\n{3,}", text)

        chapters = []
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk or re.match(r"^PART\b", chunk, re.IGNORECASE):
                continue

            # Chapter number: "Ch. N." or "N." at the start
            m = re.match(r"^(?:Ch\.\s+)?(\d+)\.", chunk)
            if not m:
                continue
            ch_num = int(m.group(1))

            # Everything after the chapter number prefix is verse content
            body = chunk[m.end():]
            verses = self._parse_verses(body)
            if not verses:
                continue

            chapters.append(
                {
                    "chapter": ch_num,
                    "id": f"ttc-{ch_num}",
                    "sections": [BaseParser.make_section(verses)],
                }
            )

        book = {
            "id": "ttc",
            "name": "Tao Te Ching",
            "chapters": [
                {"id": ch["id"], "verses": len(ch["sections"][0]["verses"])}
                for ch in chapters
            ],
        }

        return [
            {
                "manifest": {
                    "id": self.WORK_ID,
                    "title": self.WORK_TITLE,
                    "translations": [{"id": "legge", "name": "James Legge", "year": 1891}],
                    "books": [book],
                },
                "chapters": chapters,
            }
        ]

    # ── helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _parse_verses(body):
        """Split chapter body text into verse strings by ``N.`` markers."""
        verses = []
        parts = []

        for line in body.split("\n"):
            stripped = line.strip()
            # New verse: starts with "N." or "N. text"
            m = re.match(r"^(\d+)\.\s*(.*)", stripped)
            if m:
                if parts:
                    verses.append(" ".join(parts))
                    parts = []
                rest = m.group(2).strip()
                if rest:
                    parts.append(rest)
            elif stripped:
                parts.append(stripped)

        if parts:
            verses.append(" ".join(parts))
        return verses

