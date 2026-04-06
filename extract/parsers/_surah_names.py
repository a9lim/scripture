"""Surah name mapping shared across Quran parsers.

Titles are scraped from the Pickthall raw file, stripping 'The ' prefix.
Overrides apply hebraized letter names, speculative coinages, and translated
proper nouns (see quran-arabic-phrases.md).
"""

import os
import re

_RAW_PATH = os.path.join(
    os.path.dirname(__file__), os.pardir, os.pardir, "raw", "pick-quran.txt"
)

# Overrides: hebraized letters, speculative coinages, translated names
_OVERRIDES = {
    3: "Family of Amram",       # translated ('Imran→Amram)
    11: "Lehi",                 # translated (Hud→Lehi; Hamblin 2002)
    27: "Nemal",                # speculative (Naml→Nemal)
    31: "Achiacharus",          # translated (Luqman→Achiacharus)
    34: "Sheba",                # translated (Saba→Sheba)
    47: "Mohammed",              # translated (Muhammad→Mohammed)
    72: "The Genies",            # translated (jinn→genies)
    106: "Coresh",              # speculative (Quraish→Coresh)
}


def _build_surah_names():
    """Parse Pickthall headers, apply overrides, return {num: (arabic, english)}."""
    names = {}
    with open(_RAW_PATH, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^(\d+)\.\s+(\S.*?):\s+(.+)$", line)
            if m:
                num = int(m.group(1))
                arabic = m.group(2).strip()
                english = m.group(3).strip()
                if english.startswith("The "):
                    english = english[4:]
                # Fix lowercase 'the' (e.g. surah 85)
                if english.startswith("the "):
                    english = english[4:]
                english = _OVERRIDES.get(num, english)
                names[num] = (arabic, english)
    return names


_SURAH_NAMES = _build_surah_names()
