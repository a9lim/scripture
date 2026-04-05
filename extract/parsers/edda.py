"""Parser for the Poetic Edda (Bellows translation, sacred-texts.com).

Reads Henry Adams Bellows' 1936 translation.  Structure is two volumes
(Lays of the Gods, Lays of the Heroes), each containing multiple poems.
Each poem has an introductory note (skipped), numbered stanzas, prose
passages, and scholarly footnotes (stripped).

Produces one work (``poe``) with two books (volumes).
"""

import re
from base_parser import BaseParser

# Noise patterns
_PAGE_RE = re.compile(r"\[f?p\.\s*\d+\]")
_BOILERPLATE_RE = re.compile(
    r"^\s*The Poetic Edda,.*?sacred-texts\.com\s*$", re.MULTILINE
)

# Stanza number: "N." or "N," at line start (with possible leading space)
_STANZA_RE = re.compile(r"^\s*(\d+)[.,]\s*(.*)")

# Speaker attribution: "Name spake:" on its own line
_SPEAKER_RE = re.compile(r"^\s*(\w[\w\s'-]*?)\s+spake:\s*$")

# Footnote block: line starting with whitespace + [ followed by number or word
_FOOTNOTE_START_RE = re.compile(r"^\s*\[(?:\d+|Prose|General|Introductory)")

# Lacuna: lines of dots
_LACUNA_RE = re.compile(r"^\s*\.(\s+\.)+\s*$")

# Sub-poem headers within a poem (e.g., "I. GROUGALDR", "II. FJOLMINNSMOL")
_SUBPOEM_RE = re.compile(r"^[IVXLC]+\.\s+[A-Z]")

# Volume header
_VOLUME_RE = re.compile(r"^VOLUME\s+([IVXLC]+)\s*$")

# Poem titles: ALL-CAPS lines that are poem names (not VOLUME, not INTRODUCTORY)
# These are the master list of poems per volume
_POEMS_VOL1 = [
    ("voluspo", "Voluspo"),
    ("hovamol", "Hovamol"),
    ("vafthruthnismol", "Vafthruthnismol"),
    ("grimnismol", "Grimnismol"),
    ("skirnismol", "Skirnismol"),
    ("harbarthsljoth", "Harbarthsljoth"),
    ("hymiskvitha", "Hymiskvitha"),
    ("lokasenna", "Lokasenna"),
    ("thrymskvitha", "Thrymskvitha"),
    ("alvissmol", "Alvissmol"),
    ("baldrs-draumar", "Baldrs Draumar"),
    ("rigsthula", "Rigsthula"),
    ("hyndluljoth", "Hyndluljoth"),
    ("svipdagsmol", "Svipdagsmol"),
]

_POEMS_VOL2 = [
    ("volundarkvitha", "Volundarkvitha"),
    ("helgakvitha-hjorvarthssonar", "Helgakvitha Hjorvarthssonar"),
    ("helgakvitha-hundingsbana-i", "Helgakvitha Hundingsbana I"),
    ("helgakvitha-hundingsbana-ii", "Helgakvitha Hundingsbana II"),
    ("fra-dautha-sinfjotla", "Fra Dautha Sinfjotla"),
    ("gripisspo", "Gripisspo"),
    ("reginsmol", "Reginsmol"),
    ("fafnismol", "Fafnismol"),
    ("sigrdrifumol", "Sigrdrifumol"),
    ("brot-af-sigurtharkvithu", "Brot af Sigurtharkvithu"),
    ("guthrunarkvitha-i", "Guthrunarkvitha I"),
    ("sigurtharkvitha-en-skamma", "Sigurtharkvitha en Skamma"),
    ("helreith-brynhildar", "Helreith Brynhildar"),
    ("drap-niflunga", "Drap Niflunga"),
    ("guthrunarkvitha-ii", "Guthrunarkvitha II"),
    ("guthrunarkvitha-iii", "Guthrunarkvitha III"),
    ("oddrunargratr", "Oddrunargratr"),
    ("atlakvitha", "Atlakvitha"),
    ("atlamol", "Atlamol"),
    ("guthrunarhvot", "Guthrunarhvot"),
    ("hamthesmol", "Hamthesmol"),
]

# Map poem title (as seen in text, uppercased) to poem id
_TITLE_TO_ID = {}
for _poems in (_POEMS_VOL1, _POEMS_VOL2):
    for _pid, _pname in _poems:
        _TITLE_TO_ID[_pname.upper()] = _pid
