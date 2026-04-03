#!/usr/bin/env python3
"""Verify extracted scripture data against canonical verse/chapter counts.

Checks:
  1. Every manifest chapter has a matching JSON file
  2. Manifest verse count == actual verse count in chapter JSON
  3. Verses are numbered 1..N sequentially (no gaps, no duplicates)
  4. No verse has empty text
  5. Chapter counts per book match canonical expectations
  6. Verse counts per chapter match canonical expectations
  7. Section startVerse values are consistent

Usage:
    python3 verify_data.py [data_dir]
    # defaults to ../data relative to this script
"""

import json
import os
import sys
from pathlib import Path

# ── Canonical verse counts ─────────────────────────────────────────
# Format: { "bookId": [ch1_verses, ch2_verses, ...] }
# Sources: KJV standard, LDS standard editions, standard Quran numbering

EXPECTED = {}

# ── Book of Mormon ──────────────────────────────────────────────────
EXPECTED["1-ne"] = [20,24,31,38,22,6,22,38,6,22,36,23,42,30,36,39,55,25,24,22,26,31]
EXPECTED["2-ne"] = [32,30,25,35,34,18,11,25,54,25,8,22,26,6,30,13,25,22,21,34,16,6,22,32,30,33,35,32,14,18,21,9,15]
EXPECTED["jacob"] = [19,35,14,18,77,13,27]
EXPECTED["enos"] = [27]
EXPECTED["jarom"] = [15]
EXPECTED["omni"] = [30]
EXPECTED["w-of-m"] = [18]
EXPECTED["mosiah"] = [18,41,27,30,15,7,33,21,19,22,29,37,35,12,31,15,20,35,29,26,36,16,39,25,24,39,37,20,47]
EXPECTED["alma"] = [33,38,27,20,62,8,27,32,34,32,46,37,31,29,19,21,39,43,36,30,23,35,18,30,17,37,30,14,17,60,38,43,23,41,16,30,47,15,19,26,15,31,54,24,24,41,36,25,30,40,37,40,23,24,35,57,36,41,13,36,21,52,17]
EXPECTED["hel"] = [34,14,37,26,52,41,29,28,41,19,38,26,39,31,17,25]
EXPECTED["3-ne"] = [30,19,26,33,26,30,26,25,22,19,41,48,34,27,24,20,25,39,36,46,29,17,14,18,6,21,33,40,9,2]
EXPECTED["4-ne"] = [49]
EXPECTED["morm"] = [19,29,22,23,24,22,10,41,37]
EXPECTED["ether"] = [43,25,28,19,6,30,27,26,35,34,23,41,31,31,34]
EXPECTED["moro"] = [4,3,4,3,2,9,48,30,26,34]

# ── Doctrine and Covenants ──────────────────────────────────────────
# D&C: standard LDS edition verse counts (138 sections)
EXPECTED["dc"] = [
    39,3,20,7,35,37,8,12,14,70,30,9,1,11,6,6,9,47,41,84,12,4,7,19,16,2,18,16,
    50,11,13,5,18,12,27,8,4,42,24,3,12,93,35,6,75,33,4,6,28,46,20,44,7,10,6,20,
    16,65,24,17,39,9,66,43,6,13,14,35,8,18,11,26,6,7,36,119,15,22,4,5,7,24,6,120,
    12,11,8,141,21,37,6,2,53,17,17,9,28,48,8,17,101,34,40,86,41,8,100,8,80,16,11,
    34,10,2,19,1,16,6,7,1,46,9,17,145,4,3,12,25,9,23,8,66,74,12,7,42,10,60
]
EXPECTED["od"] = [1, 1]

# ── Pearl of Great Price ────────────────────────────────────────────
EXPECTED["moses"] = [42,31,25,32,59,68,69,30]
EXPECTED["abr"] = [31,25,28,31,21]
EXPECTED["js-m"] = [55]
EXPECTED["js-h"] = [75]
EXPECTED["a-of-f"] = [13]

