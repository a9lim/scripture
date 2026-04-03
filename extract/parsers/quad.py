"""Quad scripture PDF parser — Bible (OT+NT), Book of Mormon, D&C, Pearl of Great Price.

Extracts five works from a single LDS Quad PDF:
  - book-of-mormon (1 Nephi–Moroni)
  - doctrine-and-covenants (Sections 1–138, Official Declarations 1–2)
  - pearl-of-great-price (Moses–Articles of Faith)
  - old-testament (Genesis–Malachi, KJV)
  - new-testament (Matthew–Revelation, KJV)

Also extracts the Bible Dictionary as a glossary for OT and NT.
"""

import re

from base_parser import BaseParser
from pdf_parser import PdfParser

# ---------------------------------------------------------------------------
# Font-metric constants (from PDF inspection of LDS Quad)
# ---------------------------------------------------------------------------
_HEADER_Y_MAX = 35
_FOOTNOTE_SIZE_MAX = 9.0
_VERSE_SIZE_MIN = 10.0
_VERSE_SIZE_MAX = 10.5
_SUMMARY_FLAGS = 6           # italic
_FN_MARKER_SIZE_MAX = 6.5
_BOOK_TITLE_SIZE_MIN = 20.0
_DROPCAP_SIZE_MIN = 30.0
_RIGHT_COL_MIN = 216

# D&C section headers (~13pt)
_DC_SECTION_SIZE_MIN = 12.0
_DC_SECTION_SIZE_MAX = 14.0

# ---------------------------------------------------------------------------
# Shared regexes
# ---------------------------------------------------------------------------
_RE_CHAPTER = re.compile(r"^(?:CHAPTER|Chapter|PSALM)\s+(\d+)$")
_RE_SECTION = re.compile(r"^Section\s+(\d+)$")
_RE_OD = re.compile(r"^Official Declaration\s+(\d+)$")
_RE_VERSE_START = re.compile(r"^(\d+)\s+(.*)")
_RE_PILCROW = re.compile(r"[\u00b6]\s*")
_RE_HAIR_SPACE = re.compile(r"\u200a")
_RE_HEADER_BOOK = re.compile(
    r"((?:\d\s+)?(?:[A-Z][A-Z]+(?:\s+[A-Z]+)*))\s+\d+:\d+"
)

# ---------------------------------------------------------------------------
# Bible — 66 canonical books
# ---------------------------------------------------------------------------
_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
]
_OT_BOOKS = set(_BOOKS[:39])
_NT_BOOKS = set(_BOOKS[39:])

_CHAPTER_COUNTS = {
    "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
    "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
    "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25,
    "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13,
    "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31,
    "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66,
    "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
    "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4,
    "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3,
    "Haggai": 2, "Zechariah": 14, "Malachi": 4,
    "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
    "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13,
    "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4,
    "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6,
    "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13,
    "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5,
    "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22,
}

# Running-header book names → canonical name
_HEADER_TO_BOOK = {}
for _b in _BOOKS:
    _HEADER_TO_BOOK[_b.upper()] = _b
_HEADER_TO_BOOK["PSALM"] = "Psalms"
_HEADER_TO_BOOK["ST MATTHEW"] = "Matthew"
_HEADER_TO_BOOK["ST. MATTHEW"] = "Matthew"
_HEADER_TO_BOOK["ST MARK"] = "Mark"
_HEADER_TO_BOOK["ST. MARK"] = "Mark"
_HEADER_TO_BOOK["ST LUKE"] = "Luke"
_HEADER_TO_BOOK["ST. LUKE"] = "Luke"
_HEADER_TO_BOOK["ST JOHN"] = "John"
_HEADER_TO_BOOK["ST. JOHN"] = "John"
_HEADER_TO_BOOK["THE SONG OF SOLOMON"] = "Song of Solomon"

# Title-page large text → canonical name
_TITLE_TO_BOOK = dict(_HEADER_TO_BOOK)
for _b in _BOOKS:
    _TITLE_TO_BOOK[_b.upper()] = _b
del _b
# Multi-book titles (resolved by preamble in _resolve_title_page)
_TITLE_TO_BOOK["SAMUEL"] = "1 Samuel"
_TITLE_TO_BOOK["KINGS"] = "1 Kings"
_TITLE_TO_BOOK["CHRONICLES"] = "1 Chronicles"
_TITLE_TO_BOOK["CORINTHIANS"] = "1 Corinthians"
_TITLE_TO_BOOK["THESSALONIANS"] = "1 Thessalonians"
_TITLE_TO_BOOK["TIMOTHY"] = "1 Timothy"
_TITLE_TO_BOOK["PETER"] = "1 Peter"
_TITLE_TO_BOOK["THE PROVERBS"] = "Proverbs"
_TITLE_TO_BOOK["THE REVELATION"] = "Revelation"
_TITLE_TO_BOOK["OF THE APOSTLES"] = "Acts"