# Handle variant titles
_TITLE_TO_ID["GUTHRUNARKVITHA II, EN FORNA"] = "guthrunarkvitha-ii"
_TITLE_TO_ID["ATLAKVITHA EN GRONLENZKA"] = "atlakvitha"
_TITLE_TO_ID["ATLAMOL EN GRONLENZKU"] = "atlamol"
_TITLE_TO_ID["HELGAKVITHA HJORVARTHSSONAR"] = "helgakvitha-hjorvarthssonar"
_TITLE_TO_ID["OF HJORVARTH AND SIGRLIN"] = None  # sub-section, not a separate poem


class EddaParser(BaseParser):
    WORK_ID = "poe"
    WORK_TITLE = "Poetic Edda"

    def parse(self, source_path):
        with open(source_path, encoding="utf-8") as f:
            text = f.read()

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Strip page markers and boilerplate
        text = _PAGE_RE.sub("", text)
        text = _BOILERPLATE_RE.sub("", text)

        lines = text.split("\n")

        # Find all poem boundaries
        poem_blocks = self._find_poems(lines)

        # Build chapters per volume
        all_chapters = []
        books_meta = []

        for vol_idx, (book_id, book_name, poems_list) in enumerate([
            ("poe-gods", "Lays of the Gods", _POEMS_VOL1),
            ("poe-heroes", "Lays of the Heroes", _POEMS_VOL2),
        ]):
            chapters = []
            ch_num = 1
            for poem_id, poem_name in poems_list:
                if poem_id not in poem_blocks:
                    continue
                body = poem_blocks[poem_id]
                verses = self._parse_poem(body)
                if not verses:
                    continue
                chapters.append({
                    "_id": f"{book_id}-{ch_num}",
                    "name": poem_name,
                    "sections": [BaseParser.make_section(verses, clean=False)],
                })
                ch_num += 1

            all_chapters.extend(chapters)
            books_meta.append({
                "id": book_id,
                "name": book_name,
                "abbrev": "Gods" if vol_idx == 0 else "Heroes",
                "chapters": len(chapters),
                "names": [ch.get("name") for ch in chapters],
            })

        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "bellows", "name": "Henry Adams Bellows", "year": 1936}
            ],
            "books": books_meta,
        }

        return [{
            "manifest": manifest,
            "chapters": all_chapters,
        }]

    def _find_poems(self, lines):
        """Find poem title lines and extract body text for each poem.

        Returns dict mapping poem_id → body text (after intro note,
        before next poem).
        """
        # Find all lines that match known poem titles
        poem_positions = []  # (line_idx, poem_id)

        i = 0
        while i < len(lines):
            stripped = lines[i].strip()
            # Check if this line is a known poem title
            pid = _TITLE_TO_ID.get(stripped)
            if pid is not None:
                poem_positions.append((i, pid))
            elif stripped == "SVIPDAGSMOL":
                poem_positions.append((i, "svipdagsmol"))
            i += 1

        # Extract body for each poem (skip intro notes)
        poem_blocks = {}
        for j, (start_line, pid) in enumerate(poem_positions):
            end_line = (
                poem_positions[j + 1][0]
                if j + 1 < len(poem_positions)
                else len(lines)
            )

            # Find end of INTRODUCTORY NOTE — look for first stanza number
            # or prose passage after the intro
            body_start = start_line + 1
            in_intro = False
            for k in range(start_line + 1, end_line):
                stripped = lines[k].strip()
                if stripped in ("INTRODUCTORY NOTE", "INTRODUCTORY NOTES"):
                    in_intro = True
                    continue
                if in_intro:
                    # End intro at first stanza number, speaker line, or
                    # separator line
                    if (_STANZA_RE.match(stripped) or _SPEAKER_RE.match(stripped)
                            or stripped.startswith("__")):
                        body_start = k
                        break
                    # Also end at prose that starts a narrative
                    # (after the scholarly discussion)
                    # Detect by checking if we hit a line that doesn't look
                    # like scholarly text and is after a blank line
                    if (stripped and k > 0 and not lines[k - 1].strip()
                            and not stripped.startswith("[")
                            and not stripped[0].isupper()
                            or stripped.startswith("There was")
                            or stripped.startswith("There were")
                            or stripped.startswith("Guthrun")
                            or stripped.startswith("King")
                            or stripped.startswith("Of")):
                        # Might be narrative prose — check if previous
                        # blank-line-separated block looks like end of intro
                        pass

            # For the body, also cut at the PRONOUNCING INDEX
            body_lines = lines[body_start:end_line]
            # Remove trailing index/appendix content
            for k, line in enumerate(body_lines):
                if line.strip() == "PRONOUNCING INDEX OF PROPER NAMES":
                    body_lines = body_lines[:k]
                    break

            poem_blocks[pid] = "\n".join(body_lines)

        return poem_blocks

    def _parse_poem(self, body):
        """Parse poem body into verses.

        Numbered stanzas become verses. Prose passages between stanzas
        become verses. Speaker attributions are prepended to the next
        stanza. Footnotes are stripped.
        """
        lines = body.split("\n")
        verses = []
        current_parts = []
        speaker = None
        in_footnote = False
        bracket_depth = 0

        for line in lines:
            stripped = line.strip()

            # Skip empty lines (may terminate current verse context)
            if not stripped:
                # Flush accumulated prose as a verse
                if current_parts and not _STANZA_RE.match(current_parts[0]):
                    text = self._clean_verse(" ".join(current_parts))
                    if text:
                        verses.append(text)
                    current_parts = []
                continue

            # Track footnote blocks
            if in_footnote:
                bracket_depth += stripped.count("[") - stripped.count("]")
                if bracket_depth <= 0:
                    in_footnote = False
                    bracket_depth = 0
                continue

            if _FOOTNOTE_START_RE.match(stripped):
                bracket_depth = stripped.count("[") - stripped.count("]")
                if bracket_depth > 0:
                    in_footnote = True
                continue

            # Skip sub-poem headers and their subtitles
            if _SUBPOEM_RE.match(stripped):
                continue
            if stripped.isupper() and len(stripped) > 3:
                # Subtitle in ALL CAPS (like "GROA'S SPELL", "THE LAY OF FJOLSVITH")
                # Only skip if it looks like a sub-title, not verse text
                if not _STANZA_RE.match(stripped):
                    continue

            # Skip lacunae
            if _LACUNA_RE.match(stripped):
                continue

            # Skip separator lines
            if stripped.startswith("__"):
                continue

            # Speaker attribution
            sm = _SPEAKER_RE.match(stripped)
            if sm:
                speaker = sm.group(1).strip()
                continue

            # Stanza number
            vm = _STANZA_RE.match(stripped)
            if vm:
                # Flush previous verse
                if current_parts:
                    text = self._clean_verse(" ".join(current_parts))
                    if text:
                        verses.append(text)
                    current_parts = []

                rest = vm.group(2).strip()
                if speaker:
                    prefix = f"{speaker}: "
                    speaker = None
                else:
                    prefix = ""

                if rest:
                    current_parts.append(prefix + rest)
                elif prefix:
                    current_parts.append(prefix.rstrip())
                continue

            # Regular text line (verse continuation or prose)
            if speaker:
                # Speaker without following stanza number — it's prose dialogue
                current_parts.append(f"{speaker}: {stripped}")
                speaker = None
            else:
                current_parts.append(stripped)

        # Flush remaining
        if current_parts:
            text = self._clean_verse(" ".join(current_parts))
            if text:
                verses.append(text)

        return verses

    def _clean_verse(self, text):
        """Clean a verse: strip brackets, normalize whitespace."""
        # Remove any remaining bracketed footnote/page fragments
        text = re.sub(r"\[f?p\.\s*\d+\]", "", text)
        text = re.sub(r"\[paragraph continues\]", "", text, flags=re.IGNORECASE)
        # Strip square brackets but keep content
        text = re.sub(r"[\[\]]", "", text)
        # Normalize double-hyphens to em dash
        text = re.sub(r"-{2,}", "—", text)
        # Strip lacuna dots (. . . . .)
        text = re.sub(r"(?:^|\s)\.(?:\s+\.)+(?:\s|$)", " ", text)
        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()
        # Remove leading/trailing punctuation artifacts
        text = re.sub(r"^\s*[,;]\s*", "", text)
        # Skip lines that are just page/footnote remnants
        if re.match(r"^f?p\.\s*\d+\s*$", text):
            return ""
        # Skip lacunae (lines of dots)
        if re.match(r"^[.\s]+$", text):
            return ""
        return text