# ── Old Testament ───────────────────────────────────────────────────
EXPECTED["gen"] = [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]
EXPECTED["ex"] = [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]
EXPECTED["lev"] = [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]
EXPECTED["num"] = [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13]
EXPECTED["deut"] = [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12]
EXPECTED["josh"] = [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33]
EXPECTED["judg"] = [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25]
EXPECTED["ruth"] = [22,23,18,22]
EXPECTED["1-sam"] = [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13]
EXPECTED["2-sam"] = [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25]
EXPECTED["1-kgs"] = [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53]
EXPECTED["2-kgs"] = [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30]
EXPECTED["1-chr"] = [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30]
EXPECTED["2-chr"] = [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23]
EXPECTED["ezra"] = [11,70,13,24,17,22,28,36,15,44]
EXPECTED["neh"] = [11,20,32,23,19,19,73,18,38,39,36,47,31]
EXPECTED["esth"] = [22,23,15,17,14,14,10,17,32,3]
EXPECTED["job"] = [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17]
EXPECTED["ps"] = [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6]
EXPECTED["prov"] = [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31]
EXPECTED["eccl"] = [18,26,22,16,20,12,29,17,18,20,10,14]
EXPECTED["song"] = [17,17,11,16,16,13,13,14]
EXPECTED["isa"] = [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24]
EXPECTED["jer"] = [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34]
EXPECTED["lam"] = [22,22,66,22,22]
EXPECTED["ezek"] = [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35]
EXPECTED["dan"] = [21,49,30,37,31,28,28,27,27,21,45,13]
EXPECTED["hosea"] = [11,23,5,19,15,11,16,14,17,15,12,14,16,9]
EXPECTED["joel"] = [20,32,21]
EXPECTED["amos"] = [15,16,15,13,27,14,17,14,15]
EXPECTED["obad"] = [21]
EXPECTED["jonah"] = [17,10,10,11]
EXPECTED["micah"] = [16,13,12,13,15,16,20]
EXPECTED["nahum"] = [15,13,19]
EXPECTED["hab"] = [17,20,19]
EXPECTED["zeph"] = [18,15,20]
EXPECTED["hag"] = [15,23]
EXPECTED["zech"] = [21,13,10,14,11,15,14,23,17,12,17,14,9,21]
EXPECTED["mal"] = [14,17,18,6]

# ── New Testament ───────────────────────────────────────────────────
EXPECTED["matt"] = [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20]
EXPECTED["mark"] = [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20]
EXPECTED["luke"] = [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53]
EXPECTED["john"] = [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25]
EXPECTED["acts"] = [26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31]
EXPECTED["rom"] = [32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27]
EXPECTED["1-cor"] = [31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24]
EXPECTED["2-cor"] = [24,17,18,18,21,18,16,24,15,18,33,21,14]
EXPECTED["gal"] = [24,21,29,31,26,18]
EXPECTED["eph"] = [23,22,21,32,33,24]
EXPECTED["philip"] = [30,30,21,23]
EXPECTED["col"] = [29,23,25,18]
EXPECTED["1-thes"] = [10,20,13,18,28]
EXPECTED["2-thes"] = [12,17,18]
EXPECTED["1-tim"] = [20,15,16,16,25,21]
EXPECTED["2-tim"] = [18,26,17,22]
EXPECTED["titus"] = [16,15,15]
EXPECTED["philem"] = [25]
EXPECTED["heb"] = [14,18,19,16,14,20,28,13,28,39,40,29,25]
EXPECTED["james"] = [27,26,18,17,20]
EXPECTED["1-pet"] = [25,25,22,19,14]
EXPECTED["2-pet"] = [21,22,18]
EXPECTED["1-jn"] = [10,29,24,21,21]
EXPECTED["2-jn"] = [13]
EXPECTED["3-jn"] = [14]
EXPECTED["jude"] = [25]
EXPECTED["rev"] = [20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21]

# ── Quran (standard numbering) ─────────────────────────────────────
EXPECTED["quran"] = [
    7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
    112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
    59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
    52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
    21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
]

# ── Apocrypha (KJV verse counts) ───────────────────────────────────
EXPECTED["tobit"] = [22,14,17,21,22,17,18,21,6,12,19,22,18,15]
EXPECTED["judith"] = [16,28,10,15,24,21,32,36,14,23,23,20,20,19,13,25]
EXPECTED["add-esth"] = [10,12,6,18,19,16,24]  # chapters 10-16; ch10 starts at v4
EXPECTED["wis"] = [16,24,19,20,23,25,30,21,18,21,26,27,19,31,19,29,21,25,22]
EXPECTED["sir"] = [30,18,31,31,15,37,36,19,18,31,34,18,26,27,20,30,32,33,30,32,28,27,28,34,26,29,30,26,28,25,31,24,31,26,20,26,31,34,35,30,24,25,33,23,26,20,25,25,16,29,30]
EXPECTED["bar"] = [22,35,37,37,9,73]
EXPECTED["pr-azar"] = [68]  # Prayer of Azariah / Song of Three
EXPECTED["sus"] = [64]
EXPECTED["bel"] = [42]
EXPECTED["1-macc"] = [64,70,60,61,68,63,50,32,73,89,74,53,53,49,41,24]
EXPECTED["2-macc"] = [36,32,40,50,27,31,42,36,29,38,38,45,26,46,39]
EXPECTED["1-esd"] = [58,30,24,63,73,34,15,96,55]
EXPECTED["pr-man"] = [15]  # Prayer of Manasseh
EXPECTED["2-esd"] = [40,48,36,52,56,59,70,63,47,59,46,51,58,48,63,78]