# Numbered books (resolved by preamble in _resolve_title_page)
_NUMBERED = {
    "SAMUEL": ("1 Samuel", "2 Samuel"),
    "KINGS": ("1 Kings", "2 Kings"),
    "CHRONICLES": ("1 Chronicles", "2 Chronicles"),
    "CORINTHIANS": ("1 Corinthians", "2 Corinthians"),
    "THESSALONIANS": ("1 Thessalonians", "2 Thessalonians"),
    "TIMOTHY": ("1 Timothy", "2 Timothy"),
    "PETER": ("1 Peter", "2 Peter"),
}

# ---------------------------------------------------------------------------
# Book of Mormon — 15 books
# ---------------------------------------------------------------------------
_BOM_BOOKS = [
    ("The First Book of Nephi", "1 Nephi"),
    ("The Second Book of Nephi", "2 Nephi"),
    ("The Book of Jacob", "Jacob"),
    ("The Book of Enos", "Enos"),
    ("The Book of Jarom", "Jarom"),
    ("The Book of Omni", "Omni"),
    ("The Words of Mormon", "Words of Mormon"),
    ("The Book of Mosiah", "Mosiah"),
    ("The Book of Alma", "Alma"),
    ("The Book of Helaman", "Helaman"),
    ("Third Nephi", "3 Nephi"),
    ("Fourth Nephi", "4 Nephi"),
    ("The Book of Mormon", "Mormon"),
    ("The Book of Ether", "Ether"),
    ("The Book of Moroni", "Moroni"),
]
_BOM_TITLE_MAP = {full: short for full, short in _BOM_BOOKS}
_BOM_SINGLE_CHAPTER = {"Enos", "Jarom", "Omni", "Words of Mormon", "4 Nephi"}
_BOM_BOOK_NAMES = {short for _, short in _BOM_BOOKS}

# ---------------------------------------------------------------------------
# Pearl of Great Price
# ---------------------------------------------------------------------------
_POGP_BOOKS = [
    ("Book of Moses", "Moses"),
    ("The Book of Abraham", "Abraham"),
    ("Joseph Smith\u2014Matthew", "Joseph Smith\u2014Matthew"),
    ("Joseph Smith\u2014History", "Joseph Smith\u2014History"),
    ("The Articles of Faith", "Articles of Faith"),
]
_POGP_TITLE_MAP = {full: short for full, short in _POGP_BOOKS}
_POGP_SINGLE_CHAPTER = {
    "Joseph Smith\u2014Matthew",
    "Joseph Smith\u2014History",
    "Articles of Faith",
}
_POGP_BOOK_NAMES = {short for _, short in _POGP_BOOKS}

# Book display name → abbreviated book ID (matches frontend BOOKS map)
_BOOK_IDS = {
    # OT
    "Genesis": "gen", "Exodus": "ex", "Leviticus": "lev", "Numbers": "num",
    "Deuteronomy": "deut", "Joshua": "josh", "Judges": "judg", "Ruth": "ruth",
    "1 Samuel": "1-sam", "2 Samuel": "2-sam", "1 Kings": "1-kgs", "2 Kings": "2-kgs",
    "1 Chronicles": "1-chr", "2 Chronicles": "2-chr", "Ezra": "ezra",
    "Nehemiah": "neh", "Esther": "esth", "Job": "job", "Psalms": "ps",
    "Proverbs": "prov", "Ecclesiastes": "eccl", "Song of Solomon": "song",
    "Isaiah": "isa", "Jeremiah": "jer", "Lamentations": "lam", "Ezekiel": "ezek",
    "Daniel": "dan", "Hosea": "hosea", "Joel": "joel", "Amos": "amos",
    "Obadiah": "obad", "Jonah": "jonah", "Micah": "micah", "Nahum": "nahum",
    "Habakkuk": "hab", "Zephaniah": "zeph", "Haggai": "hag", "Zechariah": "zech",
    "Malachi": "mal",
    # NT
    "Matthew": "matt", "Mark": "mark", "Luke": "luke", "John": "john",
    "Acts": "acts", "Romans": "rom", "1 Corinthians": "1-cor",
    "2 Corinthians": "2-cor", "Galatians": "gal", "Ephesians": "eph",
    "Philippians": "philip", "Colossians": "col", "1 Thessalonians": "1-thes",
    "2 Thessalonians": "2-thes", "1 Timothy": "1-tim", "2 Timothy": "2-tim",
    "Titus": "titus", "Philemon": "philem", "Hebrews": "heb", "James": "james",
    "1 Peter": "1-pet", "2 Peter": "2-pet", "1 John": "1-jn", "2 John": "2-jn",
    "3 John": "3-jn", "Jude": "jude", "Revelation": "rev",
    # BoM
    "1 Nephi": "1-ne", "2 Nephi": "2-ne", "Jacob": "jacob", "Enos": "enos",
    "Jarom": "jarom", "Omni": "omni", "Words of Mormon": "w-of-m",
    "Mosiah": "mosiah", "Alma": "alma", "Helaman": "hel", "3 Nephi": "3-ne",
    "4 Nephi": "4-ne", "Mormon": "morm", "Ether": "ether", "Moroni": "moro",
    # D&C
    "Doctrine and Covenants": "dc",
    "Official Declaration": "od",
    # PoGP
    "Moses": "moses", "Abraham": "abr",
    "Joseph Smith\u2014Matthew": "js-m", "Joseph Smith\u2014History": "js-h",
    "Articles of Faith": "a-of-f",
}

