"""Parser for the Kalevala (Crawford translation, sacred-texts.com).

Reads John Martin Crawford's 1888 translation.  Structure is a Proem
followed by 50 Runes.  Each Rune has a subtitle.  Poetry is split
into verses by blank-line-separated stanzas.

Produces one work (``kv``) with one book.
"""

import re
from base_parser import BaseParser

# Rune header: "RUNE I." through "RUNE L."  (some lack trailing period)
_RUNE_RE = re.compile(r"^RUNE\s+([IVXLC]+)\.?\s*$")

# Proem header
_PROEM_RE = re.compile(r"^PROEM\.\s*$")

# Noise patterns
_PAGE_RE = re.compile(r"\[p\.\s*\d+\]")
_BOILERPLATE_RE = re.compile(
    r"^\s*The Kalevala,.*?sacred-texts\.com\s*$", re.MULTILINE
)

# Roman numeral conversion
_ROMAN_VALS = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}

_SMALL_WORDS = frozenset(
    "a an and as at but by for in nor of on or so the to up".split()
)


def _title_case(s):
    """Title-case with small words lowered (except first/last)."""
    words = s.lower().split()
    result = []
    for i, w in enumerate(words):
        if i == 0 or i == len(words) - 1 or w not in _SMALL_WORDS:
            result.append(w[0].upper() + w[1:] if w else w)
        else:
            result.append(w)
    return " ".join(result)


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


class KalevalaParser(BaseParser):
    WORK_ID = "kv"
    WORK_TITLE = "Kalevala"

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Clean noise
        text = _PAGE_RE.sub("", text)
        text = _BOILERPLATE_RE.sub("", text)

        lines = text.split("\n")
        chapters = []

        # Find all section boundaries (proem + runes)
        boundaries = []  # (line_index, rune_number, is_proem)
        for i, line in enumerate(lines):
            stripped = line.strip()
            if _PROEM_RE.match(stripped):
                boundaries.append((i, 0, True))
            else:
                m = _RUNE_RE.match(stripped)
                if m:
                    rune_num = _roman_to_int(m.group(1))
                    boundaries.append((i, rune_num, False))

        for j, (start_line, rune_num, is_proem) in enumerate(boundaries):
            end_line = (
                boundaries[j + 1][0] if j + 1 < len(boundaries) else len(lines)
            )

            # Extract subtitle (first non-empty line after the header)
            name = None
            body_start = start_line + 1
            if not is_proem:
                for k in range(start_line + 1, min(start_line + 5, end_line)):
                    stripped = lines[k].strip()
                    if stripped and not _RUNE_RE.match(stripped):
                        # Subtitle line — clean trailing period
                        name = stripped.rstrip(".").strip()
                        if name == name.upper():
                            name = _title_case(name)
                        body_start = k + 1
                        break
            else:
                name = "Proem"

            body = "\n".join(lines[body_start:end_line])
            verses = self._text_to_verses(body)
            if not verses:
                continue
            verses[0] = self.normalize_caps_first_words(verses[0])

            chapters.append({
                "_id": f"kv-{rune_num}",
                "name": name,
                "sections": [BaseParser.make_section(verses, clean=False)],
            })

        names = [ch.get("name") for ch in chapters]
        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "crawford", "name": "John Martin Crawford", "year": 1888}
            ],
            "books": [{
                "id": "kv",
                "name": "Kalevala",
                "abbrev": "Kal.",
                "chapters": len(chapters),
                "start": 0,
                "names": names,
            }],
        }

        return [{
            "manifest": manifest,
            "chapters": chapters,
        }]

    @classmethod
    def _text_to_verses(cls, text):
        """Split poetry into verses by blank-line-separated stanzas.

        Merges stanzas that were split by page breaks (predecessor
        lacks terminal punctuation).
        """
        paragraphs = []
        current = []

        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                if current:
                    paragraphs.append(" ".join(current))
                    current = []
            else:
                cleaned = cls.clean_text(stripped)
                if cleaned:
                    current.append(cleaned)

        if current:
            paragraphs.append(" ".join(current))

        # Merge paragraphs split by page breaks
        _TERMINAL_RE = re.compile(r'[.!?;:,"\u201d]\s*$')
        verses = []
        for para in paragraphs:
            if not para.strip():
                continue
            if verses and not _TERMINAL_RE.search(verses[-1]):
                verses[-1] += " " + para
            else:
                verses.append(para)

        return verses