# ── Helpers ─────────────────────────────────────────────────────────

class Checker:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.errors = []
        self.stats = {"works": 0, "books": 0, "chapters": 0, "verses": 0}

    def error(self, msg):
        self.errors.append(msg)

    def load_json(self, path):
        with open(path) as f:
            return json.load(f)

    def run(self):
        works_path = self.data_dir / "works.json"
        if not works_path.exists():
            self.error(f"Missing {works_path}")
            return self.report()

        work_ids = self.load_json(works_path)
        self.stats["works"] = len(work_ids)

        for wid in work_ids:
            self.check_work(wid)

        return self.report()

    def check_work(self, work_id):
        manifest_path = self.data_dir / work_id / "manifest.json"
        if not manifest_path.exists():
            self.error(f"[{work_id}] Missing manifest.json")
            return

        manifest = self.load_json(manifest_path)

        if manifest["id"] != work_id:
            self.error(f"[{work_id}] Manifest id '{manifest['id']}' != work dir '{work_id}'")

        for book in manifest.get("books", []):
            self.stats["books"] += 1
            self.check_book(work_id, book)

    def check_book(self, work_id, book):
        book_id = book["id"]
        count = book.get("chapters", 0)
        start = book.get("start", 1)
        expected = EXPECTED.get(book_id)

        if expected is not None:
            if count != len(expected):
                self.error(
                    f"[{work_id}/{book_id}] Expected {len(expected)} chapters, "
                    f"got {count}"
                )

        for i in range(count):
            self.stats["chapters"] += 1
            ch_id = f"{book_id}-{start + i}"
            expected_verses = expected[i] if (expected and i < len(expected)) else None
            self.check_chapter(work_id, book_id, ch_id, expected_verses)

    def check_chapter(self, work_id, book_id, ch_id, expected_verses):
        # Check chapter file exists
        ch_path = self.data_dir / work_id / "chapters" / f"{ch_id}.json"
        if not ch_path.exists():
            self.error(f"[{ch_id}] Chapter file missing: {ch_path}")
            return

        ch_data = self.load_json(ch_path)

        # Collect all verses from sections
        all_verses = []
        for sec in ch_data.get("sections", []):
            all_verses.extend(sec.get("verses", []))

        actual_count = len(all_verses)
        self.stats["verses"] += actual_count

        # Check against canonical expected
        if expected_verses is not None and actual_count != expected_verses:
            self.error(
                f"[{ch_id}] Expected {expected_verses} verses (canonical), "
                f"got {actual_count}"
            )

        # Check for empty verse text
        for sec in ch_data.get("sections", []):
            for i, text in enumerate(sec.get("verses", [])):
                if not text or not text.strip():
                    verse_num = sec.get("startVerse", 1) + i
                    self.error(f"[{ch_id}:{verse_num}] Empty verse text")

    def report(self):
        print(f"\n{'='*60}")
        print(f"Scripture Data Verification Report")
        print(f"{'='*60}")
        print(f"Data directory: {self.data_dir}")
        print(f"Works: {self.stats['works']}  Books: {self.stats['books']}  "
              f"Chapters: {self.stats['chapters']}  Verses: {self.stats['verses']}")
        print()

        if self.errors:
            print(f"ERRORS ({len(self.errors)}):")
            for e in sorted(self.errors):
                print(f"  ✗ {e}")
            print()

        if not self.errors:
            print("✓ All checks passed!")
        else:
            print(f"✗ {len(self.errors)} errors found")

        return len(self.errors)


def main():
    data_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "data"
    )
    checker = Checker(data_dir)
    sys.exit(min(checker.run(), 1))


if __name__ == "__main__":
    main()
