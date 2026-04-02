"""Parser for Chamberlain's Kojiki translation (sacred-texts.com plain text).

Reads a single text file with a preface, 3 volumes, and ~172 numbered
sections.  Strips page markers, footnote references, footnote sections,
and boilerplate lines.

Produces one work (``kj``) with three books (volumes).  Sections are
numbered sequentially; the preface is section 0 in Volume I.
"""

import re
from base_parser import BaseParser

# Patterns for noise in the source text
_PAGE_RE = re.compile(r"\[p\.\s*\w+\]")           # [p. 42], [p. A1]
_PARA_NUM_RE = re.compile(r"\[(\d+)\]")            # [130]
_FN_REF_RE = re.compile(r"\[?\*\d+[a-z]?\]?")     # [*3], *1a, *2b
_PARA_CONT_RE = re.compile(r"\[paragraph continues\]", re.IGNORECASE)
_BOILERPLATE_RE = re.compile(
    r"^\s*The Kojiki, translated by.*?sacred-texts\.com\s*$", re.MULTILINE
)


class KojikiParser(BaseParser):
    WORK_ID = "kj"
    WORK_TITLE = "Kojiki"

    # Book IDs for the three volumes (Japanese reading of 上巻/中巻/下巻)
    _VOLS = [
        ("kjk", "Kamitsumaki"),
        ("kjn", "Nakatsumaki"),
        ("kjs", "Shimotsumaki"),
    ]

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # ── locate structural boundaries ─────────────────────────────
        sect_re = re.compile(
            r"^\[SECT\.\s+([IVXLC]*)\.?[:\-\s]*[-—]?(.+?)\]?\s*\]?\s*$",
            re.MULTILINE,
        )
        vol_re = re.compile(r"^VOL\.\s+(I{1,3})\.", re.MULTILINE)

        # Map volume roman numeral → (book_id, book_name)
        vol_positions = []  # (pos, vol_index)
        for m in vol_re.finditer(text):
            roman = m.group(1)
            vol_idx = len(roman) - 1  # I→0, II→1, III→2
            vol_positions.append((m.start(), vol_idx))

        sect_matches = list(sect_re.finditer(text))

        # ── parse preface (before first SECT) ────────────────────────
        preface_end = sect_matches[0].start() if sect_matches else len(text)
        preface_text = text[:preface_end]
        # Strip everything before the first real paragraph
        # (skip RECORDS OF ANCIENT MATTERS, VOL. I., PREFACE. headers)
        preface_body = re.split(
            r"^PREFACE\.\s*\[\*\d+\]", preface_text, maxsplit=1, flags=re.MULTILINE
        )
        preface_body = preface_body[-1] if len(preface_body) > 1 else ""
        # Cut at Footnotes
        preface_body = re.split(r"^Footnotes\s*$", preface_body, maxsplit=1, flags=re.MULTILINE)[0]
        preface_verses = self._text_to_verses(preface_body)

        # ── parse sections ───────────────────────────────────────────
        raw_sections = []  # (absolute_num, title, verses)
        for i, m in enumerate(sect_matches):
            title = m.group(2).strip().rstrip("]")
            # Body: from end of this header to start of next section (or EOF)
            body_start = m.end()
            body_end = sect_matches[i + 1].start() if i + 1 < len(sect_matches) else len(text)
            body = text[body_start:body_end]

            # Cut at Footnotes
            body = re.split(r"^Footnotes\s*$", body, maxsplit=1, flags=re.MULTILINE)[0]

            verses = self._text_to_verses(body)
            raw_sections.append((i + 1, title, verses))

        # ── assign sections to volumes ───────────────────────────────
        # Determine section-index boundaries for each volume
        vol_sect_ranges = []  # (vol_idx, start_sect_idx, end_sect_idx)
        for vi, (vpos, vol_idx) in enumerate(vol_positions):
            # Find the first section that comes after this VOL marker
            start_si = 0
            for si, m in enumerate(sect_matches):
                if m.start() > vpos:
                    start_si = si
                    break
            # End is the next volume's first section, or total sections
            if vi + 1 < len(vol_positions):
                next_vpos = vol_positions[vi + 1][0]
                end_si = len(sect_matches)
                for si, m in enumerate(sect_matches):
                    if m.start() > next_vpos:
                        end_si = si
                        break
            else:
                end_si = len(sect_matches)
            vol_sect_ranges.append((vol_idx, start_si, end_si))

        # ── build chapters and books ─────────────────────────────────
        all_chapters = []
        books_meta = []

        for vol_idx, (book_id, book_name) in enumerate(self._VOLS):
            chapters = []

            # Add preface as chapter 0 in Volume I
            if vol_idx == 0 and preface_verses:
                ch = {
                    "chapter": 0,
                    "id": f"{book_id}-0",
                    "name": "Preface",
                    "sections": [BaseParser.make_section(preface_verses, clean=False)],
                }
                chapters.append(ch)

            # Find which sections belong to this volume
            for vr_idx, start_si, end_si in vol_sect_ranges:
                if vr_idx != vol_idx:
                    continue
                for si in range(start_si, end_si):
                    abs_num, title, verses = raw_sections[si]
                    if not verses:
                        continue
                    ch = {
                        "chapter": abs_num,
                        "id": f"{book_id}-{abs_num}",
                        "name": self._title_case(title),
                        "sections": [BaseParser.make_section(verses, clean=False)],
                    }
                    chapters.append(ch)

            all_chapters.extend(chapters)
            books_meta.append(
                {
                    "id": book_id,
                    "name": book_name,
                    "chapters": [
                        {
                            "id": ch["id"],
                            "name": ch.get("name"),
                            "verses": sum(len(s["verses"]) for s in ch["sections"]),
                        }
                        for ch in chapters
                    ],
                }
            )

        return [
            {
                "manifest": {
                    "id": self.WORK_ID,
                    "title": self.WORK_TITLE,
                    "translations": [{"id": "chamberlain", "name": "Basil Hall Chamberlain", "year": 1919}],
                    "books": books_meta,
                },
                "chapters": all_chapters,
            }
        ]

    # ── helpers ──────────────────────────────────────────────────────

    @classmethod
    def _clean(cls, text):
        """Strip page markers, footnote refs, paragraph numbers, boilerplate."""
        text = _PAGE_RE.sub("", text)
        text = _PARA_NUM_RE.sub("", text)
        text = _FN_REF_RE.sub("", text)
        text = _PARA_CONT_RE.sub("", text)
        text = _BOILERPLATE_RE.sub("", text)
        text = re.sub(r"[()]", "", text)
        text = BaseParser.clean_text(text)
        # Collapse runs of whitespace left by stripped markers
        text = re.sub(r"  +", " ", text)
        return text

    @classmethod
    def _text_to_verses(cls, text):
        """Clean text, then split into verses (one per paragraph).

        Paragraphs whose predecessor lacks terminal punctuation are
        merged back — these are pagebreak artifacts in the source.
        """
        text = cls._clean(text)
        paragraphs = []
        parts = []

        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                if parts:
                    paragraphs.append(" ".join(parts))
                    parts = []
            else:
                parts.append(stripped)

        if parts:
            paragraphs.append(" ".join(parts))

        # Merge paragraphs split by pagebreaks: if the previous paragraph
        # doesn't end with terminal punctuation, it was mid-sentence.
        _TERMINAL_RE = re.compile(r'[.!?"\u201d]\s*$')
        verses = []
        for para in paragraphs:
            if not para.strip():
                continue
            if verses and not _TERMINAL_RE.search(verses[-1]):
                verses[-1] += " " + para
            else:
                verses.append(para)

        return verses

    @staticmethod
    def _title_case(s):
        """Convert ALL-CAPS section titles to title case."""
        # Preserve existing mixed case
        if s != s.upper():
            return s
        return s.title()