# book_id → abbreviation (matches frontend ABBREVS)
_ABBREVS = {
    # OT
    "gen": "Gen.", "ex": "Ex.", "lev": "Lev.", "num": "Num.",
    "deut": "Deut.", "josh": "Josh.", "judg": "Judg.", "ruth": "Ruth",
    "1-sam": "1 Sam.", "2-sam": "2 Sam.", "1-kgs": "1 Kgs.", "2-kgs": "2 Kgs.",
    "1-chr": "1 Chr.", "2-chr": "2 Chr.", "ezra": "Ezra", "neh": "Neh.",
    "esth": "Esth.", "job": "Job", "ps": "Ps.", "prov": "Prov.",
    "eccl": "Eccl.", "song": "Song", "isa": "Isa.", "jer": "Jer.",
    "lam": "Lam.", "ezek": "Ezek.", "dan": "Dan.", "hosea": "Hosea",
    "joel": "Joel", "amos": "Amos", "obad": "Obad.", "jonah": "Jonah",
    "micah": "Micah", "nahum": "Nahum", "hab": "Hab.", "zeph": "Zeph.",
    "hag": "Hag.", "zech": "Zech.", "mal": "Mal.",
    # NT
    "matt": "Matt.", "mark": "Mark", "luke": "Luke", "john": "John",
    "acts": "Acts", "rom": "Rom.", "1-cor": "1 Cor.", "2-cor": "2 Cor.",
    "gal": "Gal.", "eph": "Eph.", "philip": "Philip.", "col": "Col.",
    "1-thes": "1 Thes.", "2-thes": "2 Thes.", "1-tim": "1 Tim.",
    "2-tim": "2 Tim.", "titus": "Titus", "philem": "Philem.",
    "heb": "Heb.", "james": "James", "1-pet": "1 Pet.", "2-pet": "2 Pet.",
    "1-jn": "1 Jn.", "2-jn": "2 Jn.", "3-jn": "3 Jn.", "jude": "Jude",
    "rev": "Rev.",
    # BoM
    "1-ne": "1 Ne.", "2-ne": "2 Ne.", "jacob": "Jacob", "enos": "Enos",
    "jarom": "Jarom", "omni": "Omni", "w-of-m": "W of M",
    "mosiah": "Mosiah", "alma": "Alma", "hel": "Hel.", "3-ne": "3 Ne.",
    "4-ne": "4 Ne.", "morm": "Morm.", "ether": "Ether", "moro": "Moro.",
    # D&C
    "dc": "D&C", "od": "OD",
    # PoGP
    "moses": "Moses", "abr": "Abr.", "js-m": "JS\u2014M",
    "js-h": "JS\u2014H", "a-of-f": "A of F",
}

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _clean(text, fix_dropcap=False):
    """Normalize whitespace, strip pilcrows, hair spaces, and soft hyphens."""
    text = _RE_PILCROW.sub("", text)
    text = _RE_HAIR_SPACE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Fix space before punctuation (span-join artifact, e.g. "See Feasts ." → "See Feasts.")
    text = re.sub(r' ([,;.!?])(?![.\w])', r'\1', text)
    if fix_dropcap:
        # Drop cap merging (letter + rest-of-word) is handled at the
        # span level in _process_verse_span.  Here we fix the remaining
        # small-caps artifacts from the PDF:
        #
        # 1. Standalone "I"/"O"/"A" followed by a small-caps word:
        #    "I SAW the Lord" → "I saw the Lord"
        #    "O LORD" stays (LORD is the tetragrammaton)
        m = re.match(r"^([IOA]) ([A-Z][A-Z]+)\b(.*)", text)
        if m:
            letter, upper, rest = m.groups()
            # Preserve LORD/GOD — these are divine names, not small-caps
            if upper not in ("LORD", "GOD"):
                text = letter + " " + upper.lower() + rest
        else:
            # 2. ALL-CAPS first word (small-caps rendering):
            #    "THUS the heavens" → "Thus the heavens"
            #    "AND, behold" → "And, behold"
            m2 = re.match(r"^([A-Z])([A-Z]+)([\s,;:.].*|$)", text)
            if m2:
                first, rest_word, after = m2.groups()
                text = first + rest_word[0].lower() + rest_word[1:].lower() + after
    # Hyphenated line breaks: "be- side" → "beside"
    # Only join when continuation is lowercase (real break); preserve
    # uppercase continuations like "Baal- hanan" → "Baal-hanan".
    text = re.sub(r"(\w)- ([a-z])", r"\1\2", text)
    text = re.sub(r"(\w)- ([A-Z])", r"\1-\2", text)
    text = BaseParser.clean_text(text)
    # Strip parentheses (editorial asides baked into the source text)
    text = re.sub(r"[()]", "", text)
    text = re.sub(r"  +", " ", text).strip()
    # Soft hyphens
    text = text.replace("\u00ad", "")
    # Normalize Latin ligatures to modern English
    text = text.replace("\u00e6", "ae").replace("\u00c6", "Ae")
    text = text.replace("\u0153", "oe").replace("\u0152", "Oe")
    # Normalize LORD/GOD (small-caps tetragrammaton/divine name) to title case
    text = PdfParser.normalize_divine_names(text)
    return text


