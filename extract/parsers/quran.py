"""Quran parser for Pickthall's 'The Meaning of the Glorious Qur'an' (1930).

Parses the sacred-texts.com plaintext with format:
  N. arabic-name: English Name    (surah header)
  [NNN_VVV]V verse text           (verse line)
"""

import re

from base_parser import BaseParser

# Reuse the authoritative name table shared across Quran parsers
from parsers._surah_names import _SURAH_NAMES

# ---------------------------------------------------------------------------
# Regexes
# ---------------------------------------------------------------------------
_RE_SURAH = re.compile(r"^(\d+)\.\s+\S+.*?:\s+(.+)$")
_RE_VERSE = re.compile(r"^\[(\d+)_(\d+)\](\d+)\s+(.*)")
_RE_BOILERPLATE = re.compile(
    r"^The Meaning of the Glorious Qur.an, by M\.M\. Pickthall"
)


# ---------------------------------------------------------------------------
# Term translations
# ---------------------------------------------------------------------------

def _postprocess(text):
    """Translate Arabic terms to English equivalents."""
    text = text.replace("Allah", "God")
    for arabic, english in _TRANSLATIONS.items():
        text = text.replace(arabic, english)
    for arabic, hebrew in _SPECULATIVE.items():
        text = text.replace(arabic, hebrew)
    return text


# Only terms that have genuine English translations.
_TRANSLATIONS = {
    # Scripture / religious terms
    "Qur'an": "record",
    "Quran": "record",
    "surah": "chapter",
    "Arabic": "native",
    # Figures with established English names
    "Shu'eyb": "Jethro",
    "Iblis": "the Devil",
    "Dhu'l-Qarneyn": "Cyrus",
    "Dhu'n-Nun": "Jonah",
    "Idris": "Enoch",
    "Azar": "Terah",
    "'Imran": "Amram",
    "Saba": "Sheba",
    "Dhu'l-Kifl": "Ezekiel",
    "Luqman": "Achiacharus",
    "Bakkah": "Baca",
    "Al-Judi": "Ararat",
    "As-Samiri": "the Samaritan",
    "Al-Mu'tafikah": "Sodom and Gomorrah",
    "'Iram": "Aram",
    "Iram": "Aram",
    "'Illiyin": "Exaltation",
    "Samiri": "Samaritan",
    "Shebaeans": "Sabians",
    "Zanjabil": "ginger",
    "Kafur": "camphor",
    "Al-Hijr": "the Rock",
    "Sijjin": "Perdition",
    "Hud": "Lehi",
    # Figure names
    "Muhammad": "Mohammed",
    "MUhammad": "Mohammed",
    # Jinn (Arabic jinn < jann "to hide/cover"; English "genie" via French génie < Latin genius, conflated with Arabic jinnī)
    "jinn": "genies",
    "Jinn": "Genies",
    # Companions / groups
    "Muhajirin": "emigrants",
    "Ansar": "helpers",
    # Ritual terms
    "qiblah": "direction of prayer",
    "Qiblah": "Direction of prayer",
}


# Speculative pseudo-Hebrew coinages: Arabic proper nouns and terms run
# through the Proto-Semitic consonant/vowel pipeline to produce BoM/KJV-style
# English names.  See word-correspondence.md Part VII for full derivations.
# These are NOT scholarly identifications — they are worldbuilding outputs.
_SPECULATIVE = {
    # Tribes / Peoples
    "Thamud": "Shamod",
    "A'ad": "Od",
    "Qureysh": "Coresh",
    "Quraysh": "Coresh",
    "Quraish": "Coresh",
    # Prophet / Figure names
    "Salih": "Zoleah",
    "Abu Lahab": "Abi-Lahav",
    # Places
    "Mecca": "Maccah",
    "Al-Madinah": "Medinah",
    "Madinah": "Medinah",
    "Badr": "Beder",
    "Uhud": "Ohod",
    "Yathrib": "Yashrib",
    "'Arafat": "Araphoth",
    "Arafat": "Araphoth",
    "Tabuk": "Taboc",
    "Ar-Rass": "Rass",
    "As-Safa": "Zapho",
    "Al-Marwah": "Marvah",
    # Idols
    "Al-Lat": "Elath",
    "Al-'Uzza": "Ozzoh",
    "Lat": "Elath",
    "Uzza": "Ozzoh",
    "Manat": "Menoth",
    "Wadd": "Vad",
    "Suwa'": "Shovah",
    "Yaghuth": "Yaosh",
    "Ya'uq": "Yaoc",
    "Nasr": "Nesher",
    # Other terms
    "Ramadan": "Ramazon",
    "Ka'bah": "Cabah",
    "Bahirah": "Behirah",
    "Sa'ibah": "Shoevah",
    "Wasilah": "Vezilah",
    "Hami": "Homeh",
    "Zeyd": "Zed",
    # Paradise / Hell features
    "Salsabil": "Shalshabil",
    "Tasnim": "Tashnim",
    "Zaqqum": "Zaccom",
    # Figures
    "Tubb'a": "Tobba",
    "Harut": "Horot",
    "Marut": "Morot",
    # Places
    "Tuwa": "Tuvah",
    "Huneyn": "Honen",
    "Makka": "Maccah",
}


def _postprocess_verse(text):
    """Apply term translations, strip brackets/parens, capitalize."""
    text = BaseParser.clean_text(text)
    text = _postprocess(text)
    if text:
        text = text[0].upper() + text[1:]
    return text


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

class QuranParser(BaseParser):
    """Parser for Pickthall's Quran plaintext (sacred-texts.com)."""

    WORK_ID = "quran"
    WORK_TITLE = "Quran"

    def parse(self, path):
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()

        chapters = []
        current_ch = None
        current_verses = []

        for line in lines:
            line = line.rstrip()

            # Skip boilerplate
            if _RE_BOILERPLATE.match(line) or not line.strip():
                continue

            # Surah header
            m = _RE_SURAH.match(line)
            if m:
                if current_ch is not None:
                    chapters.append(self._finalize(current_ch, current_verses))
                current_ch = int(m.group(1))
                current_verses = []
                continue

            # Verse line
            m = _RE_VERSE.match(line)
            if m:
                vnum = int(m.group(3))
                text = m.group(4).strip()
                current_verses.append(text)
                continue

        # Flush last chapter
        if current_ch is not None:
            chapters.append(self._finalize(current_ch, current_verses))

        if len(chapters) != 114:
            print(f"  Warning: found {len(chapters)}/114 chapters")

        manifest = {
            "id": self.WORK_ID,
            "title": self.WORK_TITLE,
            "translations": [
                {"id": "pickthall", "name": "Marmaduke Pickthall", "year": 1930}
            ],
            "books": [{
                "id": "quran",
                "name": "Quran",
                "abbrev": "Quran",
                "chapters": len(chapters),
                "names": [ch.get("name") for ch in chapters],
            }],
        }

        return [{
            "manifest": manifest,
            "chapters": chapters,
        }]

    def _finalize(self, ch_num, verses):
        resolved = [_postprocess_verse(v) for v in verses]

        if ch_num in _SURAH_NAMES:
            _, english = _SURAH_NAMES[ch_num]
        else:
            english = f"Chapter {ch_num}"

        return {
            "_id": f"quran-{ch_num}",
            "name": english,
            "sections": [{
                "startVerse": 1,
                "verses": resolved,
            }] if resolved else [],
        }
