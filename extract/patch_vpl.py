#!/usr/bin/env python3
"""Patch eng-kjv_vpl.txt to modernize archaic KJV spellings.

Applies whole-word substitutions derived from comparing the VPL text against
the Cambridge 1769 edition (quad PDF).  Run once; idempotent.

Usage:
    python3 patch_vpl.py [path/to/eng-kjv_vpl.txt]
"""

import re
import sys

# Archaic → modern spelling.  Whole-word, case-sensitive.
# Derived from OT/NT comparison against quad PDF output.
SUBS = {
    "graffed": "grafted",
    "graff": "graft",
    "cieled": "ceiled",
    "pourtrayed": "portrayed",
    "pourtray": "portray",
    "platted": "plaited",
    "chesnut": "chestnut",
    "lunatick": "lunatic",
    "spunge": "sponge",
    "asswage": "assuage",
    "asswaged": "assuaged",
    "pluckt": "plucked",
    "Abidah": "Abida",
    "aul": "awl",
    "mixt": "mixed",
    "marishes": "marshes",
    "havock": "havoc",
    "instructers": "instructors",
}

# Build regex: match any key as a whole word (longest first to avoid partial matches)
_PAT = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(SUBS, key=len, reverse=True)) + r")\b"
)


def patch(text):
    return _PAT.sub(lambda m: SUBS[m.group(1)], text)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "../raw/eng-kjv_vpl.txt"
    with open(path, encoding="utf-8") as f:
        original = f.read()

    patched = patch(original)
    count = sum(original.count(k) - patched.count(k) for k in SUBS)

    if count == 0:
        print("No changes needed — already patched.")
        return

    with open(path, "w", encoding="utf-8") as f:
        f.write(patched)
    print(f"Patched {count} archaic spellings in {path}")


if __name__ == "__main__":
    main()