def _resolve_header_book(header_text):
    """Extract book name(s) from a running header like 'GENESIS 1:15–30'."""
    matches = _RE_HEADER_BOOK.findall(header_text)
    results = []
    for m in matches:
        m = m.strip()
        if m in _HEADER_TO_BOOK:
            results.append(_HEADER_TO_BOOK[m])
        elif m.replace("ST ", "ST. ") in _HEADER_TO_BOOK:
            results.append(_HEADER_TO_BOOK[m.replace("ST ", "ST. ")])
    return results


# ---------------------------------------------------------------------------
# QuadParser
# ---------------------------------------------------------------------------

class QuadParser(PdfParser):
    """Parser for the LDS Quad PDF: Bible, Book of Mormon, D&C, Pearl of Great Price."""

    # Page ranges (0-indexed)
    BIBLE_START = 9
    BIBLE_END = 1599
    BOM_START = 2476
    BOM_END = 3007
    DC_START = 3021
    DC_END = 3316
    POGP_START = 3321
    POGP_END = 3382

    # ==================================================================
    # Public API
    # ==================================================================

    def extract_chapters(self, doc):
        bible = self._parse_bible(doc)
        bom = self._parse_titled_section(
            doc, self.BOM_START, self.BOM_END,
            self._match_bom_title, _BOM_SINGLE_CHAPTER,
        )
        dc = self._parse_dc(doc)
        pogp = self._parse_titled_section(
            doc, self.POGP_START, self.POGP_END,
            self._match_pogp_title, _POGP_SINGLE_CHAPTER,
        )
        all_raw = bible + bom + dc + pogp
        return [self._finalize(ch) for ch in all_raw]

    def build_manifest(self, chapters):
        groups = {
            "bom":  ({}, [], set()),
            "dc":   ({}, [], set()),
            "pgp":  ({}, [], set()),
            "ot":   ({}, [], set()),
            "nt":   ({}, [], set()),
        }

        for ch in chapters:
            bname = ch["_book"]
            if bname in _BOM_BOOK_NAMES:
                key = "bom"
            elif bname == "Doctrine and Covenants" or bname.startswith("Official Declaration"):
                key = "dc"
            elif bname in _POGP_BOOK_NAMES:
                key = "pgp"
            elif bname in _OT_BOOKS:
                key = "ot"
            elif bname in _NT_BOOKS:
                key = "nt"
            else:
                continue

            book_map, order, ids = groups[key]
            if bname.startswith("Official Declaration"):
                canon_bname = "Official Declaration"
            else:
                canon_bname = bname

            if canon_bname not in book_map:
                book_id = _BOOK_IDS.get(canon_bname, self.slugify(canon_bname))
                book_map[canon_bname] = {
                    "id": book_id,
                    "name": canon_bname,
                    "abbrev": _ABBREVS.get(book_id, book_id),
                    "_ch_ids": [],
                }
                order.append(canon_bname)
            book_map[canon_bname]["_ch_ids"].append(ch["_id"])
            ids.add(ch["_id"])

        def _work(work_id, title, key):
            book_map, order, ids = groups[key]
            books = []
            for b in order:
                entry = dict(book_map[b])
                ch_ids = entry.pop("_ch_ids")
                entry["chapters"] = len(ch_ids)
                books.append(entry)
            return {
                "id": work_id,
                "title": title,
                "books": books,
                "_chapter_ids": ids,
            }

        return [
            _work("bom", "Book of Mormon", "bom"),
            _work("dc", "Doctrine and Covenants", "dc"),
            _work("pgp", "Pearl of Great Price", "pgp"),
            _work("ot", "Old Testament", "ot"),
            _work("nt", "New Testament", "nt"),
        ]

    # ==================================================================
    # Shared infrastructure
    # ==================================================================

    def _extract_ordered_spans(self, blocks, pg, title_y=None):
        """Extract spans ordering left column then right column.

        On transition pages, *title_y* may be a single y-coordinate or
        a sorted list of y-coordinates (for pages with multiple section
        headers).  Each boundary creates a zone; within each zone spans
        are ordered left-then-right so the old section's right-column
        content finishes before the new section begins.
        """
        left, right = [], []
        for b in blocks:
            if "lines" not in b:
                continue
            for ln in b["lines"]:
                y = ln["bbox"][1]
                for sp in ln["spans"]:
                    t = sp["text"]
                    if not t.strip():
                        continue
                    x = sp["bbox"][0]
                    size = round(sp["size"], 1)
                    flags = sp["flags"]
                    if y < _HEADER_Y_MAX and size <= 10.5:
                        continue
                    entry = {
                        "t": t, "s": size, "f": flags,
                        "x": x, "y": y, "p": pg,
                    }
                    if x < _RIGHT_COL_MIN:
                        left.append(entry)
                    else:
                        right.append(entry)

        if title_y is not None:
            # Normalize to a sorted list of boundary y-coordinates
            if isinstance(title_y, (int, float)):
                boundaries = [title_y]
            else:
                boundaries = sorted(title_y)

            _k = lambda s: (s["y"], s["x"])
            result = []
            prev = float("-inf")
            for boundary in boundaries:
                zone_l = sorted(
                    (s for s in left if prev <= s["y"] < boundary), key=_k)
                zone_r = sorted(
                    (s for s in right if prev <= s["y"] < boundary), key=_k)
                result.extend(zone_l)
                result.extend(zone_r)
                prev = boundary
            # Final zone: everything at or below last boundary
            zone_l = sorted(
                (s for s in left if s["y"] >= prev), key=_k)
            zone_r = sorted(
                (s for s in right if s["y"] >= prev), key=_k)
            result.extend(zone_l)
            result.extend(zone_r)
            return result

        left.sort(key=lambda s: (s["y"], s["x"]))
        right.sort(key=lambda s: (s["y"], s["x"]))
        return left + right

    @staticmethod
    def _new_chapter(book, num):
        return {
            "_book": book,
            "number": num,
            "_verse_parts": [],
            "_cur_verse": None,
            "_in_summary": True,
            "_in_verse1": False,
            "_pages": set(),
            "verses": [],
        }

    def _close_verse(self, ch):
        """Finalize the current verse and append it to the chapter."""
        if ch["_cur_verse"] is None:
            return
        text = _clean(" ".join(ch["_verse_parts"]), fix_dropcap=True)
        if text:
            ch["verses"].append(text)
        ch["_cur_verse"] = None
        ch["_verse_parts"] = []
        ch["_in_verse1"] = False

    def _process_verse_span(self, sp, ch, title_y=None):
        """Process a span as verse content: footnote markers, summaries,
        drop caps, or normal verse text.

        Sub-parsers should handle book titles and chapter headers before
        delegating to this method.  *title_y* (optional) skips right-column
        content above the title on transition pages.
        """
        t = sp["t"].strip()
        s = sp["s"]
        f = sp["f"]

        if not t:
            return

        # Skip right-column content above title on transition pages
        if (title_y is not None
                and sp["x"] >= _RIGHT_COL_MIN
                and sp["y"] < title_y
                and not _RE_CHAPTER.match(t)):
            return

        # Footnote markers (superscript letters) and footnote area at page bottom
        if s <= _FN_MARKER_SIZE_MAX and len(t) <= 2:
            return
        if s <= _FOOTNOTE_SIZE_MAX:
            return

        # Chapter summary (italic, >= verse size) — skip
        if ch["_in_summary"] and f == _SUMMARY_FLAGS and s >= _VERSE_SIZE_MIN:
            return

        # Skip non-verse text during summary: bold subtitles, parenthetical dates
        if ch["_in_summary"] and s >= _VERSE_SIZE_MIN and (f == 20 or t.startswith("(")):
            return

        # Drop cap (first letter of chapter)
        if s >= _DROPCAP_SIZE_MIN:
            if ch["_in_verse1"]:
                ch["_verse_parts"].append(t)
            else:
                ch["_in_summary"] = False
                ch["_in_verse1"] = True
                if ch["_cur_verse"] is None:
                    ch["_cur_verse"] = 1
                # Store the drop cap letter; it will be merged with the
                # start of the next verse-text span to form the first word.
                ch["_dropcap_pending"] = t
            return

        # Normal verse text (~10.0–10.7pt)
        if _VERSE_SIZE_MIN <= s <= _VERSE_SIZE_MAX + 0.2:
            # Resolve a pending drop cap: merge it with the uppercase
            # prefix of this span (the rest of the first word, rendered
            # in the same font as body text) and title-case the result.
            if ch.get("_dropcap_pending"):
                cap = ch.pop("_dropcap_pending")
                m_dc = re.match(r"^([A-Z]*)(.*)", t, re.DOTALL)
                upper_part, rest_part = m_dc.group(1), m_dc.group(2)
                if upper_part:
                    word = cap + upper_part
                    t = word[0] + word[1:].lower() + rest_part
                else:
                    # BoM pattern: "I" + ", Nephi" — no uppercase to merge
                    t = cap + t

            if ch["_in_summary"] and f != _SUMMARY_FLAGS:
                ch["_in_summary"] = False
                if ch["_cur_verse"] is None:
                    ch["_cur_verse"] = 1

            if ch["_in_summary"] and f == _SUMMARY_FLAGS:
                return

            # Verse number at start of span
            vm = _RE_VERSE_START.match(t)
            if not vm and re.match(r"^\d+$", t):
                vm = re.match(r"^(\d+)()", t)
            if vm:
                vnum = int(vm.group(1))
                rest = vm.group(2)
                cur = ch["_cur_verse"]
                if vnum <= 200 and (cur is None or cur <= vnum <= cur + 10):
                    self._close_verse(ch)
                    ch["_cur_verse"] = vnum
                    ch["_in_verse1"] = False
                    if rest:
                        ch["_verse_parts"].append(rest)
                    return

            if ch["_cur_verse"] is not None:
                ch["_verse_parts"].append(t)

    def _finalize(self, ch):
        """Convert raw chapter dict to output JSON schema."""
        book = ch["_book"] or "Unknown"
        num = ch["number"]

        if book == "Doctrine and Covenants":
            slug = f"dc-{num}"
        elif book.startswith("Official Declaration"):
            slug = f"od-{book.split()[-1]}"
        else:
            book_id = _BOOK_IDS.get(book, self.slugify(book))
            slug = f"{book_id}-{num}"

        sections = []
        if ch["verses"]:
            sections.append({
                "startVerse": 1,
                "verses": ch["verses"],
            })

        return {
            "_id": slug,
            "sections": sections,
            "_book": book,
        }


    # ==================================================================
    # Bible (OT + NT)
    # ==================================================================

    def _parse_bible(self, doc):
        page_books = self._build_page_book_map(doc)
        title_y_map = self._find_title_positions(doc)
        return self._parse_bible_pages(doc, page_books, title_y_map)

    def _build_page_book_map(self, doc):
        """Map each Bible page to (start_book, end_book) via headers and title pages."""
        page_books = {}
        title_page_books = {}

        # Pass 1: detect title pages (large text >= 20pt)
        for pg in range(self.BIBLE_START, min(self.BIBLE_END, len(doc))):
            page = doc[pg]
            blocks = page.get_text("dict")["blocks"]
            preamble_parts = []
            large_name = None
            large_y = 9999
            for b in blocks:
                if "lines" not in b:
                    continue
                for ln in b["lines"]:
                    for sp in ln["spans"]:
                        t = sp["text"].strip()
                        if not t:
                            continue
                        if _BOOK_TITLE_SIZE_MIN <= sp["size"] < _DROPCAP_SIZE_MIN:
                            large_name = t.upper()
                            large_y = ln["bbox"][1]
            if large_name:
                for b in blocks:
                    if "lines" not in b:
                        continue
                    for ln in b["lines"]:
                        if ln["bbox"][1] >= large_y:
                            continue
                        for sp in ln["spans"]:
                            t = sp["text"].strip()
                            if not t:
                                continue
                            if (sp["size"] >= 11.0
                                    or (sp["size"] >= 10.0 and sp["flags"] == 20)
                                    or sp["size"] >= 14.0):
                                preamble_parts.append(t)
                book = self._resolve_title_page(large_name, preamble_parts)
                if book:
                    title_page_books[pg] = book

        # Pass 2: running headers
        for pg in range(self.BIBLE_START, min(self.BIBLE_END, len(doc))):
            page = doc[pg]
            blocks = page.get_text("dict")["blocks"]
            header_text = ""
            for b in blocks:
                if "lines" not in b:
                    continue
                for ln in b["lines"]:
                    if ln["bbox"][1] > _HEADER_Y_MAX:
                        continue
                    for sp in ln["spans"]:
                        t = sp["text"].strip()
                        if t and not t.isdigit() and sp["size"] >= 10.0:
                            header_text = t
            header_books = _resolve_header_book(header_text) if header_text else []
            if pg in title_page_books:
                title_book = title_page_books[pg]
                if header_books:
                    page_books[pg] = (header_books[0], title_book)
                else:
                    page_books[pg] = (title_book, title_book)
            elif header_books:
                page_books[pg] = (header_books[0], header_books[-1])

        # Forward-fill gaps
        last_book = None
        for pg in range(self.BIBLE_START, min(self.BIBLE_END, len(doc))):
            if pg in page_books:
                last_book = page_books[pg][1]
            elif last_book:
                page_books[pg] = (last_book, last_book)

        return page_books

    @staticmethod
    def _resolve_title_page(large_name, preamble_parts):
        """Resolve book name from title-page large text + preamble text above it."""
        preamble = " ".join(preamble_parts).upper()
        if large_name not in _TITLE_TO_BOOK:
            st = "ST " + large_name
            if st in _TITLE_TO_BOOK:
                return _TITLE_TO_BOOK[st]
            return None

        base = _TITLE_TO_BOOK[large_name]
        is_epistle = "EPISTLE" in preamble

        # Numbered books: preamble says FIRST / SECOND / THIRD
        if large_name in _NUMBERED:
            first, second = _NUMBERED[large_name]
            if "SECOND" in preamble:
                return second
            if "FIRST" in preamble:
                return first
            return base

        if large_name == "JOHN":
            if "SECOND" in preamble:
                return "2 John"
            if "THIRD" in preamble:
                return "3 John"
            if "FIRST" in preamble and is_epistle:
                return "1 John"

        return base

    def _find_title_positions(self, doc):
        """Pre-scan Bible pages for book-title y-positions (zone ordering)."""
        title_y_map = {}
        for pg in range(self.BIBLE_START, min(self.BIBLE_END, len(doc))):
            page = doc[pg]
            for b in page.get_text("dict")["blocks"]:
                if "lines" not in b:
                    continue
                for ln in b["lines"]:
                    for sp in ln["spans"]:
                        t = sp["text"].strip()
                        if not t:
                            continue
                        s = round(sp["size"], 1)
                        if (_BOOK_TITLE_SIZE_MIN <= s < _DROPCAP_SIZE_MIN
                                and self._match_book_title(t)):
                            title_y_map[pg] = ln["bbox"][1]
        return title_y_map

    @staticmethod
    def _match_book_title(text):
        """Match large title text to a known Bible book name."""
        t = text.strip().upper()
        return _TITLE_TO_BOOK.get(t)

    def _parse_bible_pages(self, doc, page_books, title_y_map):
        """Parse all Bible pages using the page-book map."""
        chapters = []
        ch = None
        cur_book = None

        for pg in range(self.BIBLE_START, min(self.BIBLE_END, len(doc))):
            page = doc[pg]
            blocks = page.get_text("dict")["blocks"]
            spans = self._extract_ordered_spans(
                blocks, pg, title_y=title_y_map.get(pg),
            )
            pg_start, pg_end = page_books.get(pg, (None, None))
            if ch is not None:
                ch["_pages"].add(pg)

            for sp in spans:
                t = sp["t"].strip()
                s = sp["s"]

                # Book title (20–30pt)
                if (_BOOK_TITLE_SIZE_MIN <= s < _DROPCAP_SIZE_MIN
                        and not _RE_CHAPTER.match(t)):
                    book = self._match_book_title(t)
                    if book:
                        new_book = pg_end or pg_start or book
                        if new_book != cur_book:
                            if ch:
                                self._close_verse(ch)
                                chapters.append(ch)
                                ch = None
                            cur_book = new_book
                            if _CHAPTER_COUNTS.get(cur_book) == 1:
                                ch = self._new_chapter(cur_book, 1)
                                ch["_pages"].add(pg)
                    continue

                # Decorative text (14–20pt) — skip
                if 14.0 <= s < _BOOK_TITLE_SIZE_MIN:
                    continue

                # Chapter header (CHAPTER N / PSALM N)
                m = _RE_CHAPTER.match(t)
                if m and _VERSE_SIZE_MIN <= s <= 11.0:
                    ch_num = int(m.group(1))
                    if ch_num == 1:
                        if pg_end and pg_end != cur_book:
                            cur_book = pg_end
                        elif cur_book is None:
                            cur_book = pg_end or pg_start
                    elif cur_book is None:
                        cur_book = pg_end or pg_start
                    if ch:
                        self._close_verse(ch)
                        chapters.append(ch)
                    ch = self._new_chapter(cur_book, ch_num)
                    ch["_pages"].add(pg)
                    continue

                if ch is None:
                    continue

                self._process_verse_span(sp, ch)

        if ch:
            self._close_verse(ch)
            chapters.append(ch)
        return chapters

    # ==================================================================
    # Titled-section parser (Book of Mormon, Pearl of Great Price)
    # ==================================================================

    def _parse_titled_section(self, doc, start, end, title_matcher,
                              single_chapter_books):
        """Parse a page range that uses large-text book titles and
        CHAPTER N headers.  Shared by BoM and PoGP.

        *title_matcher(text)* returns a canonical book name or None.
        *single_chapter_books* is a set of book names that have no
        explicit CHAPTER header (auto-create chapter 1 on title).
        """
        # Pre-scan for book-title y-positions so _extract_ordered_spans
        # can zone-order transition pages (old book's right column
        # finishes before the new book's left column begins).
        title_y_map = {}
        for pg in range(start, min(end, len(doc))):
            page = doc[pg]
            for b in page.get_text("dict")["blocks"]:
                if "lines" not in b:
                    continue
                for ln in b["lines"]:
                    for sp in ln["spans"]:
                        t = sp["text"].strip()
                        if not t:
                            continue
                        s = round(sp["size"], 1)
                        if (_BOOK_TITLE_SIZE_MIN <= s < _DROPCAP_SIZE_MIN
                                and not _RE_CHAPTER.match(t)
                                and title_matcher(t)):
                            title_y_map[pg] = ln["bbox"][1]

        chapters = []
        ch = None
        cur_book = None

        for pg in range(start, min(end, len(doc))):
            page = doc[pg]
            blocks = page.get_text("dict")["blocks"]
            spans = self._extract_ordered_spans(
                blocks, pg, title_y=title_y_map.get(pg),
            )
            title_y = title_y_map.get(pg)
            if ch:
                ch["_pages"].add(pg)

            for sp in spans:
                t = sp["t"].strip()
                s = sp["s"]

                # Book title (20–30pt)
                if (_BOOK_TITLE_SIZE_MIN <= s < _DROPCAP_SIZE_MIN
                        and not _RE_CHAPTER.match(t)):
                    book = title_matcher(t)
                    if book and book != cur_book:
                        if ch:
                            self._close_verse(ch)
                            chapters.append(ch)
                            ch = None
                        cur_book = book
                        title_y = sp["y"]
                        if cur_book in single_chapter_books:
                            ch = self._new_chapter(cur_book, 1)
                    continue

                # Decorative text (14–20pt) — skip
                if 14.0 <= s < _BOOK_TITLE_SIZE_MIN:
                    continue

                # Chapter header
                m = _RE_CHAPTER.match(t)
                if m and _VERSE_SIZE_MIN <= s <= 11.0:
                    ch_num = int(m.group(1))
                    if ch:
                        self._close_verse(ch)
                        chapters.append(ch)
                    ch = self._new_chapter(cur_book, ch_num)
                    continue

                if ch is None:
                    continue

                # title_y not passed — zone ordering in _extract_ordered_spans
                # already ensures right-column content above the title is
                # processed before the title closes the old chapter.
                self._process_verse_span(sp, ch)

        if ch:
            self._close_verse(ch)
            chapters.append(ch)
        return chapters

    @staticmethod
    def _match_bom_title(text):
        """Match large title text to a BoM book name."""
        t = text.strip()
        if t in _BOM_TITLE_MAP:
            return _BOM_TITLE_MAP[t]
        if t == "Third Nephi":
            return "3 Nephi"
        if t == "Fourth Nephi":
            return "4 Nephi"
        if t == "The Book of Nephi":
            return None
        return None

    # ==================================================================
    # Doctrine & Covenants
    # ==================================================================

    def _parse_dc(self, doc):
        # Pre-scan for section/OD header y-positions so
        # _extract_ordered_spans can zone-order transition pages.
        # Pages may have multiple section headers (short sections),
        # so store a list of y-positions per page.
        section_y_map = {}
        for pg in range(self.DC_START, min(self.DC_END, len(doc))):
            page = doc[pg]
            for b in page.get_text("dict")["blocks"]:
                if "lines" not in b:
                    continue
                for ln in b["lines"]:
                    for sp in ln["spans"]:
                        t = sp["text"].strip()
                        if not t:
                            continue
                        s = round(sp["size"], 1)
                        if (_DC_SECTION_SIZE_MIN <= s <= _DC_SECTION_SIZE_MAX
                                and (_RE_SECTION.match(t)
                                     or _RE_OD.match(t))):
                            section_y_map.setdefault(pg, []).append(
                                ln["bbox"][1])

        chapters = []
        ch = None

        for pg in range(self.DC_START, min(self.DC_END, len(doc))):
            page = doc[pg]
            blocks = page.get_text("dict")["blocks"]
            spans = self._extract_ordered_spans(
                blocks, pg, title_y=section_y_map.get(pg),
            )
            if ch:
                ch["_pages"].add(pg)

            for sp in spans:
                t = sp["t"].strip()
                s = sp["s"]
                f = sp["f"]

                # Section header: "Section N" at ~13pt
                ms = _RE_SECTION.match(t)
                if ms and _DC_SECTION_SIZE_MIN <= s <= _DC_SECTION_SIZE_MAX:
                    if ch:
                        self._close_verse(ch)
                        chapters.append(ch)
                    ch = self._new_chapter("Doctrine and Covenants", int(ms.group(1)))
                    continue

                # Official Declaration header
                mod = _RE_OD.match(t)
                if mod and _DC_SECTION_SIZE_MIN <= s <= _DC_SECTION_SIZE_MAX:
                    od_num = int(mod.group(1))
                    if ch:
                        self._close_verse(ch)
                        chapters.append(ch)
                    ch = self._new_chapter(f"Official Declaration {od_num}", od_num)
                    ch["_in_summary"] = True
                    continue

                if ch is None:
                    continue

                # Official Declaration: prose text → verse 1 (no verse numbers)
                if ch["_book"].startswith("Official Declaration"):
                    if s >= _VERSE_SIZE_MIN:
                        if s <= _FN_MARKER_SIZE_MAX and len(t) <= 2:
                            continue
                        if s <= _FOOTNOTE_SIZE_MAX:
                            continue
                        if ch["_cur_verse"] is None:
                            ch["_in_summary"] = False
                            ch["_cur_verse"] = 1
                        ch["_verse_parts"].append(t)
                    continue

                # Decorative text (14–30pt) — skip (except drop caps)
                if 14.0 <= s < _DROPCAP_SIZE_MIN:
                    continue

                self._process_verse_span(sp, ch)

        if ch:
            self._close_verse(ch)
            chapters.append(ch)
        return chapters

    # ==================================================================
    # Pearl of Great Price — title matcher
    # ==================================================================

    @staticmethod
    def _match_pogp_title(text):
        """Match large title text to a PoGP book name."""
        t = text.strip()
        if t in _POGP_TITLE_MAP:
            return _POGP_TITLE_MAP[t]
        t_norm = t.replace("\u2014", "\u2014").replace("--", "\u2014")
        if t_norm in _POGP_TITLE_MAP:
            return _POGP_TITLE_MAP[t_norm]
        if "Moses" in t:
            return "Moses"
        if "Abraham" in t:
            return "Abraham"
        if "Joseph Smith" in t and "Matthew" in t:
            return "Joseph Smith\u2014Matthew"
        if "Joseph Smith" in t and "History" in t:
            return "Joseph Smith\u2014History"
        if "Articles of Faith" in t:
            return "Articles of Faith"
        return None

